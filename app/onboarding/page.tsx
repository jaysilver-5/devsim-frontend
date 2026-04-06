// app/onboarding/page.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { ROLE_CONFIG, STACK_LABELS, TRACK_INFO } from "@/lib/constants";
import type { Role, Stack, Track } from "@/lib/types";

type Step = 1 | 2 | 3;

const ROLE_OPTIONS: Role[] = ["LEARNER", "HIRING_MANAGER", "INSTRUCTOR", "CANDIDATE"];

const ROLE_COLORS: Record<Role, string> = {
  LEARNER: "bg-ds-primary/12 text-ds-primary-muted",
  HIRING_MANAGER: "bg-ds-success/12 text-ds-success",
  INSTRUCTOR: "bg-[#E17055]/12 text-[#E17055]",
  CANDIDATE: "bg-ds-info/12 text-ds-info",
  ADMIN: "bg-ds-text-faint/12 text-ds-text-faint",
};

const STACKS_BY_TRACK: Record<Track, Stack[]> = {
  BACKEND: ["NODE_EXPRESS_PRISMA", "PYTHON_FASTAPI", "PYTHON_DJANGO", "GO_GIN", "JAVA_SPRING"],
  FRONTEND: ["REACT_NEXTJS", "REACT_VITE", "VUE_NUXT", "SVELTE_KIT"],
  FULLSTACK: ["FULLSTACK_NEXTJS", "FULLSTACK_REMIX"],
  CYBERSECURITY: ["CYBER_PENTEST", "CYBER_INCIDENT_RESPONSE", "CYBER_SECURE_CODE"],
};

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<Role>("LEARNER");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [experience, setExperience] = useState("mid");
  const [company, setCompany] = useState("");
  const [selectedTracks, setSelectedTracks] = useState<Track[]>(["BACKEND"]);
  const [selectedStacks, setSelectedStacks] = useState<Stack[]>(["NODE_EXPRESS_PRISMA"]);
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();

  // Already onboarded? Redirect out.
  if (isLoaded && user?.unsafeMetadata?.onboardingComplete === true) {
    const r = (user.unsafeMetadata.role as string) || "LEARNER";
    const dest = ROLE_CONFIG[r as Role]?.dashboardPath || "/dashboard";
    router.replace(dest);
    return null;
  }

  const toggleTrack = (track: Track) => {
    setSelectedTracks((prev) =>
      prev.includes(track) ? prev.filter((t) => t !== track) : [...prev, track]
    );
  };

  const toggleStack = (stack: Stack) => {
    setSelectedStacks((prev) =>
      prev.includes(stack) ? prev.filter((s) => s !== stack) : [...prev, stack]
    );
  };

  const handlePromo = async () => {
    if (!promoCode.trim()) return;
    try {
      const token = await getToken();
      if (!token) return;
      const result = (await api.promo.redeem(promoCode, token)) as { message: string };
      setPromoResult(result.message);
    } catch {
      setPromoResult("Invalid or expired code");
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError("");

    try {
      // Step 1: Update Clerk unsafeMetadata (this controls client-side routing)
      if (!user) throw new Error("User not loaded");

      console.log("[onboarding] Updating Clerk metadata...");
      await user.update({
        unsafeMetadata: {
          onboardingComplete: true,
          role,
          experience,
          preferredStacks: selectedStacks,
        },
      });
      console.log("[onboarding] Clerk metadata updated");

      // Step 2: Set role on backend (may fail if webhook hasn't fired yet — that's ok)
      try {
        const token = await getToken();
        if (token) {
          console.log("[onboarding] Setting role on backend...");
          await api.auth.setRole(role, token);
          console.log("[onboarding] Backend role set");
        }
      } catch (backendErr) {
        // Non-fatal: the webhook will sync eventually, and ensureUser handles stub creation
        console.warn("[onboarding] Backend setRole failed (non-fatal):", backendErr);
      }

      // Step 3: Navigate to dashboard
      const dest = ROLE_CONFIG[role]?.dashboardPath || "/dashboard";
      console.log("[onboarding] Redirecting to:", dest);
      router.push(dest);
    } catch (err) {
      console.error("[onboarding] Failed:", err);
      setError(err instanceof Error ? err.message : "Failed to complete onboarding");
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-sm text-ds-text-dim">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-[480px] py-10">
        <div className="text-center text-lg font-bold text-ds-primary-muted tracking-tight mb-8">
          devsim
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-[3px] rounded-full transition-colors ${
                s < step ? "bg-ds-success" : s === step ? "bg-ds-primary" : "bg-ds-border"
              }`}
            />
          ))}
        </div>

        {/* ─── Step 1: Role ─────────────────────────── */}
        {step === 1 && (
          <div>
            <p className="text-[11px] text-ds-text-faint uppercase tracking-wider mb-1.5">Step 1 of 3</p>
            <h2 className="text-[22px] font-semibold text-ds-text tracking-tight mb-1">How will you use DevSim?</h2>
            <p className="text-sm text-ds-text-dim mb-7 leading-relaxed">
              This shapes your dashboard and what features you see first. You can always access everything later.
            </p>

            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {ROLE_OPTIONS.map((r) => {
                const cfg = ROLE_CONFIG[r];
                const selected = role === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      selected ? "border-ds-primary bg-ds-primary/5" : "border-ds-border bg-ds-surface hover:border-ds-border-strong"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold mb-2.5 ${ROLE_COLORS[r]}`}>
                      {cfg.icon}
                    </div>
                    <div className="text-[13px] font-semibold text-ds-text mb-0.5">{cfg.label}</div>
                    <div className="text-[11px] text-ds-text-dim leading-snug">{cfg.description}</div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-lg bg-ds-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Continue
            </button>
          </div>
        )}

        {/* ─── Step 2: Profile ──────────────────────── */}
        {step === 2 && (
          <div>
            <p className="text-[11px] text-ds-text-faint uppercase tracking-wider mb-1.5">Step 2 of 3</p>
            <h2 className="text-[22px] font-semibold text-ds-text tracking-tight mb-1">Set up your profile</h2>
            <p className="text-sm text-ds-text-dim mb-7 leading-relaxed">Quick basics so your team knows who you are in simulations.</p>

            <div className="grid grid-cols-2 gap-2.5 mb-3.5">
              <div>
                <label className="block text-[11px] text-ds-text-dim font-medium mb-1.5">Display name</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Joshua U."
                  className="w-full px-3 py-2.5 rounded-lg border border-ds-border-strong bg-ds-base text-ds-text-secondary text-sm placeholder:text-ds-text-ghost focus:border-ds-primary focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] text-ds-text-dim font-medium mb-1.5">Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="joshuau"
                  className="w-full px-3 py-2.5 rounded-lg border border-ds-border-strong bg-ds-base text-ds-text-secondary text-sm placeholder:text-ds-text-ghost focus:border-ds-primary focus:outline-none" />
              </div>
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] text-ds-text-dim font-medium mb-2">Experience level</label>
              <div className="flex gap-2">
                {[
                  { key: "junior", label: "Junior (0-2 yrs)" },
                  { key: "mid", label: "Mid (2-5 yrs)" },
                  { key: "senior", label: "Senior (5+ yrs)" },
                ].map((opt) => (
                  <button key={opt.key} onClick={() => setExperience(opt.key)}
                    className={`px-3.5 py-[7px] rounded-lg border text-xs transition-all ${
                      experience === opt.key
                        ? "border-ds-primary bg-ds-primary/8 text-ds-primary-muted"
                        : "border-ds-border-strong bg-ds-surface text-ds-text-muted hover:bg-ds-elevated"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[11px] text-ds-text-dim font-medium mb-1.5">Company / school (optional)</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Where do you work or study?"
                className="w-full px-3 py-2.5 rounded-lg border border-ds-border-strong bg-ds-base text-ds-text-secondary text-sm placeholder:text-ds-text-ghost focus:border-ds-primary focus:outline-none" />
            </div>

            <button onClick={() => setStep(3)} className="w-full py-3 rounded-lg bg-ds-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
              Continue
            </button>
            <button onClick={() => setStep(3)} className="w-full text-center mt-3 text-xs text-ds-text-faint hover:text-ds-text-dim">
              Skip for now
            </button>
          </div>
        )}

        {/* ─── Step 3: Stacks + Promo ───────────────── */}
        {step === 3 && (
          <div>
            <p className="text-[11px] text-ds-text-faint uppercase tracking-wider mb-1.5">Step 3 of 3</p>
            <h2 className="text-[22px] font-semibold text-ds-text tracking-tight mb-1">What do you want to work on?</h2>
            <p className="text-sm text-ds-text-dim mb-7 leading-relaxed">Pick your tracks. We&apos;ll surface the right simulations first.</p>

            {/* Tracks */}
            <div className="mb-4">
              <label className="block text-[11px] text-ds-text-dim font-medium mb-2">Tracks</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TRACK_INFO) as Track[]).map((track) => {
                  const info = TRACK_INFO[track];
                  const selected = selectedTracks.includes(track);
                  return (
                    <button key={track} onClick={() => info.available && toggleTrack(track)} disabled={!info.available}
                      className={`px-3.5 py-[7px] rounded-lg border text-xs transition-all ${
                        !info.available
                          ? "border-ds-border bg-ds-surface text-ds-text-ghost cursor-default opacity-40"
                          : selected
                            ? "border-ds-primary bg-ds-primary/8 text-ds-primary-muted"
                            : "border-ds-border-strong bg-ds-surface text-ds-text-muted hover:bg-ds-elevated"
                      }`}>
                      {info.name}{!info.available && " (soon)"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stacks */}
            <div className="mb-6">
              <label className="block text-[11px] text-ds-text-dim font-medium mb-2">Preferred stacks</label>
              <div className="flex flex-wrap gap-2">
                {selectedTracks.flatMap((track) =>
                  (STACKS_BY_TRACK[track] || []).map((stack) => {
                    const selected = selectedStacks.includes(stack);
                    return (
                      <button key={stack} onClick={() => toggleStack(stack)}
                        className={`px-3.5 py-[7px] rounded-lg border text-xs transition-all ${
                          selected
                            ? "border-ds-primary bg-ds-primary/8 text-ds-primary-muted"
                            : "border-ds-border-strong bg-ds-surface text-ds-text-muted hover:bg-ds-elevated"
                        }`}>
                        {STACK_LABELS[stack]}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Promo code */}
            <div className="p-3.5 bg-ds-success/5 border border-ds-success/15 rounded-lg mb-6">
              <div className="text-xs text-ds-success font-medium mb-2">Have a promo code?</div>
              <div className="flex gap-2">
                <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="EARLYACCESS"
                  className="flex-1 px-2.5 py-2 rounded-md border border-ds-success/25 bg-ds-base text-ds-text-secondary text-xs placeholder:text-ds-text-ghost focus:border-ds-success focus:outline-none" />
                <button onClick={handlePromo}
                  className="px-4 py-2 rounded-md border border-ds-success/25 bg-ds-success/8 text-ds-success text-xs font-semibold hover:bg-ds-success/15 transition-colors">
                  Apply
                </button>
              </div>
              {promoResult && <p className="text-xs text-ds-success mt-2">{promoResult}</p>}
            </div>

            {error && (
              <div className="text-xs text-ds-danger bg-ds-danger-bg rounded-lg px-3 py-2 mb-4">{error}</div>
            )}

            <button
              onClick={handleComplete}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-ds-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {loading ? "Setting up..." : "Launch dashboard"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}