"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Package,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  XCircle,
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ListingImage = {
  url: string;
  display_order?: number;
};

type SellerListing = {
  id: string | number;
  title: string;
  description?: string | null;
  category?: string | null;
  category_id?: string | null;
  price: number | string;
  condition?: string | null;
  location?: string | null;
  status?: string | null;
  created_at?: string | null;
  images?: ListingImage[] | null;
  payment_status?: string | null;
  review_status?: string | null;
  rejection_reason?: string | null;
};

type ListingsResponse = {
  items: SellerListing[];
  count: number;
};

type ListingFilter = "all" | "active" | "pending" | "rejected" | "removed";
type ListingSort = "newest" | "oldest" | "price-high" | "price-low" | "title";

type EditForm = {
  title: string;
  price: string;
  condition: string;
  location: string;
  description: string;
};

function normalizedStatus(listing: SellerListing) {
  const status = (listing.status || "").toLowerCase();
  const review = (listing.review_status || "").toLowerCase();

  if (status === "active" || review === "approved") return "active";
  if (status === "rejected" || review === "rejected") return "rejected";
  if (status === "removed") return "removed";
  if (status === "pending_review" || review === "pending_review") {
    return "pending";
  }

  return status || "pending";
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: {
      label: "Active",
      className: "border-lime-300/20 bg-lime-300/10 text-lime-200",
    },
    pending: {
      label: "Pending review",
      className: "border-amber-300/20 bg-amber-300/10 text-amber-200",
    },
    rejected: {
      label: "Rejected",
      className: "border-red-300/20 bg-red-300/10 text-red-200",
    },
    removed: {
      label: "Removed",
      className: "border-white/10 bg-white/5 text-white/50",
    },
  };

  const item = config[status] ?? {
    label: status.replaceAll("_", " "),
    className: "border-white/10 bg-white/5 text-white/65",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${item.className}`}
    >
      {item.label}
    </span>
  );
}

export default function SellerDashboardPage() {
  const router = useRouter();

  const [listings, setListings] = useState<SellerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [listingFilter, setListingFilter] = useState<ListingFilter>("all");
  const [listingSearch, setListingSearch] = useState("");
  const [listingSort, setListingSort] = useState<ListingSort>("newest");
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingListing, setEditingListing] =
    useState<SellerListing | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    title: "",
    price: "",
    condition: "Good",
    location: "",
    description: "",
  });

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw new Error(sessionError.message);

      if (!session?.access_token) {
        setSignedIn(false);
        router.replace("/auth");
        return;
      }

      setSignedIn(true);

      const response = await fetch(`${API_BASE_URL}/api/my/listings`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      if (response.status === 401) {
        throw new Error(
          "Your session could not be verified by the server. Please sign in again.",
        );
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Unable to load your listings (${response.status}). ${body.slice(0, 200)}`,
        );
      }

      const result = (await response.json()) as ListingsResponse;
      setListings(Array.isArray(result.items) ? result.items : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading your listings.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadListings();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setSignedIn(false);
        router.replace("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [loadListings, router]);

  const activeCount = listings.filter(
    (item) => normalizedStatus(item) === "active",
  ).length;

  const pendingCount = listings.filter(
    (item) => normalizedStatus(item) === "pending",
  ).length;

  const rejectedCount = listings.filter(
    (item) => normalizedStatus(item) === "rejected",
  ).length;

  const removedCount = listings.filter(
    (item) => normalizedStatus(item) === "removed",
  ).length;

  const paidListingsCount = listings.filter(
    (item) => (item.payment_status || "").toLowerCase() === "paid",
  ).length;

  const filteredListings = listings
    .filter((item) => listingFilter === "all" || normalizedStatus(item) === listingFilter)
    .filter((item) => {
      const query = listingSearch.trim().toLowerCase();
      if (!query) return true;
      return [item.title, item.category, item.location, item.condition, item.id]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    })
    .sort((a, b) => {
      if (listingSort === "price-high" || listingSort === "price-low") {
        const difference = Number(a.price) - Number(b.price);
        return listingSort === "price-high" ? -difference : difference;
      }
      if (listingSort === "title") return a.title.localeCompare(b.title);
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
      return listingSort === "newest" ? bDate - aDate : aDate - bDate;
    });

  function formatPrice(price: number | string) {
    const amount = Number(price);

    if (!Number.isFinite(amount)) return String(price);

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(date?: string | null) {
    if (!date) return "Date unavailable";

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "Date unavailable";

    return parsed.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  async function getAccessToken() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw new Error(sessionError.message);
    if (!session?.access_token) {
      router.replace("/auth");
      throw new Error("Please sign in again to manage your listings.");
    }

    return session.access_token;
  }

  function openEdit(listing: SellerListing) {
    setError("");
    setNotice("");
    setEditingListing(listing);
    setEditForm({
      title: listing.title,
      price: String(listing.price),
      condition: listing.condition || "Good",
      location: listing.location || "",
      description: listing.description || "",
    });
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingListing) return;

    setSavingId(String(editingListing.id));
    setError("");
    setNotice("");

    try {
      const token = await getAccessToken();

      const response = await fetch(
        `${API_BASE_URL}/api/my/listings/${encodeURIComponent(String(editingListing.id))}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: editForm.title.trim(),
            price: Number(editForm.price),
            condition: editForm.condition,
            location: editForm.location.trim(),
            description: editForm.description.trim(),
          }),
        },
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          body.detail || `Unable to update listing (${response.status}).`,
        );
      }

      setEditingListing(null);
      setNotice(
        "Listing updated and submitted for admin review. It will be published after approval.",
      );
      await loadListings();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update your listing.",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function removeListing(listing: SellerListing) {
    const confirmed = window.confirm(
      `Remove "${listing.title}" from the marketplace? This action cannot be undone from this dashboard.`,
    );

    if (!confirmed) return;

    const id = String(listing.id);
    setDeletingId(id);
    setError("");
    setNotice("");

    try {
      const token = await getAccessToken();

      const response = await fetch(
        `${API_BASE_URL}/api/my/listings/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          body.detail || `Unable to remove listing (${response.status}).`,
        );
      }

      setNotice(body.message || "Listing removed from the marketplace.");
      await loadListings();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to remove your listing.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  function toggleListingSelection(id: string) {
    setSelectedListingIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function toggleVisibleListings() {
    const visibleActiveIds = filteredListings
      .filter((listing) => normalizedStatus(listing) === "active")
      .map((listing) => String(listing.id));
    const allVisibleSelected =
      visibleActiveIds.length > 0 &&
      visibleActiveIds.every((id) => selectedListingIds.includes(id));

    setSelectedListingIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleActiveIds.includes(id))
        : Array.from(new Set([...current, ...visibleActiveIds])),
    );
  }

  async function removeSelectedListings() {
    const selectedActiveListings = listings.filter(
      (listing) =>
        selectedListingIds.includes(String(listing.id)) &&
        normalizedStatus(listing) === "active",
    );

    if (selectedActiveListings.length === 0) {
      setSelectedListingIds([]);
      return;
    }

    const confirmed = window.confirm(
      `Remove ${selectedActiveListings.length} selected active listing(s) from the marketplace?`,
    );
    if (!confirmed) return;

    setBulkRemoving(true);
    setError("");
    setNotice("");

    try {
      const token = await getAccessToken();
      const results = await Promise.all(
        selectedActiveListings.map(async (listing) => {
          const response = await fetch(
            `${API_BASE_URL}/api/my/listings/${encodeURIComponent(String(listing.id))}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
            },
          );
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(
              body.detail ||
                `Unable to remove "${listing.title}" (${response.status}).`,
            );
          }
          return listing.id;
        }),
      );

      setSelectedListingIds([]);
      setNotice(`${results.length} listing(s) removed from the marketplace.`);
      await loadListings();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Some selected listings could not be removed. Refresh and check their status.",
      );
      await loadListings();
    } finally {
      setBulkRemoving(false);
    }
  }

  if (!signedIn && loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080a08] text-white">
        <LoaderCircle className="animate-spin text-lime-300" size={28} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080a08] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/3 h-[420px] w-[420px] rounded-full bg-lime-400/[0.07] blur-[140px]" />
        <div className="absolute right-0 top-1/3 h-[300px] w-[300px] rounded-full bg-emerald-500/[0.05] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.09] pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-300">
              <Package size={23} />
            </div>
            <div>
              <p className="text-xl font-black tracking-[0.2em]">
                MIN<span className="text-lime-300">X</span>
              </p>
              <p className="text-xs text-white/45">SELLER DASHBOARD</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/70 transition hover:text-white"
            >
              <ArrowLeft size={16} />
              Marketplace
            </button>
            <button
              onClick={() => router.push("/")}
              className="rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-lime-200"
            >
              Sell an item ↗
            </button>
            <button
              onClick={() => void loadListings()}
              disabled={loading}
              aria-label="Refresh listings"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/70 transition hover:border-lime-300/20 hover:text-lime-200 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
            <button
  type="button"
  onClick={() => router.push("/seller/settings")}
  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/80 transition hover:border-lime-400/40 hover:text-lime-300"
>
  <Settings className="h-4 w-4" />
  Account Settings
</button>
          </div>
        </header>

        <section className="py-9 sm:py-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-3 py-1.5 text-xs font-medium text-lime-200">
            <ShieldCheck size={14} />
            YOUR SELLER ACCOUNT
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            Your listings. <span className="text-lime-300">Your control.</span>
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">
            Track your submissions, check moderation status, and see what needs
            your attention.
          </p>
        </section>

        {notice && (
          <div className="mb-5 rounded-2xl border border-lime-300/20 bg-lime-300/[0.07] p-4 text-sm text-lime-200">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-300/[0.07] p-4 text-sm text-red-200">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1 break-words">{error}</span>
            <button
              onClick={() => setError("")}
              className="text-red-200/70 hover:text-red-100"
            >
              Dismiss
            </button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              label: "Total listings",
              value: listings.length,
              icon: Package,
              color: "text-white",
            },
            {
              label: "Active listings",
              value: activeCount,
              icon: CheckCircle2,
              color: "text-lime-300",
            },
            {
              label: "Pending review",
              value: pendingCount,
              icon: Clock3,
              color: "text-amber-200",
            },
            {
              label: "Rejected listings",
              value: rejectedCount,
              icon: XCircle,
              color: "text-red-200",
            },
            {
              label: "Removed listings",
              value: removedCount,
              icon: Trash2,
              color: "text-white/50",
            },
            {
              label: "Paid listings",
              value: paidListingsCount,
              icon: Wallet,
              color: "text-emerald-200",
            },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-white/50">{stat.label}</p>
                  <Icon size={19} className={stat.color} />
                </div>
                <p className="mt-4 text-3xl font-black tabular-nums">
                  {loading ? "—" : stat.value}
                </p>
              </div>
            );
          })}
        </section>

        <section className="mt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">My listings</h2>
              <p className="mt-1 text-sm text-white/45">
                Only listings associated with your seller account are shown.
              </p>
            </div>
            <span className="text-xs text-white/40">
              {filteredListings.length} of {listings.length} listing
              {listings.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <span className="sr-only">Search your listings</span>
              <input
                type="search"
                value={listingSearch}
                onChange={(event) => setListingSearch(event.target.value)}
                placeholder="Search title, category, location, or ID…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-lime-300/40 focus:ring-2 focus:ring-lime-300/10"
              />
            </label>
            <label className="block">
              <span className="sr-only">Sort listings</span>
              <select
                value={listingSort}
                onChange={(event) => setListingSort(event.target.value as ListingSort)}
                className="w-full rounded-xl border border-white/10 bg-[#11130f] px-4 py-3 text-sm text-white/80 outline-none transition focus:border-lime-300/40 focus:ring-2 focus:ring-lime-300/10"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="price-high">Price: high to low</option>
                <option value="price-low">Price: low to high</option>
                <option value="title">Title: A to Z</option>
              </select>
            </label>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {(
              [
                { value: "all", label: "All listings", count: listings.length },
                { value: "active", label: "Active", count: activeCount },
                { value: "pending", label: "Pending review", count: pendingCount },
                { value: "rejected", label: "Rejected", count: rejectedCount },
                { value: "removed", label: "Removed", count: removedCount },
              ] as const
            ).map((filter) => {
              const selected = listingFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setListingFilter(filter.value)}
                  aria-pressed={selected}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    selected
                      ? "border-lime-300/30 bg-lime-300/10 text-lime-200"
                      : "border-white/10 bg-white/[0.02] text-white/55 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {filter.label}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs ${
                      selected ? "bg-lime-300/15 text-lime-100" : "bg-white/5 text-white/45"
                    }`}
                  >
                    {filter.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={toggleVisibleListings}
                disabled={loading || bulkRemoving}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-lime-300/30 hover:text-lime-200 disabled:opacity-40"
              >
                Select visible active
              </button>
              <span className="text-xs text-white/45">
                {selectedListingIds.length} selected
              </span>
            </div>
            <button
              type="button"
              onClick={() => void removeSelectedListings()}
              disabled={
                bulkRemoving ||
                selectedListingIds.length === 0 ||
                !listings.some(
                  (listing) =>
                    selectedListingIds.includes(String(listing.id)) &&
                    normalizedStatus(listing) === "active",
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-300/[0.07] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {bulkRemoving ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              {bulkRemoving ? "Removing selected…" : "Remove selected"}
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-56 items-center justify-center gap-3 text-white/50">
              <LoaderCircle className="animate-spin" size={22} />
              Loading your listings…
            </div>
          ) : listings.length === 0 && !error ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
              <Package size={34} className="mx-auto text-lime-200/70" />
              <h3 className="mt-4 text-xl font-bold">
                Your first listing starts here
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">
                When you submit an item, it will appear here so you can track
                its payment and review status.
              </p>
              <button
                onClick={() => router.push("/")}
                className="mt-6 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-black hover:bg-lime-200"
              >
                Sell an item
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredListings.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center">
                  <Package size={30} className="mx-auto text-white/25" />
                  <h3 className="mt-3 text-lg font-bold">No matching listings</h3>
                  <p className="mt-2 text-sm text-white/45">
                    Try another search term or change the status filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setListingFilter("all"); setListingSearch(""); }}
                    className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-lime-300/30 hover:text-lime-200"
                  >
                    Clear search and filters
                  </button>
                </div>
              ) : filteredListings.map((listing) => {
                const status = normalizedStatus(listing);
                const image = [...(listing.images ?? [])].sort(
                  (a, b) =>
                    (a.display_order ?? 0) - (b.display_order ?? 0),
                )[0]?.url;

                return (
                  <article
                    key={String(listing.id)}
                    className={`overflow-hidden rounded-3xl border bg-[#111411]/90 transition ${
                      selectedListingIds.includes(String(listing.id))
                        ? "border-lime-300/35"
                        : "border-white/[0.09] hover:border-white/[0.15]"
                    }`}
                  >
                    {status === "active" && (
                      <label className="flex cursor-pointer items-center gap-3 border-b border-white/[0.06] px-5 py-3 text-xs text-white/55">
                        <input
                          type="checkbox"
                          checked={selectedListingIds.includes(String(listing.id))}
                          onChange={() => toggleListingSelection(String(listing.id))}
                          disabled={bulkRemoving || Boolean(savingId || deletingId)}
                          className="h-4 w-4 accent-lime-300"
                        />
                        Select this active listing
                      </label>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)]">
                      <div className="relative min-h-48 bg-white/[0.035] sm:min-h-52">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt={listing.title}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-white/25">
                            <Package size={32} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-lime-300/70">
                              {listing.category || "Marketplace"}
                            </p>
                            <h3 className="mt-1 break-words text-xl font-bold">
                              {listing.title}
                            </h3>
                          </div>
                          <p className="text-xl font-black text-lime-300">
                            {formatPrice(listing.price)}
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <StatusBadge status={status} />
                          {listing.condition && (
                            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                              {listing.condition}
                            </span>
                          )}
                          {listing.location && (
                            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                              {listing.location}
                            </span>
                          )}
                        </div>

                        {listing.description && (
                          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-white/50">
                            {listing.description}
                          </p>
                        )}

                        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-white/[0.07] pt-4 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-white/35">Submitted</p>
                            <p className="mt-1 text-white/70">
                              {formatDate(listing.created_at)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-white/35">
                              Payment status
                            </p>
                            <p className="mt-1 text-white/70">
                              {listing.payment_status || "Not available"}
                            </p>
                          </div>
                        </div>

                        {status === "rejected" && (
                          <div className="mt-4 rounded-2xl border border-red-300/15 bg-red-300/[0.05] p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-red-200">
                              Reason for rejection
                            </p>
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/70">
                              {listing.rejection_reason?.trim() ||
                                "No rejection reason was provided. Please contact MINX support for clarification."}
                            </p>
                          </div>
                        )}

                        {status === "active" && (
                          <div className="mt-4 flex items-center gap-2 text-sm text-lime-200">
                            <CheckCircle2 size={16} />
                            Your listing is approved and active.
                          </div>
                        )}

                        {status === "pending" && (
                          <div className="mt-4 flex items-center gap-2 text-sm text-amber-200">
                            <Clock3 size={16} />
                            Your listing is awaiting admin review.
                          </div>
                        )}

                        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
                          {status === "active" && (
                            <>
                              <button
                                onClick={() => openEdit(listing)}
                                disabled={Boolean(savingId || deletingId)}
                                className="inline-flex items-center gap-2 rounded-xl border border-lime-300/20 bg-lime-300/[0.06] px-4 py-2.5 text-sm font-semibold text-lime-200 transition hover:bg-lime-300/[0.12] disabled:opacity-50"
                              >
                                <Pencil size={15} />
                                Edit listing
                              </button>

                              <button
                                onClick={() => void removeListing(listing)}
                                disabled={Boolean(savingId || deletingId)}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 px-4 py-2.5 text-sm text-red-200 transition hover:bg-red-300/[0.07] disabled:opacity-50"
                              >
                                {deletingId === String(listing.id) ? (
                                  <LoaderCircle
                                    size={15}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Trash2 size={15} />
                                )}
                                {deletingId === String(listing.id)
                                  ? "Removing…"
                                  : "Remove listing"}
                              </button>

                              <button
                                onClick={() => router.push("/")}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
                              >
                                View marketplace
                                <ExternalLink size={15} />
                              </button>
                            </>
                          )}

                          {status === "removed" && (
                            <p className="text-sm text-white/40">
                              This listing has been removed from the marketplace.
                            </p>
                          )}

                          {status === "rejected" && (
                            <p className="text-sm text-white/45">
                              Contact MINX support if you need help with this listing.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Wallet size={21} className="mt-0.5 text-lime-200" />
            <div>
              <h3 className="font-semibold">Payment information</h3>
              <p className="mt-1 text-sm leading-6 text-white/45">
                This dashboard displays the payment status returned by MINX.
                Listing fees are separate from the price you set for your item.
                Payment refunds and relisting rules should be confirmed with
                MINX support.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-12 border-t border-white/[0.08] py-6 text-center text-xs text-white/30">
          MINX Seller Dashboard · Your listings, your control
        </footer>
      </div>

      {editingListing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingId) {
              setEditingListing(null);
            }
          }}
        >
          <div className="my-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-[#101310] p-5 shadow-2xl sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">
                  Seller controls
                </p>
                <h2 className="mt-2 text-2xl font-black">Edit listing</h2>
                <p className="mt-1 text-sm text-white/45">
                  Saving changes sends your listing back for admin review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingListing(null)}
                disabled={Boolean(savingId)}
                aria-label="Close edit form"
                className="rounded-xl border border-white/10 p-2 text-white/60 hover:text-white disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label
                  htmlFor="edit-title"
                  className="mb-2 block text-sm text-white/65"
                >
                  Listing title
                </label>
                <input
                  id="edit-title"
                  required
                  minLength={3}
                  maxLength={120}
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-lime-300/40"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-price"
                    className="mb-2 block text-sm text-white/65"
                  >
                    Price (₹)
                  </label>
                  <input
                    id="edit-price"
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    value={editForm.price}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        price: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-lime-300/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-condition"
                    className="mb-2 block text-sm text-white/65"
                  >
                    Condition
                  </label>
                  <select
                    id="edit-condition"
                    value={editForm.condition}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        condition: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#151815] px-4 py-3 text-white outline-none transition focus:border-lime-300/40"
                  >
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="edit-location"
                  className="mb-2 block text-sm text-white/65"
                >
                  Location
                </label>
                <input
                  id="edit-location"
                  required
                  minLength={2}
                  maxLength={120}
                  value={editForm.location}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-lime-300/40"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-description"
                  className="mb-2 block text-sm text-white/65"
                >
                  Description
                </label>
                <textarea
                  id="edit-description"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-lime-300/40"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.08] pt-5">
                <button
                  type="button"
                  onClick={() => setEditingListing(null)}
                  disabled={Boolean(savingId)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/65 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(savingId)}
                  className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingId ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {savingId ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}