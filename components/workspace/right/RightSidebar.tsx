"use client";

import { useState } from "react";

type Props = {
  messages: any[];
  chatInput: string;
  chatSending: boolean;
  teamTickets: any[];
  session: any;
  setChatInput: (value: string) => void;
  sendChat: () => void | Promise<void>;
};

export default function RightSidebar({
  messages,
  chatInput,
  chatSending,
  teamTickets,
  session,
  setChatInput,
  sendChat,
}: Props) {
  const [tab, setTab] = useState<"chat" | "board" | "ticket">("chat");

  const currentTicket = session?.simulation?.tickets?.find(
    (ticket: any) => ticket.sequence === session?.currentTicketSeq
  );

  return (
    <div className="ide-panel flex h-full flex-col border-l">
      <div className="flex h-10 items-center gap-1 border-b border-white/10 px-2">
        {(["chat", "board", "ticket"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={[
              "rounded px-2.5 py-1.5 text-[11px] uppercase tracking-[0.12em]",
              tab === item
                ? "bg-[#16213a] text-white"
                : "ide-muted hover:bg-white/[0.04] hover:text-white/75",
            ].join(" ")}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "chat" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-2 overflow-auto px-3 py-3">
            {messages.length === 0 ? (
              <div className="text-sm ide-muted">No messages yet.</div>
            ) : (
              messages.map((message: any) => (
                <div
                  key={message.id}
                  className="rounded border border-white/8 bg-white/[0.03] px-3 py-2"
                >
                  <div className="mb-1 text-[11px] ide-muted">
                    {message.personaName ?? message.persona ?? "Team"}
                  </div>
                  <div className="whitespace-pre-wrap text-[13px] text-white/80">
                    {message.content}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-white/10 p-2">
            <div className="rounded border border-white/10 bg-[#0b1020] p-2">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                rows={2}
                placeholder="Message team..."
                className="w-full resize-none bg-transparent text-[13px] text-white outline-none placeholder:text-white/25"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => void sendChat()}
                  disabled={chatSending || !chatInput.trim()}
                  className="rounded bg-[#1f6feb] px-3 py-1.5 text-[12px] text-white disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "board" && (
        <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
          <div className="mb-3 text-[11px] uppercase tracking-[0.16em] ide-muted">
            Team board
          </div>

          <div className="space-y-2">
            {teamTickets.length === 0 ? (
              <div className="text-sm ide-muted">No board items yet.</div>
            ) : (
              teamTickets.map((ticket: any) => (
                <div
                  key={ticket.id}
                  className="rounded border border-white/8 bg-white/[0.03] px-3 py-2"
                >
                  <div className="text-sm text-white/90">{ticket.title}</div>
                  <div className="mt-1 text-xs ide-muted">{ticket.status ?? "Pending"}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "ticket" && (
        <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
          <div className="mb-3 text-[11px] uppercase tracking-[0.16em] ide-muted">
            Current ticket
          </div>

          {!currentTicket ? (
            <div className="text-sm ide-muted">No ticket selected.</div>
          ) : (
            <div className="rounded border border-white/8 bg-white/[0.03] p-3">
              <div className="text-sm font-medium text-white/90">{currentTicket.title}</div>
              <div className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-white/72">
                {currentTicket.brief}
              </div>
              <div className="mt-3 text-xs ide-muted">
                Estimated: {currentTicket.estimatedMinutes} mins
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}