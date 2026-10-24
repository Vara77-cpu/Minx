
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Heart,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  X,
  Zap,
} from "lucide-react";
import { getListings, type MinxListing } from "@/lib/api";

const HeroScene = dynamic(() => import("@/components/HeroScene"), {
  ssr: false,
  loading: () => <div className="hero-scene scene-loading" />,
});

const categories = [
  { name: "Mobiles", icon: "📱", count: "2.4k listings" },
  { name: "Electronics", icon: "🎧", count: "1.8k listings" },
  { name: "Vehicles", icon: "🏍️", count: "960 listings" },
  { name: "Fashion", icon: "👟", count: "1.2k listings" },
  { name: "Home & Living", icon: "🛋️", count: "840 listings" },
  { name: "Gaming", icon: "🎮", count: "620 listings" },
];

const heroPhrases = ["New stories.", "Fresh finds.", "Smart choices."];

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All items");
  const [favorites, setFavorites] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [products, setProducts] = useState<MinxListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % heroPhrases.length);
    }, 2800);

    return () => window.clearInterval(interval);
  }, []);

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
    });
  }

  return (
    <main className="minx-app">
      {/* Scrolling announcement bar */}
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

      {/* Navigation */}
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
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
        </nav>

        <div className="header-actions">
          <button
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

          <button
            className="sell-button"
            onClick={() =>
              window.alert(
                "Seller accounts will be enabled in the next development step.",
              )
            }
          >
            <span>Sell an item</span>
            <ArrowUpRight size={16} />
          </button>

          <button
            className="mobile-menu-button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      {/* Hero */}
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
            <button className="primary-cta" onClick={scrollToListings}>
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

      {/* Trust strip */}
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

      {/* Categories */}
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

      {/* API-driven marketplace listings */}
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
                className="clear-search"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                type="button"
              >
                <X size={15} />
              </button>
            )}
          </label>

          <button
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
            <button className="primary-cta" onClick={() => void loadProducts()}>
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
                    <img
                      src={product.image}
                      alt={product.title}
                      loading="lazy"
                    />
                    <span className="product-tag">{product.tag}</span>

                    <button
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

      {/* Seller promotion */}
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
            That thing you don&apos;t use anymore? Someone else might be
            looking for exactly that.
          </p>
          <button
            className="sell-banner-button"
            onClick={() =>
              window.alert(
                "The seller listing flow will be enabled after authentication and backend integration.",
              )
            }
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

      {/* Footer */}
      <footer className="site-footer">
        <a className="brand footer-brand" href="#">
          <span className="brand-mark">M</span>
          <span>
            MINX<span className="brand-period">.</span>
          </span>
        </a>
        <p>GOOD STUFF DESERVES A SECOND LIFE.</p>
        <span className="footer-copyright">
          © {new Date().getFullYear()} MINX Marketplace
        </span>
      </footer>
    </main>
  );
}
