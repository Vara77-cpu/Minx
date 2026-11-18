import base64
import hashlib
import hmac
import json
import uuid
from contextlib import asynccontextmanager
from decimal import Decimal
from pathlib import Path
from typing import Annotated, Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import psycopg
from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from psycopg.rows import dict_row


API_DIR = Path(__file__).resolve().parent

MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_TOTAL_IMAGE_SIZE = 20 * 1024 * 1024
MAX_LISTING_IMAGES = 6

LISTING_FEE_INR = Decimal("79.00")
LISTING_FEE_PAISE = 7900

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class Settings(BaseSettings):
    database_url: str = Field(validation_alias="DATABASE_URL")
    supabase_url: str = Field(validation_alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(
        validation_alias="SUPABASE_SERVICE_ROLE_KEY"
    )

    razorpay_key_id: str | None = Field(
        default=None,
        validation_alias="RAZORPAY_KEY_ID",
    )
    razorpay_key_secret: str | None = Field(
        default=None,
        validation_alias="RAZORPAY_KEY_SECRET",
    )
    admin_user_ids: str = Field(
        default="",
        validation_alias="ADMIN_USER_IDS",
    )

    model_config = SettingsConfigDict(
        env_file=API_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Temporary, secret-safe Razorpay configuration diagnostics.
# This reports presence/format only; never print the actual credentials.
print(
    "Razorpay configuration:",
    {
        "key_id_present": bool(settings.razorpay_key_id),
        "key_id_test_mode": (settings.razorpay_key_id or "").startswith("rzp_test_"),
        "secret_present": bool(settings.razorpay_key_secret),
        "secret_has_outer_whitespace": (
            settings.razorpay_key_secret != settings.razorpay_key_secret.strip()
            if settings.razorpay_key_secret
            else False
        ),
    },
)


def get_connection():
    return psycopg.connect(
        settings.database_url,
        row_factory=dict_row,
        connect_timeout=10,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with get_connection() as connection:
            connection.execute("SELECT 1")

        print("MINX PostgreSQL connection successful.")

    except Exception as exc:
        print(f"MINX PostgreSQL connection failed: {exc}")
        raise

    yield


app = FastAPI(
    title="MINX Marketplace API",
    description="API for the MINX resale marketplace.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ListingCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=3, max_length=120)
    category_id: str = Field(min_length=1, max_length=100)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    condition: Literal["New", "Like New", "Good", "Fair"]
    location: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=10, max_length=2000)


class PaymentVerify(BaseModel):
    razorpay_order_id: str = Field(min_length=5, max_length=100)
    razorpay_payment_id: str = Field(min_length=5, max_length=100)
    razorpay_signature: str = Field(min_length=20, max_length=256)


class AdminDecision(BaseModel):
    reason: str = Field(default="", max_length=1000)


def verify_supabase_access_token(access_token: str) -> dict:
    project_url = settings.supabase_url.rstrip("/")
    user_url = f"{project_url}/auth/v1/user"

    request = Request(
        user_url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "apikey": settings.supabase_service_role_key,
            "Accept": "application/json",
        },
        method="GET",
    )

    try:
        with urlopen(request, timeout=15) as response:
            user = json.loads(response.read().decode("utf-8"))

        if not isinstance(user, dict) or not user.get("id"):
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication response.",
            )

        return user

    except HTTPError as exc:
        if exc.code in (400, 401, 403):
            raise HTTPException(
                status_code=401,
                detail="Your session is invalid or expired. Please sign in again.",
            ) from exc

        print(f"Supabase Auth verification failed with HTTP {exc.code}.")

        raise HTTPException(
            status_code=502,
            detail="Unable to verify your account with Supabase.",
        ) from exc

    except (URLError, TimeoutError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to reach Supabase Auth. Please try again.",
        ) from exc

    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Supabase Auth returned an invalid response.",
        ) from exc


# Register HTTP Bearer authentication in OpenAPI.
# Swagger UI will now show an "Authorize" button and send the
# Authorization: Bearer <token> header for protected endpoints.
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Sign in to continue. Use the Authorize button and provide a valid Supabase access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credentials.scheme.lower() != "bearer" or not credentials.credentials.strip():
        raise HTTPException(
            status_code=401,
            detail="A valid Bearer access token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return verify_supabase_access_token(credentials.credentials.strip())


def ensure_seller_profile(connection, user: dict) -> str:
    user_id = user.get("id")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="The authenticated user ID is missing.",
        )

    try:
        user_id = str(uuid.UUID(str(user_id)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(
            status_code=401,
            detail="The authenticated user ID is invalid.",
        ) from exc

    metadata = user.get("user_metadata") or {}

    full_name = (
        metadata.get("full_name")
        or metadata.get("name")
        or (user.get("email") or "").split("@")[0]
        or "MINX Seller"
    )

    full_name = str(full_name).strip()[:120] or "MINX Seller"

    profile = connection.execute(
        """
        SELECT id
        FROM profiles
        WHERE id = %s
        """,
        (user_id,),
    ).fetchone()

    if profile:
        return str(profile["id"])

    try:
        profile = connection.execute(
            """
            INSERT INTO profiles (id, full_name)
            VALUES (%s, %s)
            ON CONFLICT (id)
            DO UPDATE SET
                full_name = COALESCE(
                    NULLIF(profiles.full_name, ''),
                    EXCLUDED.full_name
                )
            RETURNING id
            """,
            (user_id, full_name),
        ).fetchone()

        if not profile:
            raise HTTPException(
                status_code=500,
                detail="Unable to create your seller profile.",
            )

        return str(profile["id"])

    except HTTPException:
        raise

    except Exception as exc:
        print(f"Seller profile creation failed: {exc}")

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to prepare your seller profile. "
                "Check the profiles table schema."
            ),
        ) from exc


def resolve_category(connection, category_id: str):
    return connection.execute(
        """
        SELECT id, name
        FROM categories
        WHERE id::text = %s
           OR lower(name) = lower(%s)
        LIMIT 1
        """,
        (
            category_id,
            category_id.replace("-", " "),
        ),
    ).fetchone()


def upload_to_supabase(
    image_bytes: bytes,
    content_type: str,
    extension: str,
) -> str:
    project_url = settings.supabase_url.rstrip("/")
    object_path = f"listings/{uuid.uuid4().hex}{extension}"

    upload_url = (
        f"{project_url}/storage/v1/object/"
        f"listing-images/{object_path}"
    )

    request = Request(
        upload_url,
        data=image_bytes,
        headers={
            "Authorization": (
                f"Bearer {settings.supabase_service_role_key}"
            ),
            "apikey": settings.supabase_service_role_key,
            "Content-Type": content_type,
            "x-upsert": "false",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=30) as response:
            if response.status not in (200, 201):
                raise HTTPException(
                    status_code=502,
                    detail="Supabase Storage rejected the image upload.",
                )

    except HTTPError as exc:
        print(f"Supabase Storage upload failed with HTTP {exc.code}.")

        raise HTTPException(
            status_code=502,
            detail=(
                "Image upload failed. Check the Storage bucket "
                "and credentials."
            ),
        ) from exc

    except (URLError, TimeoutError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to connect to Supabase Storage.",
        ) from exc

    return (
        f"{project_url}/storage/v1/object/public/"
        f"listing-images/{object_path}"
    )


def listing_response(listing, category_name, image_url=""):
    created_at = listing.get("created_at")

    return {
        "id": listing["id"],
        "title": listing["title"],
        "description": listing.get("description") or "",
        "category_id": str(listing["category_id"]),
        "category": category_name,
        "price": float(listing["price"]),
        "oldPrice": float(listing["price"]),
        "condition": listing.get("condition") or "Good",
        "location": listing.get("location") or "",
        "time": created_at.isoformat() if created_at else None,
        "image": image_url,
        "color": "product-default",
        "tag": listing.get("condition") or "Pre-loved",
    }


def require_razorpay_settings() -> tuple[str, str]:
    key_id = settings.razorpay_key_id
    key_secret = settings.razorpay_key_secret

    if not key_id or not key_secret:
        raise HTTPException(
            status_code=503,
            detail=(
                "Payments are not configured. Add Razorpay credentials "
                "to the backend .env."
            ),
        )

    return key_id, key_secret


def razorpay_request(
    method: str,
    path: str,
    payload: dict | None = None,
) -> dict:
    key_id, key_secret = require_razorpay_settings()

    credentials = base64.b64encode(
        f"{key_id}:{key_secret}".encode()
    ).decode()

    data = (
        None
        if payload is None
        else json.dumps(payload).encode("utf-8")
    )

    request = Request(
        f"https://api.razorpay.com/v1/{path.lstrip('/')}",
        data=data,
        headers={
            "Authorization": f"Basic {credentials}",
            "Accept": "application/json",
            **(
                {"Content-Type": "application/json"}
                if data is not None
                else {}
            ),
        },
        method=method.upper(),
    )

    try:
        with urlopen(request, timeout=20) as response:
            result = json.loads(response.read().decode("utf-8"))

        if not isinstance(result, dict):
            raise HTTPException(
                status_code=502,
                detail="Invalid response from payment provider.",
            )

        return result

    except HTTPError as exc:
        try:
            provider_error = json.loads(
                exc.read().decode("utf-8")
            )
            description = provider_error.get(
                "error", {}
            ).get("description")
        except Exception:
            description = None

        print(
            f"Razorpay API error: HTTP {exc.code}; "
            f"{description or 'no description'}"
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "The payment provider could not process this request. "
                "Please try again."
            ),
        ) from exc

    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to contact the payment provider. "
                "Please try again."
            ),
        ) from exc


def upload_listing_images(images: list[UploadFile]) -> list[str]:
    if not 1 <= len(images) <= MAX_LISTING_IMAGES:
        raise HTTPException(
            status_code=422,
            detail="Upload between 1 and 6 product photos.",
        )

    urls: list[str] = []
    total_size = 0

    for image in images:
        content_type = (image.content_type or "").lower()
        extension = ALLOWED_IMAGE_TYPES.get(content_type)

        if not extension:
            raise HTTPException(
                status_code=415,
                detail="Use JPG, PNG, or WebP photos only.",
            )

        image_bytes = image.file.read(MAX_IMAGE_SIZE + 1)

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="One of the selected photos is empty.",
            )

        if len(image_bytes) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Each photo must be 5 MB or smaller.",
            )

        total_size += len(image_bytes)

        if total_size > MAX_TOTAL_IMAGE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=(
                    "The combined photo size must be "
                    "20 MB or less."
                ),
            )

        urls.append(
            upload_to_supabase(
                image_bytes,
                content_type,
                extension,
            )
        )

    return urls


@app.get("/")
def root():
    return {
        "name": "MINX Marketplace API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health():
    try:
        with get_connection() as connection:
            connection.execute("SELECT 1")

        return {
            "status": "ok",
            "database": "connected",
            "storage_configured": True,
            "listing_fee_inr": str(LISTING_FEE_INR),
            "max_listing_images": MAX_LISTING_IMAGES,
        }

    except Exception as exc:
        print(f"Health check failed: {exc}")

        raise HTTPException(
            status_code=503,
            detail="Database connection failed.",
        ) from exc


@app.get("/api/categories")
def get_categories():
    try:
        with get_connection() as connection:
            rows = connection.execute(
                """
                SELECT id, name
                FROM categories
                ORDER BY name ASC
                """
            ).fetchall()

        return {"items": rows}

    except Exception as exc:
        print(f"Category query failed: {exc}")

        raise HTTPException(
            status_code=500,
            detail="Unable to load categories.",
        ) from exc


@app.get("/api/listings")
def get_listings(
    search: str | None = Query(default=None, max_length=120),
    category: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    conditions = ["l.status = 'active'"]
    params: list = []

    if search and search.strip():
        conditions.append(
            """
            (
                l.title ILIKE %s
                OR l.description ILIKE %s
                OR l.location ILIKE %s
                OR c.name ILIKE %s
            )
            """
        )

        search_term = f"%{search.strip()}%"
        params.extend([search_term] * 4)

    if category and category.strip():
        conditions.append("c.name ILIKE %s")
        params.append(category.strip())

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            l.id,
            l.title,
            l.description,
            l.category_id,
            c.name AS category,
            l.price,
            l.condition,
            l.location,
            l.created_at,
            (
                SELECT li.image_url
                FROM listing_images li
                WHERE li.listing_id = l.id
                ORDER BY li.display_order ASC, li.created_at ASC
                LIMIT 1
            ) AS image
        FROM listings l
        JOIN categories c ON c.id = l.category_id
        WHERE {where_clause}
        ORDER BY l.created_at DESC
        LIMIT %s OFFSET %s
    """

    try:
        with get_connection() as connection:
            rows = connection.execute(
                query,
                [*params, limit, offset],
            ).fetchall()

        items = [
            listing_response(
                row,
                row["category"],
                row.get("image") or "",
            )
            for row in rows
        ]

        return {
            "items": items,
            "limit": limit,
            "offset": offset,
            "count": len(items),
        }

    except Exception as exc:
        print(f"Listing query failed: {exc}")

        raise HTTPException(
            status_code=500,
            detail="Unable to load listings.",
        ) from exc


@app.post("/api/listings", status_code=410)
def legacy_create_listing():
    raise HTTPException(
        status_code=410,
        detail=(
            "Direct publishing is disabled. "
            "Use the paid listing checkout flow."
        ),
    )


@app.post("/api/listings/with-image", status_code=410)
async def legacy_create_listing_with_image():
    raise HTTPException(
        status_code=410,
        detail=(
            "Direct publishing is disabled. "
            "Use the paid listing checkout flow."
        ),
    )


@app.post("/api/listings/checkout", status_code=201)
async def create_listing_checkout(
    title: Annotated[str, Form(min_length=3, max_length=120)],
    category_id: Annotated[str, Form(min_length=1, max_length=100)],
    price: Annotated[
        Decimal,
        Form(gt=0, max_digits=12, decimal_places=2),
    ],
    condition: Annotated[
        Literal["New", "Like New", "Good", "Fair"],
        Form(),
    ],
    location: Annotated[str, Form(min_length=2, max_length=120)],
    description: Annotated[
        str,
        Form(min_length=10, max_length=2000),
    ],
    images: Annotated[list[UploadFile], File()],
    user: dict = Depends(get_current_user),
):
    require_razorpay_settings()

    if not 1 <= len(images) <= MAX_LISTING_IMAGES:
        raise HTTPException(
            status_code=422,
            detail="Upload between 1 and 6 product photos.",
        )

    try:
        with get_connection() as connection:
            with connection.transaction():
                ensure_seller_profile(connection, user)

                category = resolve_category(
                    connection,
                    category_id,
                )

                if not category:
                    raise HTTPException(
                        status_code=422,
                        detail="The selected category does not exist.",
                    )

        image_urls = upload_listing_images(images)

        receipt = f"minx_{uuid.uuid4().hex[:24]}"

        order = razorpay_request(
            "POST",
            "/orders",
            {
                "amount": LISTING_FEE_PAISE,
                "currency": "INR",
                "receipt": receipt,
                "notes": {
                    "purpose": "MINX listing fee",
                    "seller_auth_user_id": str(user["id"]),
                },
            },
        )

        order_id = order.get("id")

        if not order_id:
            raise HTTPException(
                status_code=502,
                detail="The payment provider did not return an order ID.",
            )

        listing_payload = {
            "title": title.strip(),
            "category_id": str(category["id"]),
            "price": str(price),
            "condition": condition,
            "location": location.strip(),
            "description": description.strip(),
        }

        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO listing_payment_orders (
                    seller_auth_user_id,
                    razorpay_order_id,
                    amount_paise,
                    listing_payload,
                    image_urls,
                    payment_status,
                    review_status
                )
                VALUES (
                    %s, %s, %s, %s::jsonb, %s::jsonb,
                    'created', 'payment_pending'
                )
                """,
                (
                    str(user["id"]),
                    order_id,
                    LISTING_FEE_PAISE,
                    json.dumps(listing_payload),
                    json.dumps(image_urls),
                ),
            )

        return {
            "message": (
                "Checkout created. Complete payment to submit "
                "your ad for review."
            ),
            "key_id": settings.razorpay_key_id,
            "order_id": order_id,
            "amount": LISTING_FEE_PAISE,
            "currency": "INR",
            "fee_inr": str(LISTING_FEE_INR),
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(f"Listing checkout creation failed: {exc}")

        raise HTTPException(
            status_code=500,
            detail="Unable to start listing checkout.",
        ) from exc

    finally:
        for image in images:
            try:
                await image.close()
            except Exception:
                pass


@app.post("/api/payments/verify", status_code=201)
def verify_listing_payment(
    payload: PaymentVerify,
    user: dict = Depends(get_current_user),
):
    _, key_secret = require_razorpay_settings()

    expected_signature = hmac.new(
        key_secret.encode("utf-8"),
        (
            f"{payload.razorpay_order_id}|"
            f"{payload.razorpay_payment_id}"
        ).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(
        expected_signature,
        payload.razorpay_signature,
    ):
        raise HTTPException(
            status_code=400,
            detail="Payment signature verification failed.",
        )

    with get_connection() as connection:
        payment_order = connection.execute(
            """
            SELECT *
            FROM listing_payment_orders
            WHERE razorpay_order_id = %s
              AND seller_auth_user_id = %s
            """,
            (
                payload.razorpay_order_id,
                str(user["id"]),
            ),
        ).fetchone()

    if not payment_order:
        raise HTTPException(
            status_code=404,
            detail="Payment order was not found for this account.",
        )

    if (
        payment_order["payment_status"] == "paid"
        and payment_order.get("listing_id")
    ):
        return {
            "message": (
                "Payment was already verified. "
                "Your ad is awaiting admin review."
            ),
            "listing_id": payment_order["listing_id"],
            "status": "pending_review",
        }

    payment = razorpay_request(
        "GET",
        f"/payments/{payload.razorpay_payment_id}",
    )

    if payment.get("order_id") != payload.razorpay_order_id:
        raise HTTPException(
            status_code=400,
            detail="This payment does not belong to the checkout order.",
        )

    if payment.get("status") != "captured":
        raise HTTPException(
            status_code=409,
            detail=(
                "Payment is not captured yet. If money was deducted, "
                "wait briefly and retry verification."
            ),
        )

    if int(payment.get("amount", 0)) != int(
        payment_order["amount_paise"]
    ):
        raise HTTPException(
            status_code=400,
            detail="The payment amount does not match the listing fee.",
        )

    listing_payload = payment_order["listing_payload"]
    image_urls = payment_order["image_urls"]

    if isinstance(listing_payload, str):
        listing_payload = json.loads(listing_payload)

    if isinstance(image_urls, str):
        image_urls = json.loads(image_urls)

    try:
        with get_connection() as connection:
            with connection.transaction():
                locked_order = connection.execute(
                    """
                    SELECT *
                    FROM listing_payment_orders
                    WHERE id = %s
                    FOR UPDATE
                    """,
                    (payment_order["id"],),
                ).fetchone()

                if (
                    locked_order["payment_status"] == "paid"
                    and locked_order.get("listing_id")
                ):
                    return {
                        "message": (
                            "Payment was already verified. "
                            "Your ad is awaiting admin review."
                        ),
                        "listing_id": locked_order["listing_id"],
                        "status": "pending_review",
                    }

                seller_id = ensure_seller_profile(
                    connection,
                    user,
                )

                category = resolve_category(
                    connection,
                    listing_payload["category_id"],
                )

                if not category:
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            "The selected category no longer exists."
                        ),
                    )

                listing = connection.execute(
                    """
                    INSERT INTO listings (
                        seller_id,
                        title,
                        description,
                        category_id,
                        price,
                        condition,
                        location,
                        status
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s,
                        'pending_review'
                    )
                    RETURNING
                        id,
                        title,
                        description,
                        category_id,
                        price,
                        condition,
                        location,
                        created_at
                    """,
                    (
                        seller_id,
                        listing_payload["title"],
                        listing_payload["description"],
                        category["id"],
                        Decimal(listing_payload["price"]),
                        listing_payload["condition"],
                        listing_payload["location"],
                    ),
                ).fetchone()

                for order_index, image_url in enumerate(image_urls):
                    connection.execute(
                        """
                        INSERT INTO listing_images (
                            listing_id,
                            image_url,
                            display_order
                        )
                        VALUES (%s, %s, %s)
                        """,
                        (
                            listing["id"],
                            image_url,
                            order_index,
                        ),
                    )

                connection.execute(
                    """
                    UPDATE listing_payment_orders
                    SET
                        payment_status = 'paid',
                        payment_id = %s,
                        listing_id = %s,
                        review_status = 'pending_review',
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (
                        payload.razorpay_payment_id,
                        str(listing["id"]),
                        payment_order["id"],
                    ),
                )

        return {
            "message": (
                "Payment verified. Your ad has been submitted "
                "for admin review."
            ),
            "listing_id": str(listing["id"]),
            "status": "pending_review",
            "fee_inr": str(LISTING_FEE_INR),
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(
            f"Payment verified but listing submission failed: {exc}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Payment was verified, but the ad could not be submitted. "
                "Contact MINX support with your payment ID."
            ),
        ) from exc


def require_admin(user: dict) -> None:
    allowed_ids = {
        item.strip()
        for item in settings.admin_user_ids.split(",")
        if item.strip()
    }

    if not allowed_ids or str(user.get("id")) not in allowed_ids:
        raise HTTPException(
            status_code=403,
            detail="Admin access is required.",
        )


@app.get("/api/admin/listings/pending")
def get_pending_listings(
    user: dict = Depends(get_current_user),
):
    require_admin(user)

    try:
        with get_connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    l.id,
                    l.title,
                    l.description,
                    l.category_id,
                    c.name AS category,
                    l.price,
                    l.condition,
                    l.location,
                    l.created_at,
                    l.seller_id,
                    p.full_name AS seller_name,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'url', li.image_url,
                                'display_order', li.display_order
                            )
                            ORDER BY li.display_order
                        )
                        FROM listing_images li
                        WHERE li.listing_id = l.id
                    ) AS images
                FROM listings l
                JOIN categories c ON c.id = l.category_id
                LEFT JOIN profiles p ON p.id = l.seller_id
                WHERE l.status = 'pending_review'
                ORDER BY l.created_at ASC
                LIMIT 200
                """
            ).fetchall()

        return {
            "items": rows,
            "count": len(rows),
        }

    except Exception as exc:
        print(f"Admin pending-listings query failed: {exc}")

        raise HTTPException(
            status_code=500,
            detail="Unable to load pending advertisements.",
        ) from exc


@app.post("/api/admin/listings/{listing_id}/approve")
def approve_listing(
    listing_id: str,
    user: dict = Depends(get_current_user),
):
    require_admin(user)

    try:
        with get_connection() as connection:
            with connection.transaction():
                listing = connection.execute(
                    """
                    UPDATE listings
                    SET status = 'active'
                    WHERE id::text = %s
                      AND status = 'pending_review'
                    RETURNING id, title
                    """,
                    (listing_id,),
                ).fetchone()

                if not listing:
                    raise HTTPException(
                        status_code=404,
                        detail="Pending advertisement not found.",
                    )

                connection.execute(
                    """
                    UPDATE listing_payment_orders
                    SET
                        review_status = 'approved',
                        updated_at = NOW()
                    WHERE listing_id = %s
                    """,
                    (str(listing["id"]),),
                )

        return {
            "message": "Advertisement approved and published.",
            "item": {
                "id": str(listing["id"]),
                "title": listing["title"],
                "status": "active",
            },
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(f"Admin approval failed: {exc}")

        raise HTTPException(
            status_code=500,
            detail="Unable to approve advertisement.",
        ) from exc


@app.post("/api/admin/listings/{listing_id}/reject")
def reject_listing(
    listing_id: str,
    payload: AdminDecision,
    user: dict = Depends(get_current_user),
):
    require_admin(user)

    reason = (
        payload.reason.strip()
        or "This advertisement did not meet MINX listing requirements."
    )

    try:
        with get_connection() as connection:
            with connection.transaction():
                listing = connection.execute(
                    """
                    UPDATE listings
                    SET status = 'rejected'
                    WHERE id::text = %s
                      AND status = 'pending_review'
                    RETURNING id, title
                    """,
                    (listing_id,),
                ).fetchone()

                if not listing:
                    raise HTTPException(
                        status_code=404,
                        detail="Pending advertisement not found.",
                    )

                connection.execute(
                    """
                    UPDATE listing_payment_orders
                    SET
                        review_status = 'rejected',
                        rejection_reason = %s,
                        updated_at = NOW()
                    WHERE listing_id = %s
                    """,
                    (
                        reason,
                        str(listing["id"]),
                    ),
                )

        return {
            "message": (
                "Advertisement rejected and hidden. "
                "Refund handling must follow MINX's published refund policy."
            ),
            "item": {
                "id": str(listing["id"]),
                "title": listing["title"],
                "status": "rejected",
                "reason": reason,
            },
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(f"Admin rejection failed: {exc}")

        raise HTTPException(
            status_code=500,
            detail="Unable to reject advertisement.",
        ) from exc


@app.get("/api/my/listings")
def get_my_listings(
    user: dict = Depends(get_current_user),
):
    try:
        with get_connection() as connection:
            seller_id = ensure_seller_profile(
                connection,
                user,
            )

            rows = connection.execute(
                """
                SELECT
                    l.id,
                    l.title,
                    l.description,
                    l.category_id,
                    c.name AS category,
                    l.price,
                    l.condition,
                    l.location,
                    l.status,
                    l.created_at,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'url', li.image_url,
                                'display_order', li.display_order
                            )
                            ORDER BY li.display_order
                        )
                        FROM listing_images li
                        WHERE li.listing_id = l.id
                    ) AS images,
                    po.payment_status,
                    po.review_status,
                    po.rejection_reason
                FROM listings l
                JOIN categories c ON c.id = l.category_id
                LEFT JOIN listing_payment_orders po
                    ON po.listing_id = l.id::text
                WHERE l.seller_id = %s
                ORDER BY l.created_at DESC
                LIMIT 200
                """,
                (seller_id,),
            ).fetchall()

        return {
            "items": rows,
            "count": len(rows),
        }

    except Exception as exc:
        print(f"Seller listings query failed: {exc}")

        raise HTTPException(
            status_code=500,
            detail="Unable to load your advertisements.",
        ) from exc
        # ============================================================
# MINX SELLER LISTING MANAGEMENT
# ============================================================

class SellerListingUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=3, max_length=120)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    condition: Literal["New", "Like New", "Good", "Fair"]
    location: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=10, max_length=2000)


@app.patch("/api/my/listings/{listing_id}")
def update_my_listing(
    listing_id: str,
    payload: SellerListingUpdate,
    user: dict = Depends(get_current_user),
):
    listing_uuid = str(listing_id).strip()
    if not listing_uuid or len(listing_uuid) > 100:
        raise HTTPException(
            status_code=400,
            detail="Invalid listing ID.",
        )

    try:
        with get_connection() as connection:
            with connection.transaction():
                seller_id = ensure_seller_profile(connection, user)

                listing = connection.execute(
                    """
                    SELECT id, status
                    FROM listings
                    WHERE id::text = %s
                      AND seller_id = %s
                    FOR UPDATE
                    """,
                    (listing_uuid, seller_id),
                ).fetchone()

                if not listing:
                    raise HTTPException(
                        status_code=404,
                        detail="Listing not found in your account.",
                    )

                if listing["status"] != "active":
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Only active listings can be edited. "
                            "Pending or rejected listings cannot be changed."
                        ),
                    )

                updated = connection.execute(
                    """
                    UPDATE listings
                    SET
                        title = %s,
                        price = %s,
                        condition = %s,
                        location = %s,
                        description = %s,
                        status = 'pending_review'
                    WHERE id::text = %s
                      AND seller_id = %s
                    RETURNING id, title, price, status
                    """,
                    (
                        payload.title,
                        payload.price,
                        payload.condition,
                        payload.location,
                        payload.description,
                        listing_uuid,
                        seller_id,
                    ),
                ).fetchone()

                connection.execute(
                    """
                    UPDATE listing_payment_orders
                    SET
                        review_status = 'pending_review',
                        rejection_reason = NULL,
                        updated_at = NOW()
                    WHERE listing_id = %s
                    """,
                    (listing_uuid,),
                )

        return {
            "message": (
                "Listing updated and sent for admin review. "
                "It will be published again after approval."
            ),
            "item": {
                "id": str(updated["id"]),
                "title": updated["title"],
                "price": float(updated["price"]),
                "status": updated["status"],
            },
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(f"Seller listing update failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Unable to update your listing.",
        ) from exc


@app.delete("/api/my/listings/{listing_id}")
def delete_my_listing(
    listing_id: str,
    user: dict = Depends(get_current_user),
):
    listing_uuid = str(listing_id).strip()
    if not listing_uuid or len(listing_uuid) > 100:
        raise HTTPException(
            status_code=400,
            detail="Invalid listing ID.",
        )

    try:
        with get_connection() as connection:
            with connection.transaction():
                seller_id = ensure_seller_profile(connection, user)

                listing = connection.execute(
                    """
                    SELECT id, status
                    FROM listings
                    WHERE id::text = %s
                      AND seller_id = %s
                    FOR UPDATE
                    """,
                    (listing_uuid, seller_id),
                ).fetchone()

                if not listing:
                    raise HTTPException(
                        status_code=404,
                        detail="Listing not found in your account.",
                    )

                if listing["status"] == "pending_review":
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "This listing is awaiting admin review. "
                            "Contact support if it must be withdrawn."
                        ),
                    )

                if listing["status"] == "removed":
                    return {
                        "message": "This listing is already deleted."
                    }

                connection.execute(
                    """
                    UPDATE listings
                    SET status = 'removed'
                    WHERE id::text = %s
                      AND seller_id = %s
                    """,
                    (listing_uuid, seller_id),
                )

        return {
            "message": (
                "Listing removed from the marketplace. "
                "Its payment history has been preserved."
            ),
            "listing_id": listing_uuid,
            "status": "deleted",
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(f"Seller listing deletion failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Unable to delete your listing.",
        ) from exc
        # ============================================================
# MINX BUYER–SELLER CHAT API
# ============================================================

class ConversationCreate(BaseModel):
    listing_id: int = Field(gt=0)


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


def get_profile_id(connection, user: dict) -> str:
    """Resolve the authenticated Supabase user to a MINX profile."""
    return ensure_seller_profile(connection, user)


def require_conversation_participant(
    connection,
    conversation_id: str,
    profile_id: str,
):
    """Only the conversation's buyer or seller can access it."""
    try:
        conversation_uuid = str(uuid.UUID(conversation_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid conversation ID.",
        ) from exc

    conversation = connection.execute(
        """
        SELECT
            id,
            listing_id,
            buyer_id,
            seller_id,
            created_at,
            updated_at
        FROM conversations
        WHERE id = %s
          AND (buyer_id = %s OR seller_id = %s)
        """,
        (conversation_uuid, profile_id, profile_id),
    ).fetchone()

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    return conversation


@app.post("/api/conversations", status_code=201)
def create_or_get_conversation(
    payload: ConversationCreate,
    user: dict = Depends(get_current_user),
):
    """Start or retrieve a conversation about an active listing."""
    try:
        with get_connection() as connection:
            with connection.transaction():
                profile_id = get_profile_id(connection, user)

                listing = connection.execute(
                    """
                    SELECT id, seller_id, title, status
                    FROM listings
                    WHERE id = %s
                    """,
                    (payload.listing_id,),
                ).fetchone()

                if not listing or listing["status"] != "active":
                    raise HTTPException(
                        status_code=404,
                        detail="Active listing not found.",
                    )

                seller_id = str(listing["seller_id"])

                if seller_id == profile_id:
                    raise HTTPException(
                        status_code=409,
                        detail="You cannot message yourself about your own listing.",
                    )

                conversation = connection.execute(
                    """
                    SELECT id, listing_id, buyer_id, seller_id,
                           created_at, updated_at
                    FROM conversations
                    WHERE listing_id = %s
                      AND buyer_id = %s
                      AND seller_id = %s
                    LIMIT 1
                    """,
                    (listing["id"], profile_id, seller_id),
                ).fetchone()

                if not conversation:
                    conversation = connection.execute(
                        """
                        INSERT INTO conversations (
                            listing_id,
                            buyer_id,
                            seller_id
                        )
                        VALUES (%s, %s, %s)
                        RETURNING id, listing_id, buyer_id, seller_id,
                                  created_at, updated_at
                        """,
                        (listing["id"], profile_id, seller_id),
                    ).fetchone()

        return {
            "conversation": {
                **conversation,
                "id": str(conversation["id"]),
                "listing_id": str(conversation["listing_id"]),
                "buyer_id": str(conversation["buyer_id"]),
                "seller_id": str(conversation["seller_id"]),
                "listing_title": listing["title"],
            }
        }

    except HTTPException:
        raise
    except Exception as exc:
        print(f"Create conversation failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Unable to start the conversation.",
        ) from exc


@app.get("/api/conversations")
def list_my_conversations(
    user: dict = Depends(get_current_user),
):
    """List conversations belonging to the signed-in buyer or seller."""
    try:
        with get_connection() as connection:
            profile_id = get_profile_id(connection, user)

            rows = connection.execute(
                """
                SELECT
                    c.id,
                    c.listing_id,
                    c.buyer_id,
                    c.seller_id,
                    c.created_at,
                    c.updated_at,
                    l.title AS listing_title,
                    l.price AS listing_price,
                    CASE
                        WHEN c.buyer_id = %s THEN 'buyer'
                        ELSE 'seller'
                    END AS my_role,
                    p.full_name AS other_party_name,
                    (
                        SELECT m.body
                        FROM messages m
                        WHERE m.conversation_id = c.id
                        ORDER BY m.created_at DESC
                        LIMIT 1
                    ) AS last_message,
                    (
                        SELECT m.created_at
                        FROM messages m
                        WHERE m.conversation_id = c.id
                        ORDER BY m.created_at DESC
                        LIMIT 1
                    ) AS last_message_at
                FROM conversations c
                JOIN listings l ON l.id = c.listing_id
                LEFT JOIN profiles p
                  ON p.id = CASE
                      WHEN c.buyer_id = %s THEN c.seller_id
                      ELSE c.buyer_id
                  END
                WHERE c.buyer_id = %s OR c.seller_id = %s
                ORDER BY c.updated_at DESC
                LIMIT 100
                """,
                (profile_id, profile_id, profile_id, profile_id),
            ).fetchall()

        return {
            "items": [
                {
                    **row,
                    "id": str(row["id"]),
                    "listing_id": str(row["listing_id"]),
                    "buyer_id": str(row["buyer_id"]),
                    "seller_id": str(row["seller_id"]),
                    "listing_price": (
                        float(row["listing_price"])
                        if row["listing_price"] is not None
                        else None
                    ),
                    "created_at": (
                        row["created_at"].isoformat()
                        if row["created_at"]
                        else None
                    ),
                    "updated_at": (
                        row["updated_at"].isoformat()
                        if row["updated_at"]
                        else None
                    ),
                    "last_message_at": (
                        row["last_message_at"].isoformat()
                        if row["last_message_at"]
                        else None
                    ),
                }
                for row in rows
            ],
            "count": len(rows),
        }

    except HTTPException:
        raise
    except Exception as exc:
        print(f"Conversation list failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Unable to load conversations.",
        ) from exc


@app.get("/api/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    before: str | None = Query(default=None, max_length=100),
    user: dict = Depends(get_current_user),
):
    """Read messages only if the signed-in user is a participant."""
    try:
        with get_connection() as connection:
            profile_id = get_profile_id(connection, user)

            conversation = require_conversation_participant(
                connection,
                conversation_id,
                profile_id,
            )

            query = """
                SELECT id, conversation_id, sender_id, body, created_at
                FROM messages
                WHERE conversation_id = %s
            """
            params: list = [str(conversation["id"])]

            if before:
                try:
                    before_uuid = str(uuid.UUID(before))
                except (ValueError, TypeError, AttributeError) as exc:
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid message cursor.",
                    ) from exc

                query += " AND created_at < (SELECT created_at FROM messages WHERE id = %s)"
                params.append(before_uuid)

            query += " ORDER BY created_at DESC LIMIT %s"
            params.append(limit)

            rows = connection.execute(query, params).fetchall()

        rows.reverse()

        return {
            "items": [
                {
                    **row,
                    "id": str(row["id"]),
                    "conversation_id": str(row["conversation_id"]),
                    "sender_id": str(row["sender_id"]),
                    "created_at": (
                        row["created_at"].isoformat()
                        if row["created_at"]
                        else None
                    ),
                    "is_mine": str(row["sender_id"]) == profile_id,
                }
                for row in rows
            ],
            "count": len(rows),
        }

    except HTTPException:
        raise
    except Exception as exc:
        print(f"Conversation messages query failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Unable to load conversation messages.",
        ) from exc


@app.post("/api/conversations/{conversation_id}/messages", status_code=201)
def send_conversation_message(
    conversation_id: str,
    payload: MessageCreate,
    user: dict = Depends(get_current_user),
):
    """Send a message as the authenticated conversation participant."""
    body = payload.body.strip()

    if not body:
        raise HTTPException(
            status_code=422,
            detail="Message cannot be empty.",
        )

    try:
        with get_connection() as connection:
            with connection.transaction():
                profile_id = get_profile_id(connection, user)

                conversation = require_conversation_participant(
                    connection,
                    conversation_id,
                    profile_id,
                )

                message = connection.execute(
                    """
                    INSERT INTO messages (
                        conversation_id,
                        sender_id,
                        body
                    )
                    VALUES (%s, %s, %s)
                    RETURNING id, conversation_id, sender_id, body, created_at
                    """,
                    (
                        str(conversation["id"]),
                        profile_id,
                        body,
                    ),
                ).fetchone()

                connection.execute(
                    """
                    UPDATE conversations
                    SET updated_at = NOW()
                    WHERE id = %s
                    """,
                    (str(conversation["id"]),),
                )

        return {
            "message": {
                **message,
                "id": str(message["id"]),
                "conversation_id": str(message["conversation_id"]),
                "sender_id": str(message["sender_id"]),
                "created_at": (
                    message["created_at"].isoformat()
                    if message["created_at"]
                    else None
                ),
                "is_mine": True,
            }
        }

    except HTTPException:
        raise
    except Exception as exc:
        print(f"Send message failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Unable to send message.",
        ) from exc