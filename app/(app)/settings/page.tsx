// app/(app)/settings/page.tsx
"use client";

import { useUser } from "@clerk/nextjs";
import { ROLE_CONFIG } from "@/lib/constants";
import type { Role } from "@/lib/types";

export default function SettingsPage() {
  const { user } = useUser();
  const role = (user?.unsafeMetadata?.role as Role) || "LEARNER";

  return (
    <div className="px-5 py-6 max-w-[700px] mx-auto">
      <h1 className="text-lg font-semibold text-ds-text tracking-tight mb-1">
        Settings
      </h1>
      <p className="text-sm text-ds-text-dim mb-6">
        Manage your profile and preferences.
      </p>

      {/* Profile section */}
      <div className="p-5 rounded-lg bg-ds-surface border border-ds-border mb-4">
        <h2 className="text-[13px] font-semibold text-ds-text-secondary mb-4">
          Profile
        </h2>

        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-ds-primary/15 flex items-center justify-center text-lg font-bold text-ds-primary-muted">
            {user?.firstName?.[0] || user?.username?.[0] || "?"}
            {user?.lastName?.[0] || ""}
          </div>
          <div>
            <div className="text-sm font-medium text-ds-text">
              {user?.fullName || user?.username || "User"}
            </div>
            <div className="text-xs text-ds-text-dim">
              {user?.primaryEmailAddress?.emailAddress}
            </div>
            <div className="text-[10px] text-ds-text-faint mt-0.5">
              Role: {ROLE_CONFIG[role]?.label || role}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-ds-text-dim font-medium mb-1.5">
              Display name
            </label>
            <input
              defaultValue={user?.fullName || ""}
              className="w-full px-3 py-2.5 rounded-lg border border-ds-border-strong bg-ds-base text-ds-text-secondary text-sm placeholder:text-ds-text-ghost focus:border-ds-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-ds-text-dim font-medium mb-1.5">
              Username
            </label>
            <input
              defaultValue={user?.username || ""}
              className="w-full px-3 py-2.5 rounded-lg border border-ds-border-strong bg-ds-base text-ds-text-secondary text-sm placeholder:text-ds-text-ghost focus:border-ds-primary focus:outline-none"
            />
          </div>
        </div>

        <button className="mt-4 px-4 py-2 rounded-md bg-ds-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity">
          Save changes
        </button>
      </div>

      {/* Danger zone */}
      <div className="p-5 rounded-lg bg-ds-surface border border-ds-danger/20">
        <h2 className="text-[13px] font-semibold text-ds-danger mb-2">
          Danger zone
        </h2>
        <p className="text-xs text-ds-text-dim mb-3">
          Permanently delete your account and all associated data.
        </p>
        <button className="px-4 py-2 rounded-md border border-ds-danger/30 bg-ds-danger/8 text-ds-danger text-xs font-semibold hover:bg-ds-danger/15 transition-colors">
          Delete account
        </button>
      </div>
    </div>
  );
}