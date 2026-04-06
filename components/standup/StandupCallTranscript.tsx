"use client";

type TranscriptRow = {
  id: string;
  speaker: "sarah" | "you";
  text: string;
  score?: number | null;
};

export function StandupCallTranscript({
  items,
  interim,
  listening,
}: {
  items: TranscriptRow[];
  interim: string;
  listening: boolean;
}) {
  return (
    <aside className="h-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Conversation</div>
          <div className="text-[11px] text-white/45">Stable rail — no layout jumping</div>
        </div>
        <div className="text-[11px] text-white/50">{items.length} turns</div>
      </div>

      <div className="h-[calc(100%-57px)] overflow-y-auto px-3 py-3 space-y-3">
        {items.map((item) => {
          const isSarah = item.speaker === "sarah";
          return (
            <div
              key={item.id}
              className={[
                "rounded-2xl p-3 border",
                isSarah
                  ? "bg-violet-500/10 border-violet-400/20"
                  : "bg-sky-500/10 border-sky-400/20",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className={[
                  "text-[11px] font-medium uppercase tracking-[0.18em]",
                  isSarah ? "text-violet-200" : "text-sky-200",
                ].join(" ")}>
                  {isSarah ? "Sarah" : "You"}
                </div>
                {!isSarah && typeof item.score === "number" && (
                  <div className="text-[11px] text-emerald-300">Turn score {item.score}%</div>
                )}
              </div>
              <div className="text-sm leading-6 text-white/88 whitespace-pre-wrap">{item.text}</div>
            </div>
          );
        })}

        {(interim || listening) && (
          <div className="rounded-2xl p-3 border border-sky-400/20 bg-sky-500/10">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-200 mb-1.5">
              You {listening ? "· live" : ""}
            </div>
            <div className="text-sm leading-6 text-white/90 min-h-6">
              {interim || <span className="text-white/40">Listening…</span>}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
