
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ListingImage = {
  url: string;
  display_order?: number;
};

type AdminListing = {
  id: string | number;
  title: string;
  description?: string | null;
  category?: string | null;
  category_id?: string | null;
  price: number | string;
  condition?: string | null;
  location?: string | null;
  created_at?: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  images?: ListingImage[] | null;
};

type PendingResponse = {
  items: AdminListing[];
  count: number;
};

export default function AdminPage() {
  const router = useRouter();

  const [listings, setListings] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | number | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session?.access_token) {
      setIsAuthenticated(false);
      router.replace("/auth");
      throw new Error("Please sign in to access the admin dashboard.");
    }

    setIsAuthenticated(true);
    return session.access_token;
  }, [router]);

  const fetchPendingListings = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const token = await getAccessToken();

      const response = await fetch(
        `${API_BASE_URL}/api/admin/listings/pending`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      if (response.status === 401) {
        throw new Error(
          "Your session was not accepted by the API. Sign in again and retry.",
        );
      }

      if (response.status === 403) {
        throw new Error(
          "Access denied. Confirm your Supabase user ID is included in ADMIN_USER_IDS in apps/api/.env, then restart the backend.",
        );
      }

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `Could not load pending listings (${response.status}). ${detail.slice(0, 250)}`,
        );
      }

      const result = (await response.json()) as PendingResponse;

      setListings(Array.isArray(result.items) ? result.items : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading listings.",
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void fetchPendingListings();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setIsAuthenticated(false);
        router.replace("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchPendingListings, router]);

  async function reviewListing(
    listing: AdminListing,
    action: "approve" | "reject",
  ) {
    if (action === "reject" && !rejectReason.trim()) {
      setError("Enter a reason before rejecting this listing.");
      return;
    }

    setWorkingId(listing.id);
    setError("");
    setNotice("");

    try {
      const token = await getAccessToken();
      const response = await fetch(
        `${API_BASE_URL}/api/admin/listings/${encodeURIComponent(String(listing.id))}/${action}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            ...(action === "reject"
              ? { "Content-Type": "application/json" }
              : {}),
          },
          ...(action === "reject"
            ? { body: JSON.stringify({ reason: rejectReason.trim() }) }
            : {}),
        },
      );

      if (response.status === 401) {
        throw new Error("Your session expired. Please sign in again.");
      }

      if (response.status === 403) {
        throw new Error(
          "Admin access denied. Check ADMIN_USER_IDS and your signed-in Supabase user.",
        );
      }

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `Could not ${action} listing (${response.status}). ${detail.slice(0, 250)}`,
        );
      }

      setListings((current) =>
        current.filter((item) => String(item.id) !== String(listing.id)),
      );

      setRejectingId(null);
      setRejectReason("");
      setNotice(
        action === "approve"
          ? `"${listing.title}" was approved.`
          : `"${listing.title}" was rejected.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Could not ${action} this listing.`,
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/auth");
  }

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
              <ShieldCheck size={23} />
            </div>
            <div>
              <p className="text-xl font-black tracking-[0.2em]">
                MIN<span className="text-lime-300">X</span>
              </p>
              <p className="text-xs text-white/45">ADMIN CONTROL CENTER</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
            >
              <ArrowLeft size={16} />
              Marketplace
            </button>
            <button
              onClick={() => void fetchPendingListings()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-lime-300/20 bg-lime-300/10 px-3 py-2.5 text-sm font-semibold text-lime-200 transition hover:bg-lime-300/15 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/60 transition hover:text-white"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </header>

        <section className="py-9 sm:py-12">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/[0.07] px-3 py-1.5 text-xs font-medium text-lime-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-300" />
                LISTING MODERATION
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Review the <span className="text-lime-300">marketplace.</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">
                Verify every submission before it becomes visible to buyers.
                Approve quality listings or reject those that need attention.
              </p>
            </div>

            <div className="flex min-w-44 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200">
                <Clock3 size={23} />
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums">
                  {listings.length}
                </p>
                <p className="text-xs text-white/45">Pending review</p>
              </div>
            </div>
          </div>
        </section>

        {notice && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-lime-300/20 bg-lime-300/[0.07] p-4 text-sm text-lime-200">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-4 text-sm text-red-200">
            <XCircle className="mt-0.5 shrink-0" size={18} />
            <span className="min-w-0 flex-1 break-words">{error}</span>
            <button
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="shrink-0 text-red-200/70 hover:text-red-100"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {!isAuthenticated && loading ? (
          <div className="flex min-h-60 items-center justify-center gap-3 text-white/50">
            <LoaderCircle className="animate-spin" size={22} />
            Checking your session…
          </div>
        ) : loading ? (
          <div className="flex min-h-60 items-center justify-center gap-3 text-white/50">
            <LoaderCircle className="animate-spin" size={22} />
            Loading pending listings…
          </div>
        ) : listings.length === 0 && !error ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-20 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-300/15 bg-lime-300/[0.07] text-lime-200">
              <CheckCircle2 size={30} />
            </div>
            <h2 className="text-xl font-bold">You’re all caught up</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">
              There are no listings waiting for approval right now. New
              submissions will appear here after payment and submission.
            </p>
            <button
              onClick={() => void fetchPendingListings()}
              className="mt-6 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-black transition hover:bg-lime-200"
            >
              Check again
            </button>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {listings.map((listing) => {
              const busy = String(workingId) === String(listing.id);
              const images = [...(listing.images ?? [])].sort(
                (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
              );
              const firstImage = images[0]?.url;

              return (
                <article
                  key={String(listing.id)}
                  className="overflow-hidden rounded-3xl border border-white/[0.09] bg-[#111411]/90 shadow-[0_20px_80px_rgba(0,0,0,0.18)] transition hover:border-white/[0.15]"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="relative min-h-52 bg-white/[0.035] sm:min-h-64">
                      {firstImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstImage}
                          alt={listing.title}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/25">
                          <ShieldCheck size={30} />
                          <span className="text-xs">No photo uploaded</span>
                        </div>
                      )}
                      <div className="absolute left-3 top-3 rounded-full border border-amber-200/20 bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200 backdrop-blur">
                        Pending review
                      </div>
                      {images.length > 1 && (
                        <div className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-2.5 py-1 text-xs text-white/80">
                          +{images.length - 1} more photo
                          {images.length > 2 ? "s" : ""}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-lime-300/70">
                            {listing.category || "Marketplace listing"}
                          </p>
                          <h2 className="break-words text-lg font-bold leading-snug">
                            {listing.title}
                          </h2>
                        </div>
                        <p className="shrink-0 text-lg font-black text-lime-300">
                          {formatPrice(listing.price)}
                        </p>
                      </div>

                      <p className="mt-3 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-white/55">
                        {listing.description || "No description provided."}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {listing.condition && (
                          <span className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-xs text-white/65">
                            {listing.condition}
                          </span>
                        )}
                        {listing.location && (
                          <span className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-xs text-white/65">
                            {listing.location}
                          </span>
                        )}
                      </div>

                      <div className="mt-5 space-y-1.5 border-t border-white/[0.07] pt-4 text-xs text-white/40">
                        <p>
                          Seller:{" "}
                          <span className="break-all text-white/70">
                            {listing.seller_name || listing.seller_id || "Unknown"}
                          </span>
                        </p>
                        <p>Submitted: {formatDate(listing.created_at)}</p>
                        <p className="break-all">
                          Listing ID: {String(listing.id)}
                        </p>
                      </div>

                      {images.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {images.map((image, index) => (
                            <a
                              key={`${image.url}-${index}`}
                              href={image.url}
                              target="_blank"
                              rel="noreferrer"
                              title={`Open photo ${index + 1}`}
                              className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/60 hover:border-lime-300/30 hover:text-lime-200"
                            >
                              Photo {index + 1}
                              <ExternalLink size={12} />
                            </a>
                          ))}
                        </div>
                      )}

                      {rejectingId === listing.id ? (
                        <div className="mt-5 space-y-3 rounded-2xl border border-red-300/15 bg-red-300/[0.04] p-3">
                          <label
                            htmlFor={`reason-${listing.id}`}
                            className="block text-xs font-semibold text-red-200"
                          >
                            Reason for rejection
                          </label>
                          <textarea
                            id={`reason-${listing.id}`}
                            value={rejectReason}
                            onChange={(event) =>
                              setRejectReason(event.target.value)
                            }
                            rows={3}
                            maxLength={1000}
                            placeholder="Explain what needs to be corrected…"
                            className="w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-red-300/40"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                void reviewListing(listing, "reject")
                              }
                              disabled={busy || !rejectReason.trim()}
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-400 px-3 py-2.5 text-sm font-bold text-black transition hover:bg-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy ? (
                                <LoaderCircle className="animate-spin" size={16} />
                              ) : (
                                <X size={16} />
                              )}
                              Confirm rejection
                            </button>
                            <button
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason("");
                              }}
                              disabled={busy}
                              className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/70 hover:text-white disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setRejectingId(listing.id);
                              setRejectReason("");
                              setError("");
                            }}
                            disabled={busy || workingId !== null}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/20 bg-red-300/[0.06] px-3 py-3 text-sm font-bold text-red-200 transition hover:bg-red-300/[0.12] disabled:opacity-50"
                          >
                            <X size={16} />
                            Reject
                          </button>
                          <button
                            onClick={() => void reviewListing(listing, "approve")}
                            disabled={busy || workingId !== null}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime-300 px-3 py-3 text-sm font-black text-black transition hover:bg-lime-200 disabled:opacity-50"
                          >
                            {busy ? (
                              <LoaderCircle className="animate-spin" size={17} />
                            ) : (
                              <Check size={17} />
                            )}
                            Approve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <footer className="mt-12 border-t border-white/[0.08] py-6 text-center text-xs text-white/30">
          MINX Admin · Review carefully before approving a listing
        </footer>
      </div>
    </main>
  );
}
