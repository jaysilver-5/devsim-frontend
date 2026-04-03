// components/standup/StandupCallControls.tsx
"use client";

import { useRef, useCallback } from "react";
import { Keyboard, Mic, Square, PhoneOff } from "lucide-react";

type CallState =
  | "CONNECTING"
  | "PM_SPEAKING"
  | "LISTENING"
  | "THINKING"
  | "ENDED";

type Props = {
  state: CallState;
  recording: boolean;
  micAllowed: boolean | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onEnd: () => void;
  onOpenTextFallback: () => void;
};

export function StandupCallControls({
  state,
  recording,
  micAllowed,
  onStartRecording,
  onStopRecording,
  onEnd,
  onOpenTextFallback,
}: Props) {
  const canTalk = state === "LISTENING";
  const micDisabled = !canTalk || micAllowed === false;

  // Track whether the user is doing a long-press (hold-to-talk)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);

  const handlePointerDown = useCallback(() => {
    if (micDisabled) return;

    if (recording) {
      // Already recording — pointer down means nothing special
      return;
    }

    // Start a hold timer: if they hold > 300ms, treat as hold-to-talk
    isHoldingRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      onStartRecording();
    }, 300);
  }, [micDisabled, recording, onStartRecording]);

  const handlePointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isHoldingRef.current && recording) {
      // Was a hold-to-talk — stop on release
      isHoldingRef.current = false;
      onStopRecording();
      return;
    }

    isHoldingRef.current = false;
  }, [recording, onStopRecording]);

  const handleClick = useCallback(() => {
    if (micDisabled) return;

    // If we handled this as a hold gesture, skip the click
    if (isHoldingRef.current) return;

    // Tap-to-toggle
    if (recording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  }, [micDisabled, recording, onStartRecording, onStopRecording]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-center gap-5">
        {/* Text fallback */}
        <button
          onClick={onOpenTextFallback}
          className="w-12 h-12 rounded-full border border-ds-border bg-ds-surface/60 text-ds-text-dim hover:text-ds-text hover:bg-ds-elevated transition-colors flex items-center justify-center"
          aria-label="Type instead"
          title="Type your response instead"
        >
          <Keyboard className="w-5 h-5" />
        </button>

        {/* Mic button: tap-to-toggle + hold-to-talk */}
        <button
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onClick={handleClick}
          disabled={micDisabled}
          className={[
            "w-20 h-20 rounded-full flex items-center justify-center transition-all border-2 select-none",
            recording
              ? "bg-ds-danger/20 text-ds-danger border-ds-danger shadow-[0_0_40px_rgba(255,107,107,0.2)] scale-110"
              : canTalk
              ? "bg-ds-primary/15 text-ds-primary-muted border-ds-primary/30 hover:bg-ds-primary/25 hover:scale-105"
              : "bg-ds-surface/30 text-ds-text-faint border-ds-border opacity-50",
            micDisabled && !recording ? "cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording ? (
            <Square className="w-7 h-7" />
          ) : (
            <Mic className="w-7 h-7" />
          )}
        </button>

        {/* End call */}
        <button
          onClick={onEnd}
          className="w-12 h-12 rounded-full border border-ds-danger/30 bg-ds-danger/10 text-ds-danger hover:bg-ds-danger/20 transition-colors flex items-center justify-center"
          aria-label="End call"
          title="End standup"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Status text */}
      <div className="mt-5 text-center">
        <div className="text-sm text-ds-text">
          {state === "CONNECTING"
            ? "Sarah is joining..."
            : state === "PM_SPEAKING"
            ? "Sarah is speaking"
            : state === "LISTENING"
            ? recording
              ? "Listening..."
              : micAllowed === false
              ? "Mic unavailable — use text"
              : "Your turn — tap the mic"
            : state === "THINKING"
            ? "Sarah is thinking..."
            : "Call ended"}
        </div>

        {state === "LISTENING" && micAllowed !== false && (
          <div className="mt-1 text-xs text-ds-text-faint">
            {recording
              ? "Tap to stop, or hold and release"
              : "Tap to start, or hold to talk"}
          </div>
        )}
      </div>
    </div>
  );
}