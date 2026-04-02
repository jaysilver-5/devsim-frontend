// components/standup/StandupWaveform.tsx
"use client";

type Props = {
  mode: "speaking" | "listening" | "thinking" | "idle";
  className?: string;
};

const BAR_COUNT = 18;

export function StandupWaveform({ mode, className = "" }: Props) {
  const base =
    mode === "speaking"
      ? "bg-persona-sarah/80"
      : mode === "listening"
      ? "bg-ds-primary/80"
      : mode === "thinking"
      ? "bg-ds-warning/80"
      : "bg-ds-border-strong";

  return (
    <div
      className={`flex items-end justify-center gap-1 h-16 ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const duration =
          mode === "speaking"
            ? 900 + (i % 5) * 120
            : mode === "listening"
            ? 1100 + (i % 4) * 100
            : mode === "thinking"
            ? 1400 + (i % 3) * 140
            : 1800;

        const delay = i * 60;
        const minHeight =
          mode === "idle" ? 10 : i % 2 === 0 ? 14 : 20;

        return (
          <span
            key={i}
            className={`block w-1.5 rounded-full ${base} ${
              mode === "idle" ? "" : "animate-standup-wave"
            }`}
            style={{
              height: `${minHeight}px`,
              animationDuration: `${duration}ms`,
              animationDelay: `${delay}ms`,
            }}
          />
        );
      })}
    </div>
  );
}