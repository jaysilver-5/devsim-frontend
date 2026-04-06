// app/auth/sso-callback/page.tsx
"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function SSOCallback() {
  const [showFallback, setShowFallback] = useState(false);

  // If the callback takes too long, show a manual redirect link
  useEffect(() => {
    const timer = setTimeout(() => setShowFallback(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-ds-base">
      <div className="text-center">
        <div className="text-lg font-bold text-ds-primary-muted mb-3 tracking-tight">
          devsim
        </div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-ds-primary animate-bounce [animation-delay:0ms]" />
          <div className="w-1.5 h-1.5 rounded-full bg-ds-primary animate-bounce [animation-delay:150ms]" />
          <div className="w-1.5 h-1.5 rounded-full bg-ds-primary animate-bounce [animation-delay:300ms]" />
        </div>
        <p className="text-sm text-ds-text-dim">Signing you in...</p>

        {showFallback && (
          <div className="mt-6 space-y-2">
            <p className="text-xs text-ds-text-faint">
              Taking longer than expected?
            </p>
            <a
              href="/onboarding"
              className="inline-block text-xs text-ds-primary-muted hover:underline"
            >
              Continue manually &rarr;
            </a>
          </div>
        )}
      </div>

      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/onboarding"
        signUpFallbackRedirectUrl="/onboarding"
      />
    </div>
  );
}