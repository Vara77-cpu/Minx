"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });

        if (error) throw error;

        if (data.session) {
          setSuccess(true);
          setMessage("Your MINX account is ready. Welcome aboard!");

          window.setTimeout(() => {
            router.push("/");
            router.refresh();
          }, 1000);
        } else {
          setSuccess(true);
          setMessage(
            "Account created. Check your email to confirm your address, then log in.",
          );
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) throw error;

        setSuccess(true);
        setMessage("Login successful. Welcome back to MINX!");

        window.setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 700);
      }
    } catch (error) {
      setSuccess(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setSuccess(false);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#080a08] text-white selection:bg-[#b7ff42] selection:text-black">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-10 h-[420px] w-[420px] rounded-full bg-[#a4ff36]/[0.07] blur-[120px]" />
        <div className="absolute -right-40 bottom-0 h-[460px] w-[460px] rounded-full bg-[#a4ff36]/[0.06] blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between border-b border-white/[0.08] px-5 py-5 sm:px-10 lg:px-16">
        <Link
          href="/"
          className="group flex items-center gap-3"
          aria-label="Back to MINX home"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b7ff42] text-xl font-black text-black shadow-[0_0_28px_rgba(183,255,66,0.15)]">
            M
          </span>
          <span className="text-2xl font-black tracking-[-0.08em]">
            MINX<span className="text-[#b7ff42]">.</span>
          </span>
        </Link>

        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-white/60 transition hover:text-[#b7ff42]"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Back to marketplace</span>
          <span className="sm:hidden">Back</span>
        </Link>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-81px)] max-w-7xl items-center gap-12 px-5 py-12 sm:px-10 lg:grid-cols-[1fr_0.85fr] lg:gap-24 lg:px-16 lg:py-16">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#b7ff42]/20 bg-[#b7ff42]/[0.06] px-4 py-2 text-[10px] font-bold tracking-[0.2em] text-[#b7ff42]">
            <Sparkles size={14} />
            YOUR NEXT STORY STARTS HERE
          </div>

          <h1 className="text-5xl font-semibold leading-[1.06] tracking-[-0.065em] sm:text-6xl lg:text-7xl">
            Good finds.
            <br />
            <span className="text-[#b7ff42]">Great people.</span>
          </h1>

          <p className="mt-6 max-w-md text-base leading-7 text-white/50 sm:text-lg">
            Join the smarter way to buy and sell pre-loved treasures. Create
            your account and give great things a second life.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#b7ff42]/10 text-[#b7ff42]">
                <ShieldCheck size={21} />
              </div>
              <h3 className="font-semibold">Your account</h3>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Sign in to manage your marketplace activity.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#b7ff42]/10 text-[#b7ff42]">
                <Sparkles size={21} />
              </div>
              <h3 className="font-semibold">Your next find</h3>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Discover products and prepare to list your own.
              </p>
            </div>
          </div>

          <div className="mt-9 flex items-center gap-3 text-xs text-white/35">
            <span className="h-2 w-2 rounded-full bg-[#b7ff42] shadow-[0_0_12px_#b7ff42]" />
            A smarter marketplace. A fresh start.
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[28px] border border-white/[0.10] bg-[#101210]/90 p-6 shadow-[0_25px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-9">
            <div className="mb-8">
              <p className="text-xs font-bold tracking-[0.22em] text-[#b7ff42]">
                {mode === "signup" ? "JOIN THE COMMUNITY" : "WELCOME BACK"}
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
                {mode === "signup" ? "Create account" : "Sign in"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/45">
                {mode === "signup"
                  ? "A few details. A whole world of great finds."
                  : "Your next great find is waiting."}
              </p>
            </div>

            <div className="mb-7 grid grid-cols-2 rounded-xl border border-white/[0.08] bg-black/30 p-1">
              <button
                type="button"
                onClick={() => changeMode("signup")}
                className={`rounded-lg px-3 py-3 text-sm font-semibold transition ${
                  mode === "signup"
                    ? "bg-[#b7ff42] text-black"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Create account
              </button>

              <button
                type="button"
                onClick={() => changeMode("login")}
                className={`rounded-lg px-3 py-3 text-sm font-semibold transition ${
                  mode === "login"
                    ? "bg-[#b7ff42] text-black"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Sign in
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === "signup" && (
                <div>
                  <label
                    htmlFor="fullName"
                    className="mb-2 block text-sm font-medium text-white/75"
                  >
                    Full name
                  </label>

                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.10] bg-black/30 px-4 transition focus-within:border-[#b7ff42]/60 focus-within:ring-2 focus-within:ring-[#b7ff42]/10">
                    <UserRound size={18} className="shrink-0 text-white/35" />
                    <input
                      id="fullName"
                      type="text"
                      autoComplete="name"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                      minLength={2}
                      maxLength={100}
                      className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-white/25"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-white/75"
                >
                  Email address
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-white/[0.10] bg-black/30 px-4 transition focus-within:border-[#b7ff42]/60 focus-within:ring-2 focus-within:ring-[#b7ff42]/10">
                  <Mail size={18} className="shrink-0 text-white/35" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    maxLength={254}
                    className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-white/25"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-white/75"
                  >
                    Password
                  </label>

                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={async () => {
                        setMessage("");
                        setSuccess(false);

                        if (!email.trim()) {
                          setMessage(
                            "Enter your email address first to reset your password.",
                          );
                          return;
                        }

                        setLoading(true);

                        try {
                          const { error } =
                            await supabase.auth.resetPasswordForEmail(
                              email.trim().toLowerCase(),
                              {
                                redirectTo: `${window.location.origin}/auth`,
                              },
                            );

                          if (error) throw error;

                          setSuccess(true);
                          setMessage(
                            "If an account exists for this email, a password reset link will be sent.",
                          );
                        } catch (error) {
                          setSuccess(false);
                          setMessage(
                            error instanceof Error
                              ? error.message
                              : "Unable to request a password reset.",
                          );
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="text-xs text-[#b7ff42] transition hover:text-white"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-white/[0.10] bg-black/30 px-4 transition focus-within:border-[#b7ff42]/60 focus-within:ring-2 focus-within:ring-[#b7ff42]/10">
                  <LockKeyhole
                    size={18}
                    className="shrink-0 text-white/35"
                  />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    placeholder={
                      mode === "signup"
                        ? "At least 8 characters"
                        : "Enter your password"
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    maxLength={128}
                    className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-white/25"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="shrink-0 text-white/40 transition hover:text-[#b7ff42]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {mode === "signup" && (
                  <p className="mt-2 text-xs leading-5 text-white/35">
                    Use at least 8 characters for your password.
                  </p>
                )}
              </div>

              {message && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`flex items-start gap-2 rounded-xl border p-3 text-sm leading-6 ${
                    success
                      ? "border-[#b7ff42]/20 bg-[#b7ff42]/[0.06] text-[#c7ff83]"
                      : "border-red-400/20 bg-red-400/[0.06] text-red-300"
                  }`}
                >
                  {success && (
                    <CheckCircle2
                      size={18}
                      className="mt-1 shrink-0"
                    />
                  )}
                  <span>{message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[#b7ff42] px-5 py-4 text-sm font-bold text-black transition hover:bg-[#c8ff72] hover:shadow-[0_0_35px_rgba(183,255,66,0.15)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Please wait...
                  </>
                ) : (
                  <>
                    {mode === "signup" ? "Create my account" : "Sign in to MINX"}
                    <ArrowRight
                      size={17}
                      className="transition group-hover:translate-x-1"
                    />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs leading-6 text-white/35">
              By continuing, you agree to use MINX responsibly and provide
              accurate account information.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-white/30">
            MINX © {new Date().getFullYear()} · Good finds deserve a second life.
          </p>
        </div>
      </section>
    </main>
  );
}