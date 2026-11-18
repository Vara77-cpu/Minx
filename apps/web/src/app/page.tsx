"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import dynamic from "next/dynamic";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

import {

  ArrowDownRight,

  ArrowRight,

  ArrowUpRight,

  Check,

  ChevronDown,

  Heart,

  LogOut,

  MapPin,

  Menu,

  Search,

  ShieldCheck,

  SlidersHorizontal,

  Sparkles,

  Tag,

  UserRound,

  X,

  Zap,

} from "lucide-react";

import { getListings, type MinxListing } from "@/lib/api";

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  theme?: { color?: string };
  prefill?: { email?: string };
  config?: {
    display?: {
      blocks?: {
        upi?: {
          name: string;
          instruments: { method: "upi" }[];
        };
      };
      sequence?: string[];
      preferences?: {
        show_default_blocks?: boolean;
      };
    };
  };
  modal?: { ondismiss?: () => void };
  handler: (
    response: RazorpaySuccessResponse
  ) => void | Promise<void>;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error?: { description?: string; reason?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const HeroScene = dynamic(() => import("@/components/HeroScene"), {

  ssr: false,

  loading: () => <div className="hero-scene scene-loading" />,

});

const categories = [

  { name: "Mobiles", icon: "📱", count: "2.4k listings", id: "mobiles" },

  { name: "Electronics", icon: "🎧", count: "1.8k listings", id: "electronics" },

  { name: "Vehicles", icon: "🏍️", count: "960 listings", id: "vehicles" },

  { name: "Fashion", icon: "👟", count: "1.2k listings", id: "fashion" },

  {

    name: "Home & Living",

    icon: "🛋️",

    count: "840 listings",

    id: "home-living",

  },

  { name: "Gaming", icon: "🎮", count: "620 listings", id: "gaming" },

];

const heroPhrases = ["New stories.", "Fresh finds.", "Smart choices."];

const formatPrice = (price: number) =>

  new Intl.NumberFormat("en-IN", {

    style: "currency",

    currency: "INR",

    maximumFractionDigits: 0,

  }).format(price);

export default function HomePage() {

  const router = useRouter();

  const [search, setSearch] = useState("");

  const [activeCategory, setActiveCategory] = useState("All items");

  const [favorites, setFavorites] = useState<number[]>([]);

  const [menuOpen, setMenuOpen] = useState(false);

  const [products, setProducts] = useState<MinxListing[]>([]);

  const [loading, setLoading] = useState(true);

  const [apiError, setApiError] = useState("");

  const [phraseIndex, setPhraseIndex] = useState(0);

  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);

  const [authReady, setAuthReady] = useState(false);

  const [signingOut, setSigningOut] = useState(false);

  const [sellFormOpen, setSellFormOpen] = useState(false);

  const [sellSubmitting, setSellSubmitting] = useState(false);

  const [sellMessage, setSellMessage] = useState("");

  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const openSellForm = useCallback(() => {

    setSellMessage("");

    setSellFormOpen(true);

  }, []);

  const clearSelectedImages = useCallback(() => {
    setSelectedImages([]);
    setImagePreviews((currentPreviews) => {
      currentPreviews.forEach((preview) => URL.revokeObjectURL(preview));
      return [];
    });
    if (imageInputRef.current) imageInputRef.current.value = "";
  }, []);

  const closeSellForm = useCallback(() => {
    if (sellSubmitting) return;
    setSellFormOpen(false);
    setSellMessage("");
    clearSelectedImages();
  }, [sellSubmitting, clearSelectedImages]);

  useEffect(() => {

    let mounted = true;

    const syncAuthUser = async () => {

      const {

        data: { session },

        error,

      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {

        setAuthUserEmail(null);

      } else {

        setAuthUserEmail(session?.user?.email ?? null);

      }

      setAuthReady(true);

    };

    void syncAuthUser();

    const {

      data: { subscription },

    } = supabase.auth.onAuthStateChange((_event, session) => {

      setAuthUserEmail(session?.user?.email ?? null);

      setAuthReady(true);

    });

    return () => {

      mounted = false;

      subscription.unsubscribe();

    };

  }, []);

  async function handleSignOut() {

    if (signingOut) return;

    setSigningOut(true);

    try {

      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      setAuthUserEmail(null);

      setMenuOpen(false);

      setSellMessage("");

      router.push("/");

      router.refresh();

    } catch (error) {

      window.alert(

        error instanceof Error

          ? error.message

          : "Unable to log out. Please try again.",

      );

    } finally {

      setSigningOut(false);

    }

  }

  useEffect(() => {

    const interval = window.setInterval(() => {

      setPhraseIndex((current) => (current + 1) % heroPhrases.length);

    }, 2800);

    return () => window.clearInterval(interval);

  }, []);

  useEffect(() => {

    if (!sellFormOpen) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {

      if (event.key === "Escape" && !sellSubmitting) {

        setSellFormOpen(false);

        setSellMessage("");

        clearSelectedImages();

      }

    }

    window.addEventListener("keydown", handleEscape);

    return () => {

      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleEscape);

    };

  }, [sellFormOpen, sellSubmitting, clearSelectedImages]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [imagePreviews]);

  const loadProducts = useCallback(async () => {

    setLoading(true);

    setApiError("");

    try {

      const response = await getListings({ limit: 100 });

      setProducts(response.items);

    } catch (error) {

      setApiError(

        error instanceof Error

          ? error.message

          : "Unable to load marketplace listings.",

      );

    } finally {

      setLoading(false);

    }

  }, []);

  useEffect(() => {

    void loadProducts();

  }, [loadProducts]);

  const filteredProducts = useMemo(() => {

    const query = search.trim().toLowerCase();

    return products.filter((product) => {

      const matchesSearch =

        !query ||

        product.title.toLowerCase().includes(query) ||

        product.category.toLowerCase().includes(query) ||

        product.location.toLowerCase().includes(query);

      const matchesCategory =

        activeCategory === "All items" ||

        product.category.toLowerCase() === activeCategory.toLowerCase();

      return matchesSearch && matchesCategory;

    });

  }, [products, search, activeCategory]);

  function toggleFavorite(id: number) {

    setFavorites((current) =>

      current.includes(id)

        ? current.filter((item) => item !== id)

        : [...current, id],

    );

  }

  function scrollToListings() {

    document.getElementById("listings")?.scrollIntoView({

      behavior: "smooth",

      block: "start",

    });

  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (files.length > 6) {
      setSellMessage("Choose a maximum of 6 product photos.");
      event.target.value = "";
      return;
    }
    const invalidFile = files.find((file) => !allowedTypes.includes(file.type));
    if (invalidFile) {
      setSellMessage("Choose JPG, PNG, or WebP images only.");
      event.target.value = "";
      return;
    }
    const oversizedFile = files.find((file) => file.size > 5 * 1024 * 1024);
    if (oversizedFile) {
      setSellMessage("Each image must be 5 MB or less.");
      event.target.value = "";
      return;
    }

    imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    setSelectedImages(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
    setSellMessage("");
  }

  async function handleSellSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sellSubmitting) return;

    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const listing = {
      title: String(formData.get("title") ?? "").trim(),
      category_id: String(formData.get("category_id") ?? ""),
      price: Number(formData.get("price")),
      condition: String(formData.get("condition") ?? "Good"),
      location: String(formData.get("location") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
    };

    if (selectedImages.length < 1 || selectedImages.length > 6) {
      setSellMessage("Please select between 1 and 6 product photos.");
      return;
    }
    if (
      listing.title.length < 3 ||
      !listing.category_id ||
      !Number.isFinite(listing.price) ||
      listing.price <= 0 ||
      !listing.location ||
      listing.description.length < 10
    ) {
      setSellMessage("Please check all fields and try again.");
      return;
    }

    setSellSubmitting(true);
    setSellMessage("Preparing secure checkout...");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      const accessToken = session?.access_token;

      if (!accessToken) {
        setSellMessage("Please sign in before publishing your listing.");
        router.push("/auth");
        return;
      }

      const apiUrl = (
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      ).replace(/\/+$/, "");

      const uploadData = new FormData();
      uploadData.append("title", listing.title);
      uploadData.append("category_id", listing.category_id);
      uploadData.append("price", String(listing.price));
      uploadData.append("condition", listing.condition);
      uploadData.append("location", listing.location);
      uploadData.append("description", listing.description);
      selectedImages.forEach((image) => uploadData.append("images", image));

      const checkoutResponse = await fetch(`${apiUrl}/api/listings/checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: uploadData,
      });
      const checkout = await checkoutResponse.json().catch(() => null);

      if (!checkoutResponse.ok) {
        if (checkoutResponse.status === 401) {
          await supabase.auth.signOut();
          router.push("/auth");
          throw new Error("Your session expired. Please sign in again.");
        }
        throw new Error(
          typeof checkout?.detail === "string"
            ? checkout.detail
            : "Unable to prepare checkout. Please try again.",
        );
      }

      if (
        !checkout?.key_id ||
        !checkout?.order_id ||
        !Number.isFinite(Number(checkout?.amount))
      ) {
        throw new Error("Checkout details were incomplete. Please try again.");
      }

      setSellMessage("Opening Razorpay secure checkout...");

      const loadRazorpay = async (): Promise<boolean> => {
        if (window.Razorpay) return true;
        const existingScript = document.querySelector<HTMLScriptElement>(
          'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
        );
        if (existingScript?.dataset.loaded === "true") return Boolean(window.Razorpay);

        await new Promise<void>((resolve, reject) => {
          const script = existingScript ?? document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.async = true;
          script.onload = () => {
            script.dataset.loaded = "true";
            resolve();
          };
          script.onerror = () => reject(new Error("Could not load Razorpay checkout. Check your internet connection."));
          if (!existingScript) document.body.appendChild(script);
        });
        return Boolean(window.Razorpay);
      };

      const scriptLoaded = await loadRazorpay();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Razorpay checkout could not be initialized. Please try again.");
      }

      await new Promise<void>((resolve, reject) => {
        let verificationStarted = false;
        const razorpay = new window.Razorpay!({
          key: checkout.key_id,
          amount: Number(checkout.amount),
          currency: checkout.currency || "INR",
          name: "MINX Marketplace",
          description: `Listing publication fee — ₹${checkout.fee_inr ?? 79}`,
          order_id: checkout.order_id,

config: {
  display: {
    blocks: {
      upi: {
        name: "Pay using UPI",
        instruments: [
          { method: "upi" },
        ],
      },
    },
    sequence: ["block.upi"],
    preferences: {
      show_default_blocks: true,
    },
  },
},

prefill: {
  email: session?.user?.email ?? undefined,
},

theme: { color: "#b6ff35" },
          handler: async (paymentResponse) => {
            if (verificationStarted) return;
            verificationStarted = true;
            setSellMessage("Payment received. Verifying securely...");
            try {
              const verifyResponse = await fetch(`${apiUrl}/api/payments/verify`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(paymentResponse),
              });
              const verification = await verifyResponse.json().catch(() => null);
              if (!verifyResponse.ok) {
                throw new Error(
                  typeof verification?.detail === "string"
                    ? verification.detail
                    : "Payment verification failed. Contact support before paying again.",
                );
              }

              setSellMessage(
                "Payment verified! Your listing is submitted for admin review and will appear after approval.",
              );
              await loadProducts();
              form.reset();
              clearSelectedImages();
              window.setTimeout(() => {
                setSellFormOpen(false);
                setSellMessage("");
                scrollToListings();
              }, 2200);
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error("Payment verification failed."));
            }
          },
          modal: {
            ondismiss: () => {
              if (!verificationStarted) {
                reject(new Error("Checkout was closed before payment was completed. Your listing has not been published."));
              }
            },
          },
        });
        razorpay.on("payment.failed", (response) => {
          reject(new Error(response.error?.description || "Payment failed. Please try again."));
        });
        razorpay.open();
      });
    } catch (error) {
      setSellMessage(
        error instanceof Error
          ? error.message
          : "Could not connect to the server. Check that the backend is running.",
      );
    } finally {
      setSellSubmitting(false);
    }
  }

  return (

    <main className="minx-app">

      <div className="announcement">

        <div className="announcement-track">

          {[1, 2].map((copy) => (

            <div className="announcement-group" key={copy}>

              <span className="announcement-dot" />

              <span>YOUR NEXT GREAT FIND IS CLOSER THAN YOU THINK</span>

              <ArrowUpRight size={13} />

              <span className="announcement-divider">✦</span>

              <span>GIVE GREAT FINDS A NEW HOME</span>

              <ArrowUpRight size={13} />

              <span className="announcement-divider">✦</span>

              <span>BETTER DEALS. SMARTER CHOICES.</span>

              <ArrowUpRight size={13} />

            </div>

          ))}

        </div>

      </div>

      <header className="site-header">

        <a className="brand" href="#" aria-label="MINX home">

          <span className="brand-mark">M</span>

          <span>

            MINX<span className="brand-period">.</span>

          </span>

        </a>

        <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`}>
  <a href="#categories" onClick={() => setMenuOpen(false)}>
    Explore
  </a>

  <a href="#listings" onClick={() => setMenuOpen(false)}>
    Marketplace
  </a>

  {authReady && authUserEmail && (
    <a href="/seller" onClick={() => setMenuOpen(false)}>
      My Listings
    </a>
  )}

  <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
    How it works
  </a>
</nav>
        <div className="header-actions">

          <button

            type="button"

            className="location-button"

            onClick={() => {

              const place = window.prompt("Enter your city or area:");

              if (place?.trim()) {

                setSearch(place.trim());

                scrollToListings();

              }

            }}

          >

            <MapPin size={15} />

            <span>India</span>

            <ChevronDown size={14} />

          </button>

          {authReady && authUserEmail ? (

            <button

              type="button"

              className="account-button"

              onClick={() => void handleSignOut()}

              disabled={signingOut}

              title={`Signed in as ${authUserEmail}`}

              aria-label={`Log out ${authUserEmail}`}

            >

              <LogOut size={16} />

              <span>{signingOut ? "Logging out..." : "Log out"}</span>

            </button>

          ) : (

            <button

              type="button"

              className="account-button"

              onClick={() => router.push("/auth")}

              disabled={!authReady}

            >

              <UserRound size={16} />

              <span>{authReady ? "Sign in" : "Loading..."}</span>

            </button>

          )}

          <button

            type="button"

            className="sell-button"

            onClick={openSellForm}

          >

            <span>Sell an item</span>

            <ArrowUpRight size={16} />

          </button>

          <button

            type="button"

            className="mobile-menu-button"

            aria-label={menuOpen ? "Close menu" : "Open menu"}

            aria-expanded={menuOpen}

            onClick={() => setMenuOpen((open) => !open)}

          >

            {menuOpen ? <X size={21} /> : <Menu size={21} />}

          </button>

        </div>

      </header>

      <section className="hero-section">

        <div className="hero-grid-pattern" />

        <div className="hero-copy">

          <div className="eyebrow">

            <Sparkles size={14} />

            THE SMARTER WAY TO SECOND-HAND

          </div>

          <h1 className="hero-headline">

            <span className="headline-line headline-line-one">

              Good stuff.

            </span>

            <span className="headline-line headline-line-two">

              Better prices.

            </span>

            <span className="headline-line headline-rotating">

              <span

                key={phraseIndex}

                className="rotating-phrase"

                aria-live="polite"

              >

                {heroPhrases[phraseIndex]}

              </span>

              <span className="headline-cursor" aria-hidden="true" />

            </span>

          </h1>

          <p className="hero-description">

            The things you want. The deals you love. Discover pre-loved finds

            and give great stuff a second life with MINX.

          </p>

          <div className="hero-buttons">

            <button

              type="button"

              className="primary-cta"

              onClick={scrollToListings}

            >

              Explore marketplace

              <ArrowRight size={17} />

            </button>

            <a className="secondary-cta" href="#how-it-works">

              How MINX works <ArrowDownRight size={16} />

            </a>

          </div>

          <div className="hero-proof">

            <div className="proof-avatars" aria-hidden="true">

              <span>V</span>

              <span>A</span>

              <span>M</span>

              <span>+</span>

            </div>

            <div>

              <div className="proof-stars">★★★★★</div>

              <p>Great finds start here</p>

            </div>

          </div>

        </div>

        <div className="hero-visual">

          <div className="visual-orbit orbit-one" />

          <div className="visual-orbit orbit-two" />

          <div className="floating-label label-top">

            <span className="label-icon">

              <Zap size={15} />

            </span>

            <span>

              <strong>Smart deals</strong>

              <small>More value, less spend</small>

            </span>

          </div>

          <HeroScene />

          <div className="floating-label label-bottom">

            <span className="label-check">

              <Check size={15} />

            </span>

            <span>

              <strong>Ready for round two</strong>

              <small>Give great finds a new home</small>

            </span>

          </div>

          <div className="visual-caption">THE ART OF A GOOD FIND — 001</div>

        </div>

        <div className="hero-bottom-note">

          <span className="live-dot" />

          DISCOVER SOMETHING DIFFERENT

          <span className="note-divider" />

          BUY BETTER. LIVE BETTER.

        </div>

      </section>

      <section className="trust-strip" id="how-it-works">

        <div className="trust-item">

          <ShieldCheck size={20} />

          <span>

            <strong>Buy with confidence</strong>

            <small>Safer marketplace practices</small>

          </span>

        </div>

        <div className="trust-item">

          <Tag size={20} />

          <span>

            <strong>Deals worth finding</strong>

            <small>Discover pre-loved value</small>

          </span>

        </div>

        <div className="trust-item">

          <Zap size={20} />

          <span>

            <strong>Less waste, more value</strong>

            <small>Give good things a second life</small>

          </span>

        </div>

      </section>

      <section className="categories-section" id="categories">

        <div className="section-heading">

          <div>

            <div className="eyebrow section-eyebrow">YOUR NEXT OBSESSION</div>

            <h2>

              Explore <span>by category.</span>

            </h2>

          </div>

          <p>Different finds. Different stories. One place.</p>

        </div>

        <div className="category-grid">

          {categories.map((category, index) => (

            <button

              type="button"

              className={`category-card category-card-${index + 1}`}

              key={category.name}

              onClick={() => {

                setActiveCategory(category.name);

                scrollToListings();

              }}

            >

              <span className="category-icon">{category.icon}</span>

              <span className="category-info">

                <strong>{category.name}</strong>

                <small>{category.count}</small>

              </span>

              <ArrowUpRight className="category-arrow" size={17} />

            </button>

          ))}

        </div>

      </section>

      <section className="listings-section" id="listings">

        <div className="section-heading listings-heading">

          <div>

            <div className="eyebrow section-eyebrow">

              GOOD FINDS, RIGHT NOW

            </div>

            <h2>

              Fresh on <span>MINX.</span>

            </h2>

          </div>

          <span className="listing-count">

            {loading

              ? "LOADING"

              : `${String(filteredProducts.length).padStart(2, "0")} ITEMS`}

          </span>

        </div>

        <div className="marketplace-toolbar">

          <label className="marketplace-search">

            <Search size={19} />

            <input

              value={search}

              onChange={(event) => setSearch(event.target.value)}

              placeholder="Search mobiles, sneakers, headphones..."

              aria-label="Search listings"

            />

            {search && (

              <button

                type="button"

                className="clear-search"

                onClick={() => setSearch("")}

                aria-label="Clear search"

              >

                <X size={15} />

              </button>

            )}

          </label>

          <button

            type="button"

            className="filter-button"

            onClick={() => {

              setActiveCategory("All items");

              setSearch("");

            }}

          >

            <SlidersHorizontal size={16} />

            Reset filters

          </button>

        </div>

        <div className="filter-chips">

          {["All items", ...categories.map((item) => item.name)].map(

            (category) => (

              <button

                type="button"

                key={category}

                className={`filter-chip ${

                  activeCategory === category ? "filter-chip-active" : ""

                }`}

                onClick={() => setActiveCategory(category)}

              >

                {category}

              </button>

            ),

          )}

        </div>

        {loading ? (

          <div className="empty-state" role="status">

            <Search size={30} />

            <h3>Finding good stuff...</h3>

            <p>Loading the latest listings from MINX.</p>

          </div>

        ) : apiError ? (

          <div className="empty-state" role="alert">

            <X size={30} />

            <h3>We couldn&apos;t load the marketplace.</h3>

            <p>{apiError}</p>

            <button

              type="button"

              className="primary-cta"

              onClick={() => void loadProducts()}

            >

              Try again <ArrowRight size={16} />

            </button>

          </div>

        ) : filteredProducts.length > 0 ? (

          <div className="product-grid">

            {filteredProducts.map((product) => {

              const isFavorite = favorites.includes(product.id);

              return (

                <article className="product-card" key={product.id}>

                  <div className={`product-image ${product.color}`}>

                    {product.image ? (

                      <img

                        src={product.image || undefined}

                        alt={product.title}

                        loading="lazy"

                      />

                    ) : (

                      <div

                        className="product-image-placeholder"

                        role="img"

                        aria-label={`No image available for ${product.title}`}

                      >

                        <span>MINX.</span>

                        <small>IMAGE COMING SOON</small>

                      </div>

                    )}

                    <span className="product-tag">{product.tag}</span>

                    <button

                      type="button"

                      className={`favorite-button ${

                        isFavorite ? "favorite-active" : ""

                      }`}

                      onClick={() => toggleFavorite(product.id)}

                      aria-label={

                        isFavorite

                          ? `Remove ${product.title} from favorites`

                          : `Add ${product.title} to favorites`

                      }

                    >

                      <Heart

                        size={18}

                        fill={isFavorite ? "currentColor" : "none"}

                      />

                    </button>

                    <span className="condition-badge">

                      {product.condition}

                    </span>

                  </div>

                  <div className="product-details">

                    <div className="product-category">{product.category}</div>

                    <h3>{product.title}</h3>

                    <div className="product-price-row">

                      <strong>{formatPrice(product.price)}</strong>

                      <del>{formatPrice(product.oldPrice)}</del>

                    </div>

                    <div className="product-meta">

                      <span>

                        <MapPin size={13} />

                        {product.location}

                      </span>

                      <span>{product.time}</span>

                    </div>

                    <button

                      type="button"

                      className="product-contact"

                      onClick={() =>

                        window.alert(

                          "Buyer–seller messaging will be enabled in a later step.",

                        )

                      }

                    >

                      View item <ArrowUpRight size={15} />

                    </button>

                  </div>

                </article>

              );

            })}

          </div>

        ) : (

          <div className="empty-state">

            <Search size={30} />

            <h3>No matching finds yet.</h3>

            <p>Try a different search or choose another category.</p>

            <button

              type="button"

              className="primary-cta"

              onClick={() => {

                setSearch("");

                setActiveCategory("All items");

              }}

            >

              Show all items <ArrowRight size={16} />

            </button>

          </div>

        )}

        <div className="listing-footer">

          <p>GOOD FINDS DON&apos;T STAY LONG.</p>

          <button

            type="button"

            className="text-link"

            onClick={() => {

              setActiveCategory("All items");

              setSearch("");

            }}

          >

            Explore all finds <ArrowRight size={16} />

          </button>

        </div>

      </section>

      <section className="sell-banner">

        <div className="sell-banner-glow" />

        <div className="sell-banner-copy">

          <div className="eyebrow">

            <Sparkles size={14} /> YOUR STUFF HAS A SECOND STORY

          </div>

          <h2>

            Make space.

            <br />

            <span>Make someone&apos;s day.</span>

          </h2>

          <p>

            That thing you don&apos;t use anymore? Someone else might be looking

            for exactly that.

          </p>

          <button

            type="button"

            className="sell-banner-button"

            onClick={openSellForm}

          >

            Start selling <ArrowUpRight size={17} />

          </button>

        </div>

        <div className="sell-banner-art" aria-hidden="true">

          <div className="sell-art-ring" />

          <div className="sell-art-circle">M</div>

          <span className="sell-art-star">✳</span>

          <span className="sell-art-plus">+</span>

          <span className="sell-art-caption">PASS IT ON.</span>

        </div>

      </section>

      {sellFormOpen && (

        <div

          className="sell-modal-backdrop"

          onMouseDown={(event) => {

            if (event.target === event.currentTarget) closeSellForm();

          }}

        >

          <section

            className="sell-modal"

            role="dialog"

            aria-modal="true"

            aria-labelledby="sell-modal-title"

          >

            <button

              type="button"

              className="sell-modal-close"

              onClick={closeSellForm}

              aria-label="Close listing form"

              disabled={sellSubmitting}

            >

              <X size={19} />

            </button>

            <p className="sell-modal-eyebrow">SELL ON MINX</p>

            <h2 id="sell-modal-title">Give it a new story.</h2>

            <p className="sell-modal-description">

              Share a few details about your item to get your listing ready.

            </p>

            <form className="sell-form" onSubmit={handleSellSubmit}>

              <label>

                Item title

                <input

                  name="title"

                  type="text"

                  required

                  minLength={3}

                  maxLength={120}

                  placeholder="e.g. iPhone 14, barely used"

                />

              </label>

              <label>

                Product photos (1–6)

                <input
                  ref={imageInputRef}
                  name="images"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageChange}
                  required
                />

                <small>
                  Choose 1–6 JPG, PNG or WebP photos. Maximum 5 MB per photo.
                  The ₹79 listing fee is charged through Razorpay test checkout.
                </small>

                {imagePreviews.length > 0 && (
                  <div className="sell-image-preview-grid">
                    {imagePreviews.map((preview, index) => (
                      <div className="sell-image-preview" key={preview}>
                        <img src={preview} alt={`Selected product preview ${index + 1}`} />
                        <div className="sell-image-preview-info">
                          <strong>{selectedImages[index]?.name}</strong>
                          <small>
                            {selectedImages[index]
                              ? `${(selectedImages[index].size / 1024 / 1024).toFixed(2)} MB`
                              : ""}
                          </small>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="sell-image-remove-all"
                      onClick={clearSelectedImages}
                      disabled={sellSubmitting}
                    >
                      Remove all photos
                    </button>
                  </div>
                )}

              </label>

              <label>

                Category

                <select name="category_id" required defaultValue="">

                  <option value="" disabled>

                    Select a category

                  </option>

                  {categories.map((category) => (

                    <option key={category.id} value={category.id}>

                      {category.name}

                    </option>

                  ))}

                </select>

              </label>

              <div className="sell-form-row">

                <label>

                  Price (₹)

                  <input

                    name="price"

                    type="number"

                    min="1"

                    max="100000000"

                    step="1"

                    required

                    placeholder="2500"

                  />

                </label>

                <label>

                  Condition

                  <select name="condition" required defaultValue="Good">

                    <option value="New">New</option>

                    <option value="Like New">Like New</option>

                    <option value="Good">Good</option>

                    <option value="Fair">Fair</option>

                  </select>

                </label>

              </div>

              <label>

                Location

                <input

                  name="location"

                  type="text"

                  required

                  minLength={2}

                  maxLength={120}

                  placeholder="e.g. Bobbili, Andhra Pradesh"

                />

              </label>

              <label>

                Description

                <textarea

                  name="description"

                  required

                  minLength={10}

                  maxLength={2000}

                  rows={4}

                  placeholder="Describe the item, its features and condition..."

                />

              </label>

              <button

                className="sell-form-submit"

                type="submit"

                disabled={sellSubmitting}

              >

                {sellSubmitting

                  ? "Uploading and publishing..."

                  : "Publish listing"}

                <ArrowUpRight size={17} />

              </button>

              {sellMessage && (

                <p className="sell-form-message" role="status">

                  {sellMessage}

                </p>

              )}

              <p className="sell-form-footnote">

                Your product photo will be uploaded to MINX storage and saved

                with your listing.

              </p>

            </form>

          </section>

        </div>

      )}

      <footer className="site-footer">

        <a className="brand footer-brand" href="#">

          <span className="brand-mark">M</span>

          <span>

            MINX<span className="brand-period">.</span>

          </span>

        </a>

        <p>GOOD FINDS DESERVE A SECOND LIFE.</p>

        <span className="footer-copyright">

          © {new Date().getFullYear()} MINX Marketplace

        </span>

      </footer>

    </main>

  );

}
