// components/standup/StandupTextFallback.tsx
"use client";

import { Send, X } from "lucide-react";

type Props = {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function StandupTextFallback({
  open,
  value,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  if (!open) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
      <div className="max-w-2xl mx-auto rounded-2xl border border-ds-border bg-ds-surface/95 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ds-border-subtle">
          <div className="text-sm font-medium text-ds-text">
            Type your response
          </div>
          <button
            onClick={onClose}
            className="text-ds-text-faint hover:text-ds-text"
            aria-label="Close text input"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            placeholder="Tell Sarah how it went..."
            className="w-full px-4 py-3 rounded-xl border border-ds-border-strong bg-ds-base text-sm text-ds-text placeholder:text-ds-text-ghost focus:outline-none focus:border-ds-primary resize-none"
          />

          <div className="mt-3 flex justify-end">
            <button
              onClick={onSubmit}
              disabled={!value.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-ds-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}