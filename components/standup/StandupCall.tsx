"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Mic, Loader2, PhoneOff, Volume2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { WsEvent } from "@/lib/types";
import { AudioChunkPlayer } from "./audio-player";
import { StandupCallTranscript } from "./StandupCallTranscript";

type CallPhase = "JOINING" | "PM_SPEAKING" | "LISTENING" | "PROCESSING" | "ENDED";
type TurnStrategy =
  | "BROAD_TASK_PROBE"
  | "REQUIREMENT_DRILL"
  | "EDGE_CASE_PROBE"
  | "INTEGRATION_READINESS";

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

const TURN_LABELS: Record<TurnStrategy, string> = {
  BROAD_TASK_PROBE: "Overview",
  REQUIREMENT_DRILL: "Requirements",
  EDGE_CASE_PROBE: "Edge cases",
  INTEGRATION_READINESS: "Handoff",
};

export function StandupCall({
  standupNumber,
  sessionId,
  onComplete,
  onEnd,
}: {
  standupNumber: number;
  sessionId: string;
  onComplete: () => void;
  onEnd: () => void;
}) {
  const { getToken } = useAuth();

  const [phase, setPhase] = useState<CallPhase>("JOINING");
  const [turnNumber, setTurnNumber] = useState(1);
  const [strategy, setStrategy] = useState<TurnStrategy>("BROAD_TASK_PROBE");
  const [standupId, setStandupId] = useState<string | null>(null);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [interim, setInterim] = useState("");
  const [scores, setScores] = useState<TurnScore[]>([]);
  const [finalScores, setFinalScores] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pmSpeaking, setPmSpeaking] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const playerRef = useRef<AudioChunkPlayer | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processingRef = useRef(false);
  const phaseRef = useRef<CallPhase>("JOINING");
  const standupIdRef = useRef<string | null>(null);
  const turnNumberRef = useRef(1);
  const finalisedTurnRef = useRef<number | null>(null);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { standupIdRef.current = standupId; }, [standupId]);
  useEffect(() => { turnNumberRef.current = turnNumber; }, [turnNumber]);

  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // FIX: Phase timeout — recovers from hangs where audio never plays,
  // server never responds, or processingRef stays stuck.
  useEffect(() => {
    if (phaseTimeoutRef.current) {
      clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = null;
    }

    if (phase === "PM_SPEAKING") {
      // If stuck on Sarah speaking for 20s (audio never plays or ends),
      // force transition to listening so the candidate can respond.
      phaseTimeoutRef.current = setTimeout(() => {
        if (phaseRef.current === "PM_SPEAKING") {
          console.warn("[standup] PM_SPEAKING timeout — forcing to LISTENING");
          playerRef.current?.interrupt();
          setPmSpeaking(false);
          processingRef.current = false;
          void startListeningRef.current?.();
        }
      }, 20_000);
    }

    if (phase === "PROCESSING") {
      // If stuck on processing for 30s (server never responded),
      // reset and let the candidate try again or use text mode.
      phaseTimeoutRef.current = setTimeout(() => {
        if (phaseRef.current === "PROCESSING") {
          console.warn("[standup] PROCESSING timeout — resetting");
          processingRef.current = false;
          setError("Response timed out. Try speaking again, or type your answer below.");
          setTextMode(true);
          setPhase("LISTENING");
        }
      }, 30_000);
    }

    if (phase === "JOINING") {
      // If stuck on joining for 15s, something went wrong with standup:begin.
      phaseTimeoutRef.current = setTimeout(() => {
        if (phaseRef.current === "JOINING") {
          console.warn("[standup] JOINING timeout — enabling text mode");
          setError("Connection is taking longer than expected. You can type your answers.");
          setTextMode(true);
          setPhase("LISTENING");
        }
      }, 15_000);
    }

    return () => {
      if (phaseTimeoutRef.current) {
        clearTimeout(phaseTimeoutRef.current);
        phaseTimeoutRef.current = null;
      }
    };
  }, [phase]);

  useEffect(() => {
    const player = new AudioChunkPlayer();
    player.onPlayingChange((playing) => {
      setPmSpeaking(playing);
      if (playing) setPhase("PM_SPEAKING");
    });
    player.onEnd(() => {
      setPmSpeaking(false);
      if (!processingRef.current && phaseRef.current !== "ENDED") {
        void startListeningRef.current?.();
      }
    });
    playerRef.current = player;
    return () => player.dispose();
  }, []);

  const addItem = useCallback((speaker: "sarah" | "you", text: string, extra?: Partial<TranscriptItem>) => {
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
  }, []);

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

  const teardownMic = useCallback(() => {
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    } catch {}
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    streamRef.current = null;
    setMicActive(false);
  }, []);

  const startListening = useCallback(async () => {
    if (processingRef.current || phaseRef.current === "ENDED") return;
    const socket = getSocket();
    if (!socket?.connected) {
      setTextMode(true);
      setPhase("LISTENING");
      return;
    }

    playerRef.current?.interrupt();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      setMicActive(true);
      setPhase("LISTENING");
      setInterim("");
      finalisedTurnRef.current = null;

      recorder.ondataavailable = (event) => {
        if (!event.data.size || !standupIdRef.current) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          const payload = (reader.result as string).split(",")[1];
          if (!payload) return;
          socket.emit(WsEvent.STANDUP_AUDIO_CHUNK, {
            standupId: standupIdRef.current,
            turnNumber: turnNumberRef.current,
            chunk: payload,
          });
        };
        reader.readAsDataURL(event.data);
      };

      recorder.start(250);
    } catch (e: any) {
      setError(e?.message || "Microphone permission was not granted.");
      setTextMode(true);
      setPhase("LISTENING");
    }
  }, []);

  const startListeningRef = useRef(startListening);
  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  const finalizeTurn = useCallback(() => {
    if (processingRef.current || !standupIdRef.current) return;
    processingRef.current = true;
    teardownMic();
    setPhase("PROCESSING");
    getSocket()?.emit(WsEvent.STANDUP_END_TURN, {
      standupId: standupIdRef.current,
      turnNumber: turnNumberRef.current,
    });
  }, [teardownMic]);

  const handleTextSubmit = useCallback(async () => {
    const text = textInput.trim();
    if (!text || !standupIdRef.current) return;
    setTextInput("");
    addItem("you", text, { turnNumber: turnNumberRef.current });
    setInterim("");
    setTextMode(false);
    setPhase("PROCESSING");
    processingRef.current = true;

    try {
      const token = await getToken();
      const result = await api.standup.completeTurnText(standupIdRef.current, turnNumberRef.current, text, token || undefined) as any;
      processingRef.current = false;

      if (result?.turnScore?.overall) {
        setScores((prev) => [...prev, { turnNumber: turnNumberRef.current, overall: result.turnScore.overall }]);
        attachScore(turnNumberRef.current, result.turnScore.overall);
      }

      if (result?.isComplete) {
        if (result.closingLine) addItem("sarah", result.closingLine);
        setFinalScores(result.scores || null);
        setPhase("ENDED");
        setTimeout(onComplete, 1200);
        return;
      }

      if (result?.pmFollowUp) addItem("sarah", result.pmFollowUp, { turnNumber: result.turnNumber });
      setTurnNumber(result?.turnNumber || turnNumberRef.current + 1);
      setStrategy(result?.strategy || strategy);
      setPhase("PM_SPEAKING");
    } catch (e: any) {
      processingRef.current = false;
      setError(e?.message || "Failed to submit text answer.");
      setPhase("LISTENING");
    }
  }, [addItem, attachScore, getToken, onComplete, strategy, textInput]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onPmSpeaking = (data: any) => {
      if (data.standupId) setStandupId(data.standupId);
      if (data.turnNumber) setTurnNumber(data.turnNumber);
      if (data.strategy) setStrategy(data.strategy);
      if (data.pmQuestion) addItem("sarah", data.pmQuestion, { turnNumber: data.turnNumber });
      setPhase("PM_SPEAKING");
    };

    const onPmChunk = (data: { chunk: string; index?: number }) => {
      playerRef.current?.enqueue(data.chunk, data.index);
    };

    const onPmEnd = () => playerRef.current?.markStreamEnd();

    const onReady = (data: { standupId: string; turnNumber: number }) => {
      setStandupId(data.standupId);
      setTurnNumber(data.turnNumber);
    };

    const onInterim = (data: { transcript: string }) => {
      setInterim(data.transcript || "");
    };

    const onVadEnd = () => {
      if (phaseRef.current !== "LISTENING" || processingRef.current) return;
      if (interim.trim() && finalisedTurnRef.current !== turnNumberRef.current) {
        finalisedTurnRef.current = turnNumberRef.current;
        addItem("you", interim.trim(), { turnNumber: turnNumberRef.current });
      }
      setInterim("");
      finalizeTurn();
    };

    const onTurnResult = (data: any) => {
      processingRef.current = false;
      if (data?.transcript && finalisedTurnRef.current !== data.turnNumber) {
        finalisedTurnRef.current = data.turnNumber;
        addItem("you", data.transcript, { turnNumber: data.turnNumber });
      }
      if (data?.turnNumber) setTurnNumber(data.turnNumber);
      if (data?.strategy) setStrategy(data.strategy);
    };

    const onScoreReady = (data: { turnNumber: number; turnScore: { overall: number } }) => {
      if (!data?.turnScore) return;
      setScores((prev) => [...prev.filter((s) => s.turnNumber !== data.turnNumber), { turnNumber: data.turnNumber, overall: data.turnScore.overall }]);
      attachScore(data.turnNumber, data.turnScore.overall);
    };

    const onCompleteEvent = (data: any) => {
      processingRef.current = false;
      teardownMic();
      playerRef.current?.interrupt();
      if (data?.transcript && finalisedTurnRef.current !== turnNumberRef.current) {
        addItem("you", data.transcript, { turnNumber: turnNumberRef.current });
      }
      if (data?.closingLine) addItem("sarah", data.closingLine);
      setFinalScores(data?.scores || null);
      setPhase("ENDED");
      setTimeout(onComplete, 1200);
    };

    const onError = (data: { message: string }) => {
      processingRef.current = false;
      setError(data?.message || "Standup failed.");
    };

    socket.on(WsEvent.STANDUP_PM_SPEAKING, onPmSpeaking);
    socket.on(WsEvent.STANDUP_PM_AUDIO_CHUNK, onPmChunk);
    socket.on(WsEvent.STANDUP_PM_AUDIO_END, onPmEnd);
    socket.on(WsEvent.STANDUP_READY, onReady);
    socket.on(WsEvent.STANDUP_INTERIM, onInterim);
    socket.on(WsEvent.STANDUP_VAD_SPEECH_END, onVadEnd);
    socket.on(WsEvent.STANDUP_TURN_RESULT, onTurnResult);
    socket.on(WsEvent.STANDUP_SCORE_READY, onScoreReady);
    socket.on(WsEvent.STANDUP_COMPLETE, onCompleteEvent);
    socket.on(WsEvent.STANDUP_ERROR, onError);

    socket.emit(WsEvent.STANDUP_BEGIN, { standupNumber, sessionId });

    return () => {
      socket.off(WsEvent.STANDUP_PM_SPEAKING, onPmSpeaking);
      socket.off(WsEvent.STANDUP_PM_AUDIO_CHUNK, onPmChunk);
      socket.off(WsEvent.STANDUP_PM_AUDIO_END, onPmEnd);
      socket.off(WsEvent.STANDUP_READY, onReady);
      socket.off(WsEvent.STANDUP_INTERIM, onInterim);
      socket.off(WsEvent.STANDUP_VAD_SPEECH_END, onVadEnd);
      socket.off(WsEvent.STANDUP_TURN_RESULT, onTurnResult);
      socket.off(WsEvent.STANDUP_SCORE_READY, onScoreReady);
      socket.off(WsEvent.STANDUP_COMPLETE, onCompleteEvent);
      socket.off(WsEvent.STANDUP_ERROR, onError);
      teardownMic();
      playerRef.current?.interrupt();
    };
  }, [addItem, attachScore, finalizeTurn, interim, onComplete, sessionId, standupNumber, teardownMic]);

  const elapsed = useMemo(() => {
    const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
    const s = (elapsedSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [elapsedSeconds]);

  const latestPrompt = [...items].reverse().find((item) => item.speaker === "sarah")?.text || "Sarah is joining the standup…";
  const currentTurnScore = scores.find((score) => score.turnNumber === turnNumber);

  return (
    <div className="fixed inset-0 z-[100] bg-[#08111e] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(91,113,248,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.12),transparent_30%)]" />

      <div className="relative h-full grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 p-4 xl:p-5">
        <section className="min-h-0 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-4 md:p-5 flex flex-col">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Standup #{standupNumber}</div>
              <div className="text-lg md:text-xl font-semibold">Contextual voice check-in</div>
            </div>
            <div className="text-sm text-white/55 tabular-nums">{elapsed}</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
            <div className={["rounded-[24px] border p-5 flex flex-col justify-between min-h-[280px]",
              pmSpeaking ? "border-violet-400/40 bg-violet-500/10" : "border-white/10 bg-black/20"].join(" ")}>
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/20 text-violet-200 flex items-center justify-center font-semibold">SC</div>
                  <div>
                    <div className="font-semibold">Sarah Chen</div>
                    <div className="text-sm text-white/45">Project manager</div>
                  </div>
                </div>
                <div className="text-sm uppercase tracking-[0.24em] text-violet-200/75 mb-2">Latest prompt</div>
                <div className="text-lg leading-8 text-white/90">{latestPrompt}</div>
              </div>
              <div className="flex items-center gap-2 text-sm text-violet-200/85">
                {pmSpeaking ? <Volume2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {pmSpeaking ? "Sarah is speaking" : phase === "PROCESSING" ? "Sarah is thinking" : "Sarah is listening"}
              </div>
            </div>

            <div className={["rounded-[24px] border p-5 flex flex-col justify-between min-h-[280px]",
              micActive ? "border-sky-400/40 bg-sky-500/10" : "border-white/10 bg-black/20"].join(" ")}>
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-sky-500/20 text-sky-200 flex items-center justify-center font-semibold">You</div>
                  <div>
                    <div className="font-semibold">Candidate</div>
                    <div className="text-sm text-white/45">Your response should stay grounded in the task</div>
                  </div>
                </div>
                <div className="text-sm uppercase tracking-[0.24em] text-sky-200/75 mb-2">Live response</div>
                <div className="text-lg leading-8 text-white/90 min-h-[96px]">
                  {interim || (textMode && phase === "LISTENING"
                    ? "Mic not available — type your answer below ↓"
                    : phase === "LISTENING" ? "Listening for your answer…"
                    : phase === "PROCESSING" ? "Processing your last answer…"
                    : "Waiting for your turn…")}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-sky-200/85">
                {phase === "PROCESSING" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                {phase === "LISTENING" ? "Mic is open" : phase === "PROCESSING" ? "Answer captured" : "Mic will open automatically"}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <div className="text-sm font-semibold">Turn {turnNumber} · {TURN_LABELS[strategy]}</div>
                  <div className="text-xs text-white/45">The model should react to what you said, not jump to a random next question.</div>
                </div>
                {currentTurnScore && <div className="text-sm text-emerald-300">Latest turn {currentTurnScore.overall}%</div>}
              </div>
              {finalScores && (
                <div className="text-sm text-white/70">Final overall: {finalScores.overall || finalScores.comprehension || "—"}</div>
              )}
              {error && <div className="mt-2 text-sm text-rose-300">{error}</div>}
            </div>

            <button
              type="button"
              onClick={() => { teardownMic(); playerRef.current?.stop(); setPhase("ENDED"); onEnd(); }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-rose-500/15 border border-rose-400/20 text-rose-100 hover:bg-rose-500/20"
            >
              <PhoneOff className="w-4 h-4" />
              End
            </button>
          </div>

          {textMode && (
            <div className="mt-4 rounded-[24px] border border-amber-400/30 bg-amber-500/5 p-4">
              <div className="text-sm font-semibold text-amber-200 mb-2">Type your answer</div>
              <div className="flex flex-col md:flex-row gap-3">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTextSubmit(); } }}
                  className="flex-1 min-h-[96px] rounded-2xl bg-white/5 border border-white/10 p-3 outline-none text-white placeholder-white/30 focus:border-amber-400/40"
                  placeholder="Type your response here and press Enter to submit..."
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim()}
                  className="rounded-2xl px-4 py-3 bg-white text-slate-900 font-medium disabled:opacity-40"
                >
                  Submit
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="min-h-0 hidden xl:block">
          <StandupCallTranscript items={items} interim={interim} listening={phase === "LISTENING" && micActive} />
        </div>
      </div>
    </div>
  );
}
