// components/standup/StandupCall.tsx
"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { StandupCallHeader } from "./StandupCallHeader";
import { StandupCallTranscript } from "./StandupCallTranscript";
import { StandupCallControls } from "./StandupCallControls";
import { StandupWaveform } from "./StandupWaveform";
import { StandupTextFallback } from "./StandupTextFallback";

type CallState =
  | "CONNECTING"
  | "PM_SPEAKING"
  | "LISTENING"
  | "THINKING"
  | "ENDED";

type CallMessage = {
  id: string;
  role: "PM" | "USER";
  text: string;
};

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
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<"PM" | "USER" | null>("PM");
  const [recording, setRecording] = useState(false);
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null);
  const [textFallbackOpen, setTextFallbackOpen] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [, forceTick] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const endHandledRef = useRef(false);

  const getFreshToken = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Missing auth token");
    const retryToken = await getToken({ skipCache: true }).catch(() => token);
    return { token, retryToken: retryToken || token };
  }, [getToken]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      forceTick((n) => n + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const elapsedLabel = useMemo(() => {
    const secs = Math.floor((Date.now() - startedAt) / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [startedAt, messages.length, callState]);

  const addMessage = useCallback((role: "PM" | "USER", text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        text,
      },
    ]);
  }, []);

  const checkMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicAllowed(true);
      setCurrentSpeaker("USER");
      setCallState("LISTENING");
    } catch {
      setMicAllowed(false);
      setCurrentSpeaker("USER");
      setCallState("LISTENING");
    }
  }, []);

  const playPmAudio = useCallback(
    async (audioUrl?: string | null, fallbackDelay = 500) => {
      if (audioUrl && audioRef.current) {
        audioRef.current.src = audioUrl;
        try {
          await audioRef.current.play();
          return;
        } catch {
          // fall through to mic
        }
      }

      window.setTimeout(() => {
        checkMic();
      }, fallbackDelay);
    },
    [checkMic]
  );

  const handleStart = useCallback(async () => {
    try {
      setError(null);
      setCallState("CONNECTING");
      setCurrentSpeaker("PM");

      const { token, retryToken } = await getFreshToken();

      const result = (await api.standup.start(
        sessionId,
        standupNumber,
        token,
        retryToken
      )) as any;

      const question = result.pmQuestion || result.question || "";
      const audioUrl = result.pmAudioUrl || null;
      const nextStandupId = result.standupId || result.id;
      const nextTurn = result.turnNumber || 1;

      setStandupId(nextStandupId);
      setTurnNumber(nextTurn);
      setMessages([]);
      addMessage("PM", question);
      setCallState("PM_SPEAKING");
      setCurrentSpeaker("PM");

      await playPmAudio(audioUrl, 400);
    } catch (err: any) {
      setError(err.message || "Failed to start standup");
      setCallState("ENDED");
      setCurrentSpeaker(null);
    }
  }, [addMessage, getFreshToken, playPmAudio, sessionId, standupNumber]);

  useEffect(() => {
    handleStart();
  }, [handleStart]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const completeTurn = useCallback(
    async (audioBase64?: string, typedText?: string) => {
      if (!standupId) return;

      setCallState("THINKING");
      setCurrentSpeaker("PM");
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

        const transcript =
          result.transcript || typedText || textInput || "(response sent)";
        const isComplete = Boolean(result.isComplete ?? result.complete);

        addMessage("USER", transcript);

        if (isComplete) {
          const closing =
            result.closingLine || "Nice — that sounds good. Let's move forward.";
          if (closing) {
            addMessage("PM", closing);
          }

          setCallState("ENDED");
          setCurrentSpeaker(null);

          if (!endHandledRef.current) {
            endHandledRef.current = true;
            window.setTimeout(() => {
              onComplete();
            }, 1200);
          }
          return;
        }

        const nextQuestion =
          result.pmFollowUp || result.pmQuestion || result.question || "";
        const nextAudio = result.pmAudioUrl || null;
        const nextTurn = result.turnNumber || turnNumber + 1;

        setTurnNumber(nextTurn);
        addMessage("PM", nextQuestion);
        setTextInput("");
        setTextFallbackOpen(false);
        setCallState("PM_SPEAKING");
        setCurrentSpeaker("PM");

        await playPmAudio(nextAudio, 350);
      } catch (err: any) {
        setError(err.message || "Failed to process response");
        setCallState("LISTENING");
        setCurrentSpeaker("USER");
      }
    },
    [
      addMessage,
      getFreshToken,
      onComplete,
      playPmAudio,
      standupId,
      textInput,
      turnNumber,
    ]
  );

  const startRecording = useCallback(async () => {
    if (callState !== "LISTENING") return;

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
      setCurrentSpeaker("USER");
    } catch {
      setMicAllowed(false);
      setTextFallbackOpen(true);
    }
  }, [callState, completeTurn]);

  const handleTextSubmit = useCallback(() => {
    const value = textInput.trim();
    if (!value) return;
    completeTurn(undefined, value);
  }, [completeTurn, textInput]);

  const handleAudioEnded = useCallback(() => {
    checkMic();
  }, [checkMic]);

  const handleEnd = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    setRecording(false);
    setCallState("ENDED");
    setCurrentSpeaker(null);
    onEnd();
  }, [onEnd]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#070b14]/96 backdrop-blur-xl">
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />

      <div className="h-full w-full flex flex-col px-5 py-5 md:px-8 md:py-7">
        <StandupCallHeader
          elapsedLabel={elapsedLabel}
          statusLabel={
            callState === "CONNECTING"
              ? "joining..."
              : callState === "PM_SPEAKING"
              ? "speaking"
              : callState === "LISTENING"
              ? "live"
              : callState === "THINKING"
              ? "thinking"
              : "ended"
          }
          onEnd={handleEnd}
        />

        <div className="flex-1 flex flex-col items-center justify-center gap-10">
          <StandupWaveform
            mode={
              callState === "PM_SPEAKING"
                ? "speaking"
                : callState === "LISTENING"
                ? recording
                  ? "listening"
                  : "idle"
                : callState === "THINKING"
                ? "thinking"
                : "idle"
            }
            className="mb-2"
          />

          <StandupCallTranscript
            messages={messages}
            currentSpeaker={currentSpeaker}
          />

          <StandupCallControls
            state={callState}
            recording={recording}
            micAllowed={micAllowed}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onEnd={handleEnd}
            onOpenTextFallback={() => setTextFallbackOpen(true)}
          />
        </div>

        {error && (
          <div className="max-w-2xl mx-auto w-full mb-4">
            <div className="p-3 rounded-xl bg-ds-danger/10 border border-ds-danger/20 text-sm text-ds-danger text-center">
              {error}
            </div>
          </div>
        )}
      </div>

      <StandupTextFallback
        open={textFallbackOpen}
        value={textInput}
        onChange={setTextInput}
        onClose={() => setTextFallbackOpen(false)}
        onSubmit={handleTextSubmit}
      />

      <style jsx global>{`
        @keyframes standup-wave {
          0%,
          100% {
            transform: scaleY(0.5);
            opacity: 0.65;
          }
          50% {
            transform: scaleY(2.2);
            opacity: 1;
          }
        }
        .animate-standup-wave {
          transform-origin: bottom center;
          animation-name: standup-wave;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
}