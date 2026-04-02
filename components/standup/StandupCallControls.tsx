// components/standup/StandupCallControls.tsx
"use client";

import { Keyboard, Mic, MicOff, PhoneOff } from "lucide-react";

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

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onOpenTextFallback}
          className="w-12 h-12 rounded-full border border-ds-border bg-ds-surface text-ds-text-dim hover:text-ds-text hover:bg-ds-elevated transition-colors flex items-center justify-center"
          aria-label="Use text instead"
          title="Use text instead"
        >
          <Keyboard className="w-5 h-5" />
        </button>

        <button
          onMouseDown={() => !micDisabled && onStartRecording()}
          onMouseUp={() => recording && onStopRecording()}
          onMouseLeave={() => recording && onStopRecording()}
          onTouchStart={() => !micDisabled && onStartRecording()}
          onTouchEnd={() => recording && onStopRecording()}
          onClick={() => {
            if (micDisabled) return;
            if (recording) onStopRecording();
            else onStartRecording();
          }}
          disabled={micDisabled}
          className={[
            "w-20 h-20 rounded-full flex items-center justify-center transition-all border-2",
            recording
              ? "bg-ds-danger/20 text-ds-danger border-ds-danger shadow-[0_0_30px_rgba(255,107,107,0.25)] scale-105"
              : "bg-ds-primary/15 text-ds-primary-muted border-ds-primary/30 hover:bg-ds-primary/25",
            micDisabled ? "opacity-40 cursor-not-allowed" : "",
          ].join(" ")}
          aria-label={recording ? "Stop recording" : "Start recording"}
          title={
            micAllowed === false
              ? "Microphone unavailable"
              : recording
              ? "Stop recording"
              : "Hold or tap to speak"
          }
        >
          {recording ? (
            <MicOff className="w-7 h-7" />
          ) : (
            <Mic className="w-7 h-7" />
          )}
        </button>

        <button
          onClick={onEnd}
          className="w-12 h-12 rounded-full border border-ds-danger/30 bg-ds-danger/10 text-ds-danger hover:bg-ds-danger/15 transition-colors flex items-center justify-center"
          aria-label="End call"
          title="End call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-4 text-center">
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
              : "Go ahead"
            : state === "THINKING"
            ? "Sarah is thinking..."
            : "Call ended"}
        </div>

        <div className="mt-1 text-xs text-ds-text-faint">
          {state === "LISTENING" && micAllowed !== false
            ? recording
              ? "Release to send"
              : "Hold or tap the mic to speak"
            : state === "PM_SPEAKING"
            ? "Listen for the next question"
            : state === "THINKING"
            ? "One moment"
            : ""}
        </div>
      </div>
    </div>
  );
}