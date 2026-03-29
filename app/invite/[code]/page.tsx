// app/invite/[code]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "auth" | "joining" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSignedIn) {
      setStatus("auth");
      return;
    }

    async function joinAssessment() {
      setStatus("joining");
      try {
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");

        // POST /assessments/invite/:code/join
        const data = (await api.assessments.join(code, token)) as {
          sessionId?: string;
          candidate?: { sessionId?: string };
        };

        const sessionId = data.sessionId || data.candidate?.sessionId;
        if (sessionId) {
          router.push(`/workspace/${sessionId}`);
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setStatus("error");
      }
    }

    joinAssessment();
  }, [isSignedIn, code, getToken, router]);

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-lg font-bold text-ds-primary-muted mb-2">devsim</div>

        {status === "loading" && (
          <p className="text-sm text-ds-text-dim">Loading...</p>
        )}

        {status === "auth" && (
          <div>
            <p className="text-sm text-ds-text-dim mb-4">
              You&apos;ve been invited to an assessment. Sign in to get started.
            </p>
            <div className="inline-block px-5 py-2.5 rounded-lg bg-ds-primary text-white text-sm font-semibold cursor-pointer hover:opacity-90">
              <SignInButton mode="modal" forceRedirectUrl={`/invite/${code}`}>
                Sign in to continue
              </SignInButton>
            </div>
            <p className="text-xs text-ds-text-faint mt-3">
              Invite code: <code className="text-ds-primary-muted">{code}</code>
            </p>
          </div>
        )}

        {status === "joining" && (
          <div>
            <p className="text-sm text-ds-text-dim mb-2">Joining assessment...</p>
            <p className="text-xs text-ds-text-faint">Invite code: <code className="text-ds-primary-muted">{code}</code></p>
          </div>
        )}

        {status === "error" && (
          <div>
            <p className="text-sm text-ds-danger mb-3">{error}</p>
            <button onClick={() => router.push("/dashboard")} className="px-4 py-2 rounded-md bg-ds-primary text-white text-xs font-semibold">Go to dashboard</button>
          </div>
        )}
      </div>
    </div>
  );
}