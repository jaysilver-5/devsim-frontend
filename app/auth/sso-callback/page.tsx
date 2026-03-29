// app/auth/sso-callback/page.tsx
"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallback() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="text-center">
        <div className="text-lg font-bold text-ds-primary-muted mb-2">devsim</div>
        <p className="text-sm text-ds-text-dim">Authenticating...</p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}