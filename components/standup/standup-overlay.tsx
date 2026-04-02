"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { Mic, MicOff, Send, Volume2, Loader2 } from "lucide-react";

type StandupState =
  | "INTRO"
  | "PLAYING"
  | "RECORDING"
  | "PROCESSING"
  | "FOLLOW_UP"
  | "COMPLETE";

type Turn = {
  pmQuestion: string;
  pmAudioUrl?: string;
  devResponse?: string;
  scores?: Record<string, number>;
};

export function StandupOverlay({
  sessionId,
  standupNumber,
  onComplete,
}: {
  sessionId: string;
  standupNumber: number;
  onComplete: () => void;
}) {
  const { getToken } = useAuth();

  const [state, setState] = useState<StandupState>("INTRO");
  const [standupId, setStandupId] = useState<string | null>(null);
  const [turnNumber, setTurnNumber] = useState(1);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentPmText, setCurrentPmText] = useState("");
  const [currentPmAudio, setCurrentPmAudio] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getFreshToken = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Missing auth token");

    const retryToken = await getToken({ skipCache: true }).catch(() => token);
    return { token, retryToken: retryToken || token };
  }, [getToken]);

  const startStandup = useCallback(async () => {
    try {
      setError(null);
      setState("PLAYING");

      const { token, retryToken } = await getFreshToken();

      const result = (await api.standup.start(
        sessionId,
        standupNumber,
        token,
        retryToken
      )) as any;

      const firstQuestion = result.pmQuestion || result.question || "";
      const firstAudio = result.pmAudioUrl || null;
      const firstTurnNumber = result.turnNumber || 1;

      setStandupId(result.standupId || result.id);
      setCurrentPmText(firstQuestion);
      setCurrentPmAudio(firstAudio);
      setTurnNumber(firstTurnNumber);
      setTurns([{ pmQuestion: firstQuestion, pmAudioUrl: firstAudio || undefined }]);

      if (firstAudio && audioRef.current) {
        audioRef.current.src = firstAudio;
        audioRef.current.play().catch(() => {});
      } else {
        setTimeout(() => checkMic(), 400);
      }
    } catch (err: any) {
      setError(err.message || "Failed to start standup");
      setState("INTRO");
    }
  }, [sessionId, standupNumber, getFreshToken]);

  const checkMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicAllowed(true);
      setState("RECORDING");
    } catch {
      setMicAllowed(false);
      setState("RECORDING");
    }
  }, []);

  const handleAudioEnd = useCallback(() => {
    checkMic();
  }, [checkMic]);

  const stopRecording = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const completeTurn = useCallback(
    async (audioBase64?: string) => {
      if (!standupId) return;

      setState("PROCESSING");
      setError(null);

      try {
        const { token, retryToken } = await getFreshToken();

        const result = (await api.standup.completeTurn(
          standupId,
          turnNumber,
          audioBase64,
          token,
          retryToken
        )) as any;

        const isComplete = Boolean(result.isComplete ?? result.complete);
        const returnedScores =
          result.scores ??
          result.evaluationScore ??
          undefined;

        const newTurn: Turn = {
          pmQuestion: currentPmText,
          devResponse: result.transcript || textInput || "(audio response)",
          scores: returnedScores,
        };

        setTurns((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = newTurn;
          return updated;
        });

        if (isComplete) {
          setState("COMPLETE");
          setTimeout(onComplete, 1500);
          return;
        }

        const nextQuestion =
          result.pmFollowUp ||
          result.pmQuestion ||
          result.question ||
          "";
        const nextAudio = result.pmAudioUrl || null;
        const nextTurnNumber = result.turnNumber || turnNumber + 1;

        setTurnNumber(nextTurnNumber);
        setCurrentPmText(nextQuestion);
        setCurrentPmAudio(nextAudio);
        setTextInput("");
        setTurns((prev) => [
          ...prev,
          {
            pmQuestion: nextQuestion,
            pmAudioUrl: nextAudio || undefined,
          },
        ]);

        if (nextAudio && audioRef.current) {
          setState("PLAYING");
          audioRef.current.src = nextAudio;
          audioRef.current.play().catch(() => {});
        } else {
          setState("FOLLOW_UP");
          setTimeout(() => checkMic(), 400);
        }
      } catch (err: any) {
        setError(err.message || "Failed to process response");
        setState("RECORDING");
      }
    },
    [
      standupId,
      turnNumber,
      currentPmText,
      textInput,
      onComplete,
      checkMic,
      getFreshToken,
    ]
  );

  const startRecording = useCallback(async () => {
    if (!micAllowed) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();

        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          completeTurn(base64);
        };

        reader.readAsDataURL(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);

      silenceTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          stopRecording();
        }
      }, 15000);
    } catch {
      setMicAllowed(false);
    }
  }, [micAllowed, completeTurn, stopRecording]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;
    completeTurn();
  }, [textInput, completeTurn]);

  return (
    <div className="fixed inset-0 z-[100] bg-ds-base/95 backdrop-blur-md flex items-center justify-center">
      <audio ref={audioRef} onEnded={handleAudioEnd} className="hidden" />

      <div className="w-full max-w-lg px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-persona-sarah/15 flex items-center justify-center mx-auto mb-4">
            <span className="text-xl font-bold text-persona-sarah">SC</span>
          </div>
          <h2 className="text-lg font-semibold text-ds-text">
            Standup with Sarah Chen
          </h2>
          <p className="text-sm text-ds-text-dim mt-1">
            {state === "INTRO"
              ? "Ready to check in on your progress?"
              : state === "PLAYING" || state === "FOLLOW_UP"
              ? "Sarah is speaking..."
              : state === "RECORDING"
              ? "Your turn"
              : state === "PROCESSING"
              ? "Processing your response..."
              : "Standup complete!"}
          </p>
        </div>

        <div className="flex justify-center gap-1.5 mb-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < turnNumber
                  ? "bg-ds-primary"
                  : i === turnNumber - 1
                  ? "bg-ds-primary animate-pulse"
                  : "bg-ds-border"
              }`}
            />
          ))}
        </div>

        <div className="min-h-[200px]">
          {state === "INTRO" && (
            <div className="text-center">
              <button
                onClick={startStandup}
                className="px-8 py-3 rounded-xl bg-ds-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Start Standup
              </button>
            </div>
          )}

          {(state === "PLAYING" || state === "FOLLOW_UP") && (
            <div className="p-5 rounded-xl bg-ds-surface border border-ds-border">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="w-4 h-4 text-persona-sarah animate-pulse" />
                <span className="text-[11px] font-semibold text-persona-sarah">
                  Sarah Chen
                </span>
              </div>
              <p className="text-sm text-ds-text-secondary leading-relaxed">
                {currentPmText}
              </p>
            </div>
          )}

          {state === "RECORDING" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-ds-surface/50 border border-ds-border">
                <div className="text-[10px] font-semibold text-persona-sarah mb-1.5">
                  Sarah asked:
                </div>
                <p className="text-[12px] text-ds-text-muted leading-relaxed">
                  {currentPmText}
                </p>
              </div>

              {micAllowed ? (
                <div className="text-center">
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                      recording
                        ? "bg-ds-danger/20 text-ds-danger border-2 border-ds-danger shadow-[0_0_20px_rgba(255,107,107,0.3)] animate-pulse"
                        : "bg-ds-primary/15 text-ds-primary-muted border-2 border-ds-primary/30 hover:bg-ds-primary/25"
                    }`}
                  >
                    {recording ? (
                      <MicOff className="w-6 h-6" />
                    ) : (
                      <Mic className="w-6 h-6" />
                    )}
                  </button>
                  <p className="text-xs text-ds-text-dim mt-2">
                    {recording
                      ? "Click to stop recording"
                      : "Click to start speaking"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-ds-text-faint text-center">
                    Microphone unavailable. Type your response:
                  </p>
                  <div className="flex gap-2">
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Type your response to Sarah..."
                      rows={3}
                      className="flex-1 px-3 py-2.5 rounded-lg border border-ds-border-strong bg-ds-base text-sm text-ds-text-secondary placeholder:text-ds-text-ghost focus:border-ds-primary focus:outline-none resize-none"
                    />
                  </div>
                  <button
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim()}
                    className="w-full py-2.5 rounded-lg bg-ds-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-30 transition-opacity flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Send Response
                  </button>
                </div>
              )}
            </div>
          )}

          {state === "PROCESSING" && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-ds-primary-muted animate-spin mx-auto mb-3" />
              <p className="text-sm text-ds-text-dim">
                Sarah is thinking about your response...
              </p>
            </div>
          )}

          {state === "COMPLETE" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-ds-success/15 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✓</span>
              </div>
              <h3 className="text-lg font-semibold text-ds-text mb-2">
                Standup Complete
              </h3>
              <p className="text-sm text-ds-text-dim mb-1">
                Great check-in! Returning to workspace...
              </p>

              {turns.some((t) => t.scores) && (
                <div className="mt-4 space-y-1">
                  {turns
                    .filter((t) => t.scores)
                    .map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-center gap-2 text-xs text-ds-text-faint flex-wrap"
                      >
                        Turn {i + 1}:
                        {Object.entries(t.scores!).map(([k, v]) => (
                          <span key={k} className="text-ds-text-muted">
                            {k}:{" "}
                            <strong
                              className={
                                v >= 80
                                  ? "text-ds-success"
                                  : v >= 60
                                  ? "text-ds-warning"
                                  : "text-ds-danger"
                              }
                            >
                              {v}/100
                            </strong>
                          </span>
                        ))}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-ds-danger/10 border border-ds-danger/20 text-xs text-ds-danger text-center">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {turns.length > 1 && state !== "COMPLETE" && (
          <div className="mt-6 border-t border-ds-border pt-4">
            <div className="text-[10px] text-ds-text-faint uppercase tracking-wider mb-2">
              Conversation
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {turns.slice(0, -1).map((turn, i) => (
                <div key={i} className="text-[11px]">
                  <div className="text-persona-sarah font-medium">
                    Sarah:{" "}
                    <span className="text-ds-text-dim font-normal">
                      {turn.pmQuestion}
                    </span>
                  </div>
                  {turn.devResponse && (
                    <div className="text-ds-primary-muted font-medium mt-0.5">
                      You:{" "}
                      <span className="text-ds-text-dim font-normal">
                        {turn.devResponse}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}