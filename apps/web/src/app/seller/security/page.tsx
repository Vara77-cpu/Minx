
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  LockKeyhole,
  LogOut,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SellerSecurityPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("error");

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        router.replace("/auth");
        return;
      }

      setEmail(data.user.email ?? "");
      setLoading(false);
    }

    void loadUser();

    return () => {
      active = false;
    };
  }, [router]);

  function showMessage(type: "success" | "error", text: string) {
    setMessageType(type);
    setMessage(text);
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage("error", "Please complete all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      showMessage("error", "Your new password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("error", "The new passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      showMessage("error", "Choose a password different from your current password.");
      return;
    }

    setSaving(true);

    try {
      // Reauthenticate using the current password before changing it.
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      const userEmail = userData.user?.email;

      if (userError || !userEmail) {
        showMessage("error", "Your session could not be verified. Please sign in again.");
        return;
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (verifyError) {
        showMessage("error", "Your current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        showMessage("error", updateError.message || "Could not update your password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      showMessage("success", "Your password has been changed successfully.");
    } catch {
      showMessage("error", "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const confirmed = window.confirm("Are you sure you want to sign out?");

    if (!confirmed) return;

    setSigningOut(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        showMessage("error", error.message || "Could not sign out.");
        setSigningOut(false);
        return;
      }

      router.replace("/auth");
      router.refresh();
    } catch {
      showMessage("error", "Sign-out failed. Please try again.");
      setSigningOut(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-lime-400/60";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080b09] text-white">
        <div className="flex items-center gap-3 text-sm text-white/60">
          <LoaderCircle className="h-5 w-5 animate-spin text-lime-300" />
          Verifying your account...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080b09] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => router.push("/seller")}
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-lime-300"
        >
          <ArrowLeft size={16} />
          Back to Seller Dashboard
        </button>

        <header className="mb-8">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/10">
            <ShieldCheck className="h-7 w-7 text-lime-300" />
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-lime-300">
            MINX Account Protection
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Security &amp; Account
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">
            Manage your password and account access securely.
          </p>
        </header>

        {message && (
          <div
            role={messageType === "error" ? "alert" : "status"}
            className={`mb-6 flex items-start gap-2 rounded-xl border p-3 text-sm ${
              messageType === "success"
                ? "border-lime-400/20 bg-lime-400/5 text-lime-200"
                : "border-amber-400/20 bg-amber-400/5 text-amber-200"
            }`}
          >
            {messageType === "success" ? (
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
            )}
            <span>{message}</span>
          </div>
        )}

        <div className="grid gap-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-white/5 p-3">
                <LockKeyhole className="h-5 w-5 text-lime-300" />
              </div>

              <div>
                <h2 className="font-semibold">Change Password</h2>
                <p className="mt-1 text-xs text-white/40">
                  Signed in as {email || "your account"}
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="mb-2 block text-sm text-white/70">
                  Current password
                </label>
                <input
                  id="currentPassword"
                  type={showPasswords ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Enter current password"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="mb-2 block text-sm text-white/70">
                  New password
                </label>
                <input
                  id="newPassword"
                  type={showPasswords ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm text-white/70">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type={showPasswords ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter new password"
                  minLength={8}
                  className={inputClass}
                  required
                />
              </div>

              <button
                type="button"
                onClick={() => setShowPasswords((visible) => !visible)}
                className="inline-flex items-center gap-2 text-xs text-white/50 transition hover:text-white"
              >
                {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
                {showPasswords ? "Hide passwords" : "Show passwords"}
              </button>

              <div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 px-5 py-3 font-semibold text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {saving && <LoaderCircle size={17} className="animate-spin" />}
                  {saving ? "Updating password..." : "Change Password"}
                </button>
              </div>

              <p className="text-xs leading-5 text-white/35">
                Your current password is verified before the update is submitted.
                Never share your password with anyone.
              </p>
            </form>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-white/5 p-3">
                <ShieldCheck className="h-5 w-5 text-lime-300" />
              </div>
              <div>
                <h2 className="font-semibold">Account Security</h2>
                <p className="mt-1 text-xs text-white/40">
                  Authentication is managed by Supabase.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium">Signed-in account</p>
              <p className="mt-1 break-all text-sm text-white/45">{email}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-red-400/15 bg-red-400/[0.03] p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-semibold text-red-300">Sign Out</h2>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  End your current MINX session on this device.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/25 px-5 py-3 text-sm font-medium text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingOut ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <LogOut size={16} />
                )}
                {signingOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </section>
        </div>

        <footer className="mt-8 text-center text-xs text-white/25">
          MINX · Seller Security
        </footer>
      </div>
    </main>
  );
}
