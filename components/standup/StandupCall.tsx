// components/standup/StandupCall.tsx
"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { WsEvent } from "@/lib/types";
import { StandupCallHeader } from "./StandupCallHeader";
import { StandupCallTranscript } from "./StandupCallTranscript";
import { StandupWaveform } from "./StandupWaveform";
import { StandupTextFallback } from "./StandupTextFallback";
import { Mic, MicOff, Keyboard, PhoneOff } from "lucide-react";

type CallState = "CONNECTING" | "PM_SPEAKING" | "LISTENING" | "THINKING" | "ENDED";
type TurnStrategy = "BROAD_TASK_PROBE" | "REQUIREMENT_DRILL" | "EDGE_CASE_PROBE" | "INTEGRATION_READINESS";
type CallMessage = { id: string; role: "PM" | "USER"; text: string };

const STRATEGY_LABELS: Record<TurnStrategy, string> = {
  BROAD_TASK_PROBE: "Overview",
  REQUIREMENT_DRILL: "Requirements",
  EDGE_CASE_PROBE: "Edge Cases",
  INTEGRATION_READINESS: "Integration",
};

const MAX_TURNS = 4;
const SILENCE_THRESHOLD = 6;
const SILENCE_MS = 1800;
const VAD_INTERVAL = 120;

export function StandupCall({
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
  const { getToken } = useAuth();

  const [callState, setCallState] = useState<CallState>("CONNECTING");
  const [standupId, setStandupId] = useState<string | null>(null);
  const [turnNumber, setTurnNumber] = useState(1);
  const [strategy, setStrategy] = useState<TurnStrategy | null>(null);
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<"PM" | "USER" | null>("PM");
  const [recording, setRecording] = useState(false);
  const [muted, setMuted] = useState(false);
  const [textFallbackOpen, setTextFallbackOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [, forceTick] = useState(0);
  const [finalScores, setFinalScores] = useState<Record<string, number> | null>(null);
  const [closingLine, setClosingLine] = useState<string | null>(null);
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceStartRef = useRef<number | null>(null);
  const endHandledRef = useRef(false);
  const busyRef = useRef(false);

  const getFreshToken = useCallback(async () => {
    const t = await getToken();
    if (!t) throw new Error("Missing auth token");
    const r = await getToken({ skipCache: true }).catch(() => t);
    return { token: t, retryToken: r || t };
  }, [getToken]);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = useMemo(() => {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, callState]);

  const addMsg = useCallback((role: "PM" | "USER", text: string) => {
    setMessages((p) => [...p, { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role, text }]);
  }, []);

  // ─── Cleanup helpers ──────────────────────────────────

  const teardownMic = useCallback(() => {
    if (vadRef.current) { clearInterval(vadRef.current); vadRef.current = null; }
    if (recorderRef.current?.state === "recording") try { recorderRef.current.stop(); } catch {}
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current?.state !== "closed") try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => () => teardownMic(), [teardownMic]);

  // ─── WS interim transcripts ───────────────────────────

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (d: { transcript: string }) => { if (d.transcript) setInterimText(d.transcript); };
    socket.on(WsEvent.STANDUP_INTERIM, handler);
    return () => { socket.off(WsEvent.STANDUP_INTERIM, handler); };
  }, []);

  // ─── Process response (shared) ────────────────────────

  const processResponse = useCallback((result: any, forceComplete?: boolean) => {
    busyRef.current = false;
    const transcript = result.transcript || interimText || "(response sent)";
    const isComplete = forceComplete || Boolean(result.isComplete ?? result.complete);

    addMsg("USER", transcript);
    setInterimText("");

    if (isComplete) {
      const closing = result.closingLine || "Nice — let's move forward.";
      addMsg("PM", closing);
      setClosingLine(closing);
      setFinalScores(result.scores || null);
      setCallState("ENDED");
      setCurrentSpeaker(null);
      if (!endHandledRef.current) { endHandledRef.current = true; setTimeout(onComplete, 2500); }
      return;
    }

    const q = result.pmFollowUp || result.pmQuestion || "";
    setTurnNumber(result.turnNumber || turnNumber + 1);
    setStrategy(result.strategy || null);
    addMsg("PM", q);
    setTextInput("");
    setTextFallbackOpen(false);
    setCallState("PM_SPEAKING");
    setCurrentSpeaker("PM");
    playAudio(result.pmAudioUrl || null);
  }, [addMsg, interimText, onComplete, turnNumber]);

  // ─── REST turn completion ─────────────────────────────

  const submitTurn = useCallback(async (audioBase64?: string, typed?: string) => {
    if (!standupId) { busyRef.current = false; return; }
    try {
      const { token, retryToken } = await getFreshToken();
      const result = typed && !audioBase64
        ? await api.standup.completeTurnText(standupId, turnNumber, typed, token, retryToken)
        : await api.standup.completeTurn(standupId, turnNumber, audioBase64, token, retryToken);
      processResponse(result as any);
    } catch (err: any) {
      busyRef.current = false;
      setError(err.message || "Failed to process");
      setCallState("LISTENING");
      setCurrentSpeaker("USER");
    }
  }, [getFreshToken, processResponse, standupId, turnNumber]);

  // ─── Stop recording + send ────────────────────────────

  const stopAndSend = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;

    if (vadRef.current) { clearInterval(vadRef.current); vadRef.current = null; }
    setRecording(false);
    setCallState("THINKING");
    setCurrentSpeaker("PM");

    const socket = getSocket();

    if (socket?.connected && standupId) {
      // WS path
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      teardownMic();
      socket.emit(WsEvent.STANDUP_END_TURN, { standupId, turnNumber });

      const onResult = (d: any) => { off(); processResponse(d, false); };
      const onDone = (d: any) => { off(); processResponse(d, true); };
      const off = () => { socket.off(WsEvent.STANDUP_TURN_RESULT, onResult); socket.off(WsEvent.STANDUP_COMPLETE, onDone); };
      socket.on(WsEvent.STANDUP_TURN_RESULT, onResult);
      socket.on(WsEvent.STANDUP_COMPLETE, onDone);
      setTimeout(() => { if (busyRef.current) { off(); busyRef.current = false; submitTurn(); } }, 12000);
    } else {
      // REST path
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          teardownMic();
          const r = new FileReader();
          r.onloadend = () => { submitTurn((r.result as string).split(",")[1]); };
          r.readAsDataURL(blob);
        };
        recorderRef.current.stop();
      } else { teardownMic(); submitTurn(); }
    }
  }, [standupId, turnNumber, teardownMic, processResponse, submitTurn]);

  // ─── Auto-listen with VAD ─────────────────────────────

  const autoListen = useCallback(async () => {
    if (muted || busyRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setMicAllowed(true);
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      analyserRef.current = an;

      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      // Stream chunks via WS if available
      const socket = getSocket();
      if (socket?.connected && standupId) {
        rec.start(300);
        let lastIdx = 0;
        const pump = setInterval(() => {
          if (chunksRef.current.length <= lastIdx) return;
          const chunk = chunksRef.current[chunksRef.current.length - 1];
          lastIdx = chunksRef.current.length;
          const fr = new FileReader();
          fr.onloadend = () => {
            const b64 = (fr.result as string).split(",")[1];
            if (b64) socket.emit(WsEvent.STANDUP_AUDIO_CHUNK, { standupId, turnNumber, chunk: b64 });
          };
          fr.readAsDataURL(chunk);
        }, 350);
        rec.addEventListener("stop", () => clearInterval(pump), { once: true });
      } else {
        rec.start();
      }

      recorderRef.current = rec;
      setRecording(true);
      setCurrentSpeaker("USER");
      setCallState("LISTENING");
      silenceStartRef.current = null;

      // VAD loop
      const buf = new Uint8Array(an.frequencyBinCount);
      vadRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        if (avg < SILENCE_THRESHOLD) {
          if (!silenceStartRef.current) silenceStartRef.current = Date.now();
          else if (Date.now() - silenceStartRef.current > SILENCE_MS) stopAndSend();
        } else {
          silenceStartRef.current = null;
        }
      }, VAD_INTERVAL);
    } catch {
      setMicAllowed(false);
      setCallState("LISTENING");
      setTextFallbackOpen(true);
    }
  }, [muted, standupId, turnNumber, stopAndSend]);

  // ─── PM audio ─────────────────────────────────────────

  const playAudio = useCallback(async (url?: string | null) => {
    if (url && audioRef.current) {
      audioRef.current.src = url;
      try { await audioRef.current.play(); return; } catch {}
    }
    setTimeout(autoListen, 300);
  }, [autoListen]);

  // ─── Boot ─────────────────────────────────────────────

  const boot = useCallback(async () => {
    try {
      setError(null);
      setCallState("CONNECTING");
      setCurrentSpeaker("PM");
      const { token, retryToken } = await getFreshToken();
      const r = (await api.standup.start(sessionId, standupNumber, token, retryToken)) as any;
      setStandupId(r.standupId || r.id);
      setTurnNumber(r.turnNumber || 1);
      setStrategy(r.strategy || null);
      setMessages([]);
      addMsg("PM", r.pmQuestion || r.question || "");
      setCallState("PM_SPEAKING");
      setCurrentSpeaker("PM");
      await playAudio(r.pmAudioUrl || null);
    } catch (err: any) {
      setError(err.message || "Failed to start standup");
      setCallState("ENDED");
    }
  }, [addMsg, getFreshToken, playAudio, sessionId, standupNumber]);

  useEffect(() => { boot(); }, [boot]);

  const handleAudioEnded = useCallback(() => autoListen(), [autoListen]);

  const handleEnd = useCallback(() => {
    teardownMic();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    setRecording(false);
    setCallState("ENDED");
    setCurrentSpeaker(null);
    onEnd();
  }, [onEnd, teardownMic]);

  const handleTextSubmit = useCallback(() => {
    const v = textInput.trim();
    if (!v) return;
    busyRef.current = true;
    setCallState("THINKING");
    setCurrentSpeaker("PM");
    submitTurn(undefined, v);
  }, [submitTurn, textInput]);

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] bg-[#070b14]/97 backdrop-blur-xl">
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />

      <div className="h-full w-full flex flex-col px-5 py-5 md:px-8 md:py-6">
        <StandupCallHeader elapsedLabel={elapsed} statusLabel={
          callState === "CONNECTING" ? "joining..." : callState === "PM_SPEAKING" ? "speaking"
            : callState === "LISTENING" ? "live" : callState === "THINKING" ? "thinking" : "ended"
        } onEnd={handleEnd} />

        {/* Turn strip */}
        <div className="flex items-center justify-center gap-1.5 mt-4 mb-1">
          {(["BROAD_TASK_PROBE","REQUIREMENT_DRILL","EDGE_CASE_PROBE","INTEGRATION_READINESS"] as TurnStrategy[]).map((s, i) => {
            const t = i + 1; const active = t === turnNumber && callState !== "ENDED"; const done = t < turnNumber || callState === "ENDED";
            return (<div key={s} className="flex items-center gap-1.5">
              <div className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${active ? "bg-ds-primary/15 text-ds-primary-muted border border-ds-primary/30" : done ? "bg-ds-success/10 text-ds-success/70" : "text-ds-text-faint/40"}`}>
                {done && <span className="mr-1">✓</span>}{STRATEGY_LABELS[s]}
              </div>
              {i < 3 && <div className={`w-3 h-px ${done ? "bg-ds-success/30" : "bg-ds-border-subtle"}`} />}
            </div>);
          })}
        </div>

        {/* Center */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-0">
          <StandupWaveform mode={callState === "PM_SPEAKING" ? "speaking" : callState === "LISTENING" ? (recording ? "listening" : "idle") : callState === "THINKING" ? "thinking" : "idle"} />

          {recording && interimText && (
            <p className="text-sm text-ds-text-dim/50 italic text-center max-w-2xl animate-pulse">{interimText}</p>
          )}

          <StandupCallTranscript messages={messages} currentSpeaker={currentSpeaker} />

          {callState === "LISTENING" && !recording && micAllowed !== false && (
            <p className="text-sm text-ds-text-dim animate-pulse">Starting mic...</p>
          )}

          {callState === "ENDED" && finalScores && (
            <div className="w-full max-w-md">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(finalScores).filter(([k]) => k !== "authenticity").map(([k, v]) => (
                  <div key={k} className="p-3 rounded-xl bg-ds-surface/40 border border-ds-border-subtle text-center">
                    <div className="text-[10px] text-ds-text-faint capitalize mb-1">{k}</div>
                    <div className={`text-lg font-bold tabular-nums ${v >= 80 ? "text-ds-success" : v >= 60 ? "text-ds-warning" : "text-ds-danger"}`}>{v}</div>
                  </div>
                ))}
              </div>
              {closingLine && <p className="text-xs text-ds-text-faint text-center mt-3 italic">Returning to workspace...</p>}
            </div>
          )}
        </div>

        {/* Bottom bar — Google Meet style */}
        {callState !== "ENDED" && (
          <div className="shrink-0 pb-2">
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setTextFallbackOpen(true)} className="w-11 h-11 rounded-full bg-ds-surface/60 border border-ds-border text-ds-text-dim hover:text-ds-text transition flex items-center justify-center" title="Type instead">
                <Keyboard className="w-[18px] h-[18px]" />
              </button>
              <button onClick={recording ? stopAndSend : () => setMuted((m) => !m)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border ${recording ? "bg-ds-primary/20 text-ds-primary-muted border-ds-primary/40 shadow-[0_0_20px_rgba(138,130,255,0.12)]" : muted ? "bg-ds-danger/15 text-ds-danger border-ds-danger/30" : "bg-ds-surface/60 text-ds-text-dim border-ds-border hover:bg-ds-elevated"}`}
                title={recording ? "Stop" : muted ? "Unmute" : "Mute"}>
                {recording ? <Mic className="w-5 h-5 animate-pulse" /> : muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button onClick={handleEnd} className="w-11 h-11 rounded-full bg-ds-danger/15 border border-ds-danger/25 text-ds-danger hover:bg-ds-danger/25 transition flex items-center justify-center" title="End standup">
                <PhoneOff className="w-[18px] h-[18px]" />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-ds-text-faint text-center">
              {callState === "PM_SPEAKING" ? "Sarah is speaking" : callState === "LISTENING" ? (recording ? "Listening — stops when you pause" : micAllowed === false ? "Mic unavailable — use text" : "Starting mic...") : callState === "THINKING" ? "Processing..." : "Connecting..."}
            </p>
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto w-full mb-3">
            <div className="p-2.5 rounded-xl bg-ds-danger/10 border border-ds-danger/20 text-xs text-ds-danger text-center">
              {error} <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
            </div>
          </div>
        )}
      </div>

      <StandupTextFallback open={textFallbackOpen} value={textInput} onChange={setTextInput} onClose={() => setTextFallbackOpen(false)} onSubmit={handleTextSubmit} />

      <style jsx global>{`
        @keyframes standup-wave { 0%,100% { transform: scaleY(0.5); opacity: 0.65; } 50% { transform: scaleY(2.2); opacity: 1; } }
        .animate-standup-wave { transform-origin: bottom center; animation-name: standup-wave; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
      `}</style>
    </div>
  );
}