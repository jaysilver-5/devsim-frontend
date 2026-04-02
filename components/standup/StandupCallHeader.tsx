// components/standup/StandupCallHeader.tsx
"use client";

import { PhoneOff } from "lucide-react";

type Props = {
  elapsedLabel: string;
  statusLabel: string;
  onEnd: () => void;
};

export function StandupCallHeader({
  elapsedLabel,
  statusLabel,
  onEnd,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative">
          <div className="w-14 h-14 rounded-full bg-persona-sarah/15 flex items-center justify-center text-persona-sarah font-bold text-lg">
            SC
          </div>
          <span className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-ds-success opacity-50 animate-ping" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-ds-success" />
          </span>
        </div>

        <div className="min-w-0">
          <div className="text-base font-semibold text-ds-text truncate">
            Sarah Chen
          </div>
          <div className="text-xs text-ds-text-dim flex items-center gap-2">
            <span>PM • live standup</span>
            <span className="text-ds-text-faint">•</span>
            <span>{statusLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-xs text-ds-text-faint tabular-nums">
          {elapsedLabel}
        </div>

        <button
          onClick={onEnd}
          className="w-10 h-10 rounded-full bg-ds-danger/15 text-ds-danger hover:bg-ds-danger/25 transition-colors flex items-center justify-center"
          aria-label="End call"
          title="End call"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}