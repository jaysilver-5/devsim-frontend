// app/auth/page.tsx
"use client";

import { useState, useCallback } from "react";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { OAuthStrategy } from "@clerk/types";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { setActive } = useClerk();
  const router = useRouter();
  const params = useSearchParams();
  const redirectUrl = params.get("redirect_url") || "/onboarding";

  const handleSocial = useCallback(
    async (strategy: OAuthStrategy) => {
      if (!signInLoaded || !signUpLoaded) return;
      setError("");
      try {
        if (mode === "signin") {
          await signIn.authenticateWithRedirect({
            strategy,
            redirectUrl: "/auth/sso-callback",
            redirectUrlComplete: redirectUrl,
          });
        } else {
          await signUp.authenticateWithRedirect({
            strategy,
            redirectUrl: "/auth/sso-callback",
            redirectUrlComplete: redirectUrl,
            unsafeMetadata: { onboardingComplete: false },
          });
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Authentication failed";
        setError(message);
      }
    },
    [signIn, signUp, signInLoaded, signUpLoaded, mode, redirectUrl]
  );

  const handleEmailAuth = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!signInLoaded || !signUpLoaded) return;
      setError("");
      setLoading(true);

      try {
        if (mode === "signin") {
          const result = await signIn.create({
            identifier: email,
            password,
          });

          if (result.status === "complete" && result.createdSessionId) {
            await setActive({ session: result.createdSessionId });
            router.push(redirectUrl);
          }
        } else {
          const result = await signUp.create({
            emailAddress: email,
            password,
            unsafeMetadata: { onboardingComplete: false },
          });

          if (result.status === "complete" && result.createdSessionId) {
            await setActive({ session: result.createdSessionId });
            router.push("/onboarding");
          } else if (result.status === "missing_requirements") {
            setError("Please check your email to verify your account.");
          }
        }
      } catch (err: unknown) {
        const clerkErr = err as { errors?: { message: string }[] };
        const message =
          clerkErr?.errors?.[0]?.message ||
          (err instanceof Error ? err.message : "Something went wrong");
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [
      signIn,
      signUp,
      signInLoaded,
      signUpLoaded,
      mode,
      email,
      password,
      router,
      redirectUrl,
      setActive,
    ]
  );

  return (
    <div className="min-h-dvh flex">
      {/* ─── Left: Auth form ─────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-8 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-[40%] -right-[20%] w-[300px] h-[300px] rounded-full bg-ds-primary/8 pointer-events-none" />
        <div className="absolute -bottom-[30%] -left-[10%] w-[200px] h-[200px] rounded-full bg-ds-success/5 pointer-events-none" />

        <div className="relative z-10 w-full max-w-[360px]">
          <h1 className="text-xl font-bold text-ds-primary-muted tracking-tight">
            devsim
          </h1>
          <p className="text-sm text-ds-text-dim mt-1 mb-8">
            Ship code. Not resumes.
          </p>

          {/* ── Mode toggle ──────────────────────────── */}
          <div className="flex bg-ds-surface rounded-lg p-[3px] mb-6">
            <button
              onClick={() => {
                setMode("signin");
                setError("");
              }}
              className={`flex-1 text-center py-2 rounded-md text-xs font-medium transition-all ${
                mode === "signin"
                  ? "bg-ds-primary text-white"
                  : "text-ds-text-dim hover:text-ds-text-secondary"
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setError("");
              }}
              className={`flex-1 text-center py-2 rounded-md text-xs font-medium transition-all ${
                mode === "signup"
                  ? "bg-ds-primary text-white"
                  : "text-ds-text-dim hover:text-ds-text-secondary"
              }`}
            >
              Sign up
            </button>
          </div>

          {/* ── Social buttons ───────────────────────── */}
          <div className="flex flex-col gap-2.5 mb-5">
            <button
              onClick={() => handleSocial("oauth_github")}
              className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-lg border border-ds-border-strong bg-ds-surface text-ds-text-secondary text-sm font-medium hover:border-ds-primary/25 hover:bg-ds-elevated transition-all"
            >
              <GitHubIcon />
              Continue with GitHub
            </button>
            <button
              onClick={() => handleSocial("oauth_google")}
              className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-lg border border-ds-border-strong bg-ds-surface text-ds-text-secondary text-sm font-medium hover:border-ds-primary/25 hover:bg-ds-elevated transition-all"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </div>

          {/* ── Divider ──────────────────────────────── */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-ds-border" />
            <span className="text-[11px] text-ds-text-faint uppercase tracking-wider">
              or
            </span>
            <div className="flex-1 h-px bg-ds-border" />
          </div>

          {/* ── Email form ───────────────────────────── */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            <div>
              <label className="block text-[11px] text-ds-text-dim font-medium mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-ds-border-strong bg-ds-base text-ds-text-secondary text-sm placeholder:text-ds-text-ghost focus:border-ds-primary focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ds-text-dim font-medium mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "signup" ? "Create a password" : "Enter your password"
                }
                required
                minLength={8}
                className="w-full px-3.5 py-2.5 rounded-lg border border-ds-border-strong bg-ds-base text-ds-text-secondary text-sm placeholder:text-ds-text-ghost focus:border-ds-primary focus:outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="text-xs text-ds-danger bg-ds-danger-bg rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-ds-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity mt-2"
            >
              {loading
                ? "..."
                : mode === "signin"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>

          <p className="text-xs text-ds-text-faint text-center mt-5">
            By continuing, you agree to our{" "}
            <a href="/terms" className="text-ds-primary-muted hover:underline">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-ds-primary-muted hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>

      {/* ─── Right: Social proof panel ───────────────── */}
      <div className="hidden lg:flex w-[280px] bg-ds-surface/50 border-l border-ds-border flex-col justify-center gap-6 px-6">
        <div className="flex gap-4 text-center">
          <div>
            <div className="text-xl font-bold text-ds-primary-muted">14</div>
            <div className="text-[10px] text-ds-text-faint">Simulations</div>
          </div>
          <div>
            <div className="text-xl font-bold text-ds-primary-muted">4</div>
            <div className="text-[10px] text-ds-text-faint">AI teammates</div>
          </div>
          <div>
            <div className="text-xl font-bold text-ds-primary-muted">6</div>
            <div className="text-[10px] text-ds-text-faint">Dimensions</div>
          </div>
        </div>

        <TestimonialCard
          quote="Closest thing to actually working on a real team. The standup caught me off guard."
          name="Aisha K."
          role="Backend Engineer"
          initials="AK"
          color="bg-ds-success/15 text-ds-success"
        />
        <TestimonialCard
          quote="We replaced our take-home test. Candidates prefer it and we get 10x better signal."
          name="David M."
          role="Engineering Manager"
          initials="DM"
          color="bg-ds-primary/15 text-ds-primary-muted"
        />
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────

function TestimonialCard({
  quote,
  name,
  role,
  initials,
  color,
}: {
  quote: string;
  name: string;
  role: string;
  initials: string;
  color: string;
}) {
  return (
    <div className="p-4 bg-ds-surface rounded-lg border border-ds-border">
      <p className="text-xs text-ds-text-muted leading-relaxed italic mb-3">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="flex items-center gap-2">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${color}`}
        >
          {initials}
        </div>
        <div>
          <div className="text-[11px] font-medium text-ds-text-secondary">
            {name}
          </div>
          <div className="text-[10px] text-ds-text-faint">{role}</div>
        </div>
      </div>
    </div>
  );
}

// ─── SVG Icons ────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}