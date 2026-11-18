"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  LogOut,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ProfileForm = {
  fullName: string;
  phone: string;
};

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-lime-300/50 focus:ring-2 focus:ring-lime-300/10";

export default function SellerSettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<ProfileForm>({ fullName: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!active) return;

      if (authError || !data.user) {
        router.replace("/auth");
        return;
      }

      const metadata = data.user.user_metadata ?? {};
      setEmail(data.user.email ?? "");
      setForm({
        fullName: String(
          metadata.full_name ?? metadata.fullName ?? metadata.name ?? "",
        ),
        phone: String(metadata.phone ?? metadata.phone_number ?? ""),
      });
      setLoading(false);
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);
    setError("");
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message || "Could not sign out. Please try again.");
      setSigningOut(false);
      return;
    }
    router.replace("/auth");
    router.refresh();
  }

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const fullName = form.fullName.trim();
    const phone = form.phone.trim();

    if (!fullName) {
      setError("Please enter your full name.");
      setSaving(false);
      return;
    }

    if (phone && !/^[+\d()\-\s]{7,20}$/.test(phone)) {
      setError("Enter a valid phone number, or leave it blank.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        phone,
      },
    });

    if (updateError) {
      setError(updateError.message || "Could not save your profile. Please try again.");
    } else {
      setForm({ fullName, phone });
      setSuccess("Your profile settings have been saved.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080a08] text-white">
        <div className="flex items-center gap-3 text-sm text-white/60">
          <LoaderCircle className="h-5 w-5 animate-spin text-lime-300" />
          Loading account settings…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080a08] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-lime-300/[0.07] blur-[120px]" />
        <div className="absolute -bottom-48 -left-40 h-[26rem] w-[26rem] rounded-full bg-emerald-400/[0.05] blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/seller"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition hover:border-lime-300/30 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to seller dashboard
        </Link>

        <header className="mt-9 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-300">
            MINX seller centre
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Account settings<span className="text-lime-300">.</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/55 sm:text-base">
            Manage the contact details associated with your seller account.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.08] pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-200">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Personal information</h2>
                <p className="mt-1 text-xs text-white/45">Update your seller profile details.</p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <label className="block text-sm font-medium text-white/80">
                Full name
                <input
                  autoComplete="name"
                  className={inputClassName}
                  maxLength={100}
                  onChange={(event) => updateField("fullName", event.target.value)}
                  placeholder="Enter your full name"
                  value={form.fullName}
                  required
                />
              </label>

              <label className="block text-sm font-medium text-white/80">
                Email address
                <span className="relative mt-2 block">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    className={`${inputClassName} mt-0 cursor-not-allowed pl-11 text-white/50`}
                    value={email}
                    readOnly
                    aria-describedby="email-note"
                  />
                </span>
                <span id="email-note" className="mt-2 block text-xs font-normal text-white/40">
                  Your sign-in email is shown here and cannot be changed on this page.
                </span>
              </label>

              <label className="block text-sm font-medium text-white/80">
                Phone number <span className="font-normal text-white/35">(optional)</span>
                <span className="relative mt-2 block">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    autoComplete="tel"
                    className={`${inputClassName} mt-0 pl-11`}
                    inputMode="tel"
                    maxLength={20}
                    onChange={(event) => updateField("phone", event.target.value)}
                    placeholder="Enter your phone number"
                    value={form.phone}
                  />
                </span>
              </label>
            </div>

            {error && (
              <div role="alert" className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
            {success && (
              <div role="status" className="mt-5 flex items-start gap-2 rounded-2xl border border-lime-300/20 bg-lime-300/[0.07] px-4 py-3 text-sm text-lime-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {success}
              </div>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-white/35">Changes are saved to your signed-in account profile.</p>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={saving}
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-semibold">Account security</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Keep your sign-in details private. MINX will never ask you to share your password in a message.
              </p>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-red-300/20 bg-red-300/[0.06] px-4 py-2 text-sm font-medium text-red-200 transition hover:border-red-300/40 hover:bg-red-300/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingOut ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                {signingOut ? "Signing out…" : "Sign out of MINX"}
              </button>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">Quick link</p>
              <h2 className="mt-3 font-semibold">Your listings</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Return to your seller dashboard to manage listings and review their statuses.
              </p>
              <Link
                href="/seller"
                className="mt-4 inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-lime-300/30 hover:text-lime-200"
              >
                Open dashboard
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
