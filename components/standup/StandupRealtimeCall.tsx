// components/standup/StandupRealtimeCall.tsx
//
// OpenAI Realtime standup call.
//
// Voice I/O: OpenAI Realtime (WebRTC, sub-300ms latency)
// Scoring & context: DevSim backend via REST (completeTurnText)
//
// The user talks to Sarah via OpenAI Realtime. When the user finishes
// speaking (semantic VAD), we get a transcript, POST it to the backend
// for scoring and follow-up generation, then inject the follow-up back
// into the realtime session for OpenAI to speak naturally.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Mic, PhoneOff, Volume2, Sparkles, Loader2, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import {
  createRealtimeSession,
  injectAssistantMessage,
  type RealtimeSession,
  type RealtimeEvent,
} from "@/lib/standup-realtime";
import { StandupCallTranscript } from "./StandupCallTranscript";
import type { StandupRealtimeBootstrap } from "@/lib/types";

type CallPhase =
  | "CONNECTING"
  | "SARAH_SPEAKING"
  | "LISTENING"
  | "PROCESSING"
  | "ENDED"
  | "FAILED";

type TranscriptItem = {
  id: string;
  speaker: "sarah" | "you";
  text: string;
  turnNumber?: number;
  score?: number | null;
};

type TurnScore = {
  turnNumber: number;
  overall: number;
};

const STRATEGY_LABELS: Record<string, string> = {
  BROAD_TASK_PROBE: "Overview",
  REQUIREMENT_DRILL: "Requirements",
  EDGE_CASE_PROBE: "Edge cases",
  INTEGRATION_READINESS: "Handoff",
};

export function StandupRealtimeCall({
  standupNumber,
  sessionId,
  onComplete,
  onEnd,
  onFallback,
}: {
  standupNumber: number;
  sessionId: string;
  onComplete: () => void;
  onEnd: () => void;
  onFallback?: () => void;
}) {
  const { getToken } = useAuth();

  const [phase, setPhase] = useState<CallPhase>("CONNECTING");
  const [turnNumber, setTurnNumber] = useState(1);
  const [strategy, setStrategy] = useState("BROAD_TASK_PROBE");
  const [standupId, setStandupId] = useState<string | null>(null);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [scores, setScores] = useState<TurnScore[]>([]);
  const [finalScores, setFinalScores] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sarahSpeaking, setSarahSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const sessionRef = useRef<RealtimeSession | null>(null);
  const standupIdRef = useRef<string | null>(null);
  const turnNumberRef = useRef(1);
  const processingRef = useRef(false);
  const phaseRef = useRef<CallPhase>("CONNECTING");
  const bootstrapRef = useRef<StandupRealtimeBootstrap | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { standupIdRef.current = standupId; }, [standupId]);
  useEffect(() => { turnNumberRef.current = turnNumber; }, [turnNumber]);

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const addItem = useCallback(
    (speaker: "sarah" | "you", text: string, extra?: Partial<TranscriptItem>) => {
      if (!text.trim()) return;
      setItems((prev) => [
        ...prev,
        {
          id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          speaker,
          text: text.trim(),
          ...extra,
        },
      ]);
    },
    [],
  );

  const attachScore = useCallback((turn: number, overall: number) => {
    setItems((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].speaker === "you" && next[i].turnNumber === turn) {
          next[i] = { ...next[i], score: overall };
          break;
        }
      }
      return next;
    });
  }, []);

  // ─── Process a completed user transcript ────────────
  const processTranscript = useCallback(
    async (transcript: string) => {
      if (processingRef.current || !standupIdRef.current || phaseRef.current === "ENDED") {
        return;
      }

      processingRef.current = true;
      setPhase("PROCESSING");

      // Add user's transcript to the conversation
      addItem("you", transcript, { turnNumber: turnNumberRef.current });

      try {
        const token = await getToken();
        const result = (await api.standup.completeTurnTextLite(
          standupIdRef.current,
          turnNumberRef.current,
          transcript,
          token || undefined,
        )) as any;

        // Handle scores
        if (result?.turnScore?.overall) {
          const turn = turnNumberRef.current;
          setScores((prev) => [
            ...prev.filter((s) => s.turnNumber !== turn),
            { turnNumber: turn, overall: result.turnScore.overall },
          ]);
          attachScore(turn, result.turnScore.overall);
        }

        // Standup complete?
        if (result?.isComplete) {
          if (result.closingLine) {
            addItem("sarah", result.closingLine);
            // Inject closing line for Sarah to speak
            if (sessionRef.current?.dc) {
              injectAssistantMessage(sessionRef.current.dc, result.closingLine);
            }
          }
          setFinalScores(result.scores || null);

          // Wait a moment for Sarah to speak the closing, then end
          setTimeout(() => {
            setPhase("ENDED");
            sessionRef.current?.close();
            setTimeout(onComplete, 1000);
          }, 4000);

          processingRef.current = false;
          return;
        }

        // More turns — inject follow-up for Sarah to speak
        if (result?.pmFollowUp) {
          addItem("sarah", result.pmFollowUp, {
            turnNumber: result.turnNumber,
          });

          // Inject into the realtime session — OpenAI will speak it naturally
          if (sessionRef.current?.dc) {
            injectAssistantMessage(sessionRef.current.dc, result.pmFollowUp);
          }

          setSarahSpeaking(true);
          setPhase("SARAH_SPEAKING");
        }

        setTurnNumber(result?.turnNumber || turnNumberRef.current + 1);
        if (result?.strategy) setStrategy(result.strategy);
      } catch (err: any) {
        setError(err?.message || "Failed to process your response.");
        // Don't get stuck — go back to listening
        setPhase("LISTENING");
      } finally {
        processingRef.current = false;
      }
    },
    [addItem, attachScore, getToken, onComplete],
  );

  // ─── Handle realtime events ─────────────────────────
  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        case "connected":
          // Connection established, Sarah will speak the opening line
          setSarahSpeaking(true);
          setPhase("SARAH_SPEAKING");
          break;

        case "transcript_complete":
          // User finished speaking — process the transcript
          setUserSpeaking(false);
          processTranscript(event.transcript);
          break;

        case "speech_started":
          setUserSpeaking(true);
          setPhase("LISTENING");
          setSarahSpeaking(false);
          break;

        case "speech_stopped":
          setUserSpeaking(false);
          break;

        case "assistant_done":
          // Sarah finished speaking — mic is live
          setSarahSpeaking(false);
          if (phaseRef.current !== "PROCESSING" && phaseRef.current !== "ENDED") {
            setPhase("LISTENING");
          }
          break;

        case "disconnected":
          if (phaseRef.current !== "ENDED") {
            setError("Voice connection lost. Attempting to reconnect...");
          }
          break;

        case "error":
          setError(event.message);
          break;
      }
    },
    [processTranscript],
  );

  // ─── Bootstrap the realtime session ─────────────────
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        // 1. Get ephemeral client secret + standup context from backend
        const data = (await api.realtime.createStandupClientSecret(
          sessionId,
          standupNumber,
          token,
        )) as StandupRealtimeBootstrap;

        if (cancelled) return;

        bootstrapRef.current = data;
        setStandupId(data.standupId);
        setTurnNumber(data.turnNumber);
        setStrategy(data.strategy);

        // Add Sarah's opening line to transcript
        if (data.openingLine) {
          addItem("sarah", data.openingLine, { turnNumber: data.turnNumber });
        }

        // 2. Extract the ephemeral token
        const clientSecretValue = data.clientSecret?.client_secret?.value;
        if (!clientSecretValue) {
          throw new Error("No client secret returned from backend");
        }

        // 3. Establish WebRTC connection to OpenAI Realtime
        const session = await createRealtimeSession(
          clientSecretValue,
          handleRealtimeEvent,
          data.clientSecret?.session?.model as string | undefined,
        );

        if (cancelled) {
          session.close();
          return;
        }

        sessionRef.current = session;
      } catch (err: any) {
        if (!cancelled) {
          // If realtime isn't available, fall back to socket pipeline
          if (onFallback) {
            console.warn("[standup-realtime] Bootstrap failed, falling back:", err?.message);
            onFallback();
          } else {
            setError(err?.message || "Failed to start voice call");
            setPhase("FAILED");
          }
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      sessionRef.current?.close();
      sessionRef.current = null;
    };
  }, [addItem, getToken, handleRealtimeEvent, onFallback, sessionId, standupNumber]);

  // ─── End call ───────────────────────────────────────
  const handleEnd = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setPhase("ENDED");
    onEnd();
  }, [onEnd]);

  // ─── UI ─────────────────────────────────────────────
  const elapsed = useMemo(() => {
    const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
    const s = (elapsedSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [elapsedSeconds]);

  const latestSarah = [...items].reverse().find((i) => i.speaker === "sarah")?.text || "Sarah is joining...";
  const latestYou = [...items].reverse().find((i) => i.speaker === "you")?.text || "";
  const currentScore = scores.find((s) => s.turnNumber === turnNumber);

  return (
    <div className="fixed inset-0 z-[100] bg-[#08111e] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(91,113,248,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.12),transparent_30%)]" />

      <div className="relative h-full grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 p-4 xl:p-5">
        <section className="min-h-0 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-4 md:p-5 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">
                Standup #{standupNumber}
              </div>
              <div className="text-lg md:text-xl font-semibold">
                Live voice check-in
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-emerald-300/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Realtime
              </div>
              <div className="text-sm text-white/55 tabular-nums">{elapsed}</div>
            </div>
          </div>

          {/* Participants */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Sarah */}
            <div
              className={[
                "rounded-[24px] border p-5 flex flex-col justify-between min-h-[280px]",
                sarahSpeaking
                  ? "border-violet-400/40 bg-violet-500/10"
                  : "border-white/10 bg-black/20",
              ].join(" ")}
            >
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/20 text-violet-200 flex items-center justify-center font-semibold">
                    SC
                  </div>
                  <div>
                    <div className="font-semibold">Sarah Chen</div>
                    <div className="text-sm text-white/45">Project manager</div>
                  </div>
                </div>
                <div className="text-sm uppercase tracking-[0.24em] text-violet-200/75 mb-2">
                  Latest prompt
                </div>
                <div className="text-lg leading-8 text-white/90">{latestSarah}</div>
              </div>
              <div className="flex items-center gap-2 text-sm text-violet-200/85">
                {sarahSpeaking ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {sarahSpeaking
                  ? "Sarah is speaking"
                  : phase === "PROCESSING"
                    ? "Sarah is thinking..."
                    : "Sarah is listening"}
              </div>
            </div>

            {/* Candidate */}
            <div
              className={[
                "rounded-[24px] border p-5 flex flex-col justify-between min-h-[280px]",
                userSpeaking
                  ? "border-sky-400/40 bg-sky-500/10"
                  : "border-white/10 bg-black/20",
              ].join(" ")}
            >
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-sky-500/20 text-sky-200 flex items-center justify-center font-semibold">
                    You
                  </div>
                  <div>
                    <div className="font-semibold">Candidate</div>
                    <div className="text-sm text-white/45">
                      Explain your implementation naturally
                    </div>
                  </div>
                </div>
                <div className="text-sm uppercase tracking-[0.24em] text-sky-200/75 mb-2">
                  Your response
                </div>
                <div className="text-lg leading-8 text-white/90 min-h-[96px]">
                  {userSpeaking
                    ? "You're speaking..."
                    : latestYou || (phase === "LISTENING"
                        ? "Mic is live — speak naturally"
                        : "Waiting for your turn...")}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-sky-200/85">
                {phase === "PROCESSING" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : phase === "CONNECTING" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                {phase === "CONNECTING"
                  ? "Connecting to voice..."
                  : phase === "LISTENING"
                    ? "Mic is live — just talk"
                    : phase === "PROCESSING"
                      ? "Processing..."
                      : userSpeaking
                        ? "Listening..."
                        : "Waiting for Sarah"}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="text-sm font-semibold">
                  Turn {turnNumber} · {STRATEGY_LABELS[strategy] || strategy}
                </div>
                {currentScore && (
                  <div className="text-sm text-emerald-300">
                    Score: {currentScore.overall}%
                  </div>
                )}
              </div>
              {finalScores && (
                <div className="text-sm text-white/70">
                  Final: {finalScores.overall || finalScores.comprehension || "—"}%
                </div>
              )}
              {error && <div className="mt-2 text-sm text-rose-300">{error}</div>}
              {phase === "FAILED" && (
                <div className="mt-2 text-sm text-amber-300/80">
                  Voice connection failed. The standup will fall back to the socket pipeline.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleEnd}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-rose-500/15 border border-rose-400/20 text-rose-100 hover:bg-rose-500/20"
            >
              <PhoneOff className="w-4 h-4" />
              End
            </button>
          </div>
        </section>

        {/* Transcript sidebar */}
        <div className="min-h-0 hidden xl:block">
          <StandupCallTranscript
            items={items}
            interim=""
            listening={phase === "LISTENING" && !sarahSpeaking}
          />
        </div>
      </div>
    </div>
  );
}
