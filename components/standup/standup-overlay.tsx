// components/standup/standup-overlay.tsx
//
// Smart standup launcher:
//   1. Tries OpenAI Realtime (WebRTC) first — best UX
//   2. If bootstrap fails (no OPENAI_API_KEY, network error, WebRTC blocked),
//      StandupRealtimeCall fires onFallback and we switch to Socket.io pipeline
//   3. No probe call — avoids wasting an OpenAI client secret just to check availability

"use client";

import { useCallback, useState } from "react";
import { StandupRealtimeCall } from "./StandupRealtimeCall";
import { StandupCall } from "./StandupCall";

type StandupMode = "realtime" | "socket";

export function StandupOverlay({
  sessionId,
  standupNumber,
  onComplete,
  onEnd,
}: {
  sessionId: string;
  standupNumber: number;
  onComplete: () => void;
  onEnd: () => void;
}) {
  const [mode, setMode] = useState<StandupMode>("realtime");

  const handleFallback = useCallback(() => {
    console.log("[standup] Realtime unavailable, falling back to socket pipeline");
    setMode("socket");
  }, []);

  if (mode === "realtime") {
    return (
      <StandupRealtimeCall
        sessionId={sessionId}
        standupNumber={standupNumber}
        onComplete={onComplete}
        onEnd={onEnd}
        onFallback={handleFallback}
      />
    );
  }

  return (
    <StandupCall
      sessionId={sessionId}
      standupNumber={standupNumber}
      onComplete={onComplete}
      onEnd={onEnd}
    />
  );
}
