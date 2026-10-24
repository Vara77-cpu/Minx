
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="MINX API",
    description="Backend API for the MINX resale marketplace",
    version="0.2.0",
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

CATEGORIES = [
    {"id": "mobiles", "name": "Mobiles"},
    {"id": "electronics", "name": "Electronics"},
    {"id": "vehicles", "name": "Vehicles"},
    {"id": "fashion", "name": "Fashion"},
    {"id": "home-living", "name": "Home & Living"},
    {"id": "gaming", "name": "Gaming"},
]

LISTINGS = [
    {
        "id": 1,
        "title": "iPhone 14 · 128 GB",
        "category": "Mobiles",
        "category_id": "mobiles",
        "price": 38999,
        "oldPrice": 49900,
        "condition": "Like new",
        "location": "Visakhapatnam",
        "time": "12 min ago",
        "image": "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=85",
        "color": "product-lime",
        "tag": "GREAT DEAL",
    },
    {
        "id": 2,
        "title": "Sony WH-1000XM5",
        "category": "Electronics",
        "category_id": "electronics",
        "price": 16999,
        "oldPrice": 29990,
        "condition": "Excellent",
        "location": "Vizianagaram",
        "time": "28 min ago",
        "image": "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=85",
        "color": "product-purple",
        "tag": "POPULAR",
    },
    {
        "id": 3,
        "title": "Minimal sneakers",
        "category": "Fashion",
        "category_id": "fashion",
        "price": 1899,
        "oldPrice": 3499,
        "condition": "Gently used",
        "location": "Bobbili",
        "time": "46 min ago",
        "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85",
        "color": "product-orange",
        "tag": "PRICE DROP",
    },
    {
        "id": 4,
        "title": "Mechanical gaming keyboard",
        "category": "Gaming",
        "category_id": "gaming",
        "price": 2499,
        "oldPrice": 4299,
        "condition": "Excellent",
        "location": "Visakhapatnam",
        "time": "1 hr ago",
        "image": "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=900&q=85",
        "color": "product-blue",
        "tag": "GREAT DEAL",
    },
]


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "minx-api",
        "status": "running",
    }


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "minx-api",
    }


@app.get("/api/categories")
async def get_categories() -> list[dict[str, str]]:
    return CATEGORIES


@app.get("/api/listings")
async def get_listings(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    items = LISTINGS

    if search and search.strip():
        term = search.strip().casefold()
        items = [
            item
            for item in items
            if term in item["title"].casefold()
            or term in item["category"].casefold()
            or term in item["location"].casefold()
        ]

    if category and category.casefold() not in {"all", "all items"}:
        items = [
            item
            for item in items
            if category.casefold()
            in {
                item["category"].casefold(),
                item["category_id"].casefold(),
            }
        ]

    total = len(items)

    return {
        "items": items[offset : offset + limit],
        "total": total,
        "limit": limit,
        "offset": offset,
    }
