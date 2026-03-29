// app/(app)/layout.tsx
"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { NAV_LINKS, ROLE_CONFIG } from "@/lib/constants";
import type { Role } from "@/lib/types";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  const onboardingComplete = user?.unsafeMetadata?.onboardingComplete === true;
  const role = (user?.unsafeMetadata?.role as Role) || "LEARNER";
  const links = NAV_LINKS[role] || NAV_LINKS.LEARNER;

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (isLoaded && user && !onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [isLoaded, user, onboardingComplete, router]);

  // Show nothing while loading or redirecting to onboarding
  if (!isLoaded || !user) {
    return (
      <div className="min-h-dvh bg-ds-base flex items-center justify-center">
        <div className="text-sm text-ds-text-dim">Loading...</div>
      </div>
    );
  }

  if (!onboardingComplete) {
    return (
      <div className="min-h-dvh bg-ds-base flex items-center justify-center">
        <div className="text-sm text-ds-text-dim">Redirecting to onboarding...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-ds-base">
      {/* Top navigation */}
      <nav className="flex items-center justify-between h-12 px-5 border-b border-ds-border bg-ds-base sticky top-0 z-50">
        <div className="flex items-center gap-5">
          <Link
            href={ROLE_CONFIG[role]?.dashboardPath || "/dashboard"}
            className="text-base font-bold text-ds-primary-muted tracking-tight hover:text-ds-primary transition-colors"
          >
            devsim
          </Link>

          <div className="flex gap-1">
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                    active
                      ? "text-ds-text-secondary bg-ds-elevated"
                      : "text-ds-text-dim hover:text-ds-text-secondary"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <CreditPill role={role} />
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-7 h-7",
              },
            }}
          />
        </div>
      </nav>

      {/* Page content */}
      <main>{children}</main>
    </div>
  );
}

function CreditPill({ role }: { role: Role }) {
  if (role === "HIRING_MANAGER") {
    return (
      <Link
        href="/billing"
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-ds-success/8 border border-ds-success/20 text-[11px] text-ds-success font-semibold hover:bg-ds-success/15 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-ds-success" />
        Candidate credits
      </Link>
    );
  }

  if (role === "INSTRUCTOR") {
    return (
      <Link
        href="/billing"
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E17055]/8 border border-[#E17055]/20 text-[11px] text-[#E17055] font-semibold hover:bg-[#E17055]/15 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#E17055]" />
        Student credits
      </Link>
    );
  }

  return (
    <Link
      href="/billing"
      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-ds-primary/8 border border-ds-primary/20 text-[11px] text-ds-primary-muted font-semibold hover:bg-ds-primary/15 transition-colors"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-ds-primary" />
      Sprint credits
    </Link>
  );
}