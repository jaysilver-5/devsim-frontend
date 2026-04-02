// components/standup/StandupCallTranscript.tsx
"use client";

type CallMessage = {
  id: string;
  role: "PM" | "USER";
  text: string;
};

type Props = {
  messages: CallMessage[];
  currentSpeaker: "PM" | "USER" | null;
};

export function StandupCallTranscript({
  messages,
  currentSpeaker,
}: Props) {
  const visible = messages.slice(-3);
  const active = visible[visible.length - 1];

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="space-y-3">
        {visible.map((message, index) => {
          const isActive = active?.id === message.id;
          const isPm = message.role === "PM";

          return (
            <div
              key={message.id}
              className={[
                "transition-all duration-300",
                isActive ? "opacity-100 translate-y-0" : "opacity-45 translate-y-[-2px]",
              ].join(" ")}
            >
              <div
                className={[
                  "text-[11px] uppercase tracking-wider mb-1",
                  isPm ? "text-persona-sarah" : "text-ds-primary-muted",
                ].join(" ")}
              >
                {isPm ? "Sarah" : "You"}
                {isActive && currentSpeaker === message.role && (
                  <span className="ml-2 text-ds-text-faint normal-case tracking-normal">
                    speaking...
                  </span>
                )}
              </div>

              <div
                className={[
                  "leading-relaxed",
                  isActive
                    ? "text-xl md:text-2xl text-ds-text"
                    : "text-sm text-ds-text-dim",
                ].join(" ")}
              >
                {message.text}
              </div>

              {index !== visible.length - 1 && (
                <div className="mt-3 border-b border-ds-border-subtle" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}