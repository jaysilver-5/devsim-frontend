// components/workspace/right/RightSidebar.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, LayoutGrid, FileText } from "lucide-react";
import { PERSONA_COLORS, PERSONA_NAMES, PERSONA_INITIALS } from "@/lib/constants";
import type { ChatMessage, TeamTicket } from "@/lib/types";

type Tab = "chat" | "board" | "ticket";

type Props = {
  messages: ChatMessage[];
  chatInput: string;
  chatSending: boolean;
  teamTickets: TeamTicket[];
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
  const [tab, setTab] = useState<Tab>("chat");

  const currentTicket = session?.simulation?.tickets?.find(
    (t: any) => t.sequence === session?.currentTicketSeq
  );
  const totalTickets = session?.simulation?.tickets?.length ?? 5;

  const tabs: { key: Tab; label: string; icon: typeof MessageSquare; count?: number }[] = [
    { key: "chat", label: "Chat", icon: MessageSquare, count: messages.length },
    { key: "board", label: "Board", icon: LayoutGrid, count: teamTickets.length },
    { key: "ticket", label: "Ticket", icon: FileText },
  ];

  return (
    <div className="h-full flex flex-col bg-ds-surface/60">
      {/* Tab bar */}
      <div className="flex h-9 border-b border-ds-border shrink-0">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 text-[10px] font-semibold tracking-wider relative transition-colors ${
              tab === key ? "text-ds-text-secondary" : "text-ds-text-dim hover:text-ds-text-muted"
            }`}
          >
            {label}{count !== undefined ? ` (${count})` : ""}
            {tab === key && (
              <div className="absolute bottom-0 left-[20%] right-[20%] h-[2px] bg-ds-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {tab === "chat" && (
        <ChatPanel
          messages={messages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          onSend={sendChat}
          sending={chatSending}
        />
      )}
      {tab === "board" && <BoardPanel teamTickets={teamTickets} />}
      {tab === "ticket" && (
        <TicketPanel
          ticket={currentTicket}
          ticketSeq={session?.currentTicketSeq ?? 1}
          totalTickets={totalTickets}
        />
      )}
    </div>
  );
}

// ─── Chat ─────────────────────────────────────────────

function ChatPanel({
  messages,
  chatInput,
  setChatInput,
  onSend,
  sending,
}: {
  messages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  onSend: () => void;
  sending: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {messages.length === 0 ? (
          <div className="text-[11px] text-ds-text-faint text-center py-8">
            Chat will appear when the session starts...
          </div>
        ) : (
          messages.map((msg) => {
            const color = PERSONA_COLORS[msg.sender] || PERSONA_COLORS.SYSTEM || "#7B7990";
            const isCandidate = msg.sender === "CANDIDATE";

            return (
              <div key={msg.id} className={`flex gap-2 items-start ${isCandidate ? "flex-row-reverse" : ""}`}>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                  style={{ background: `${color}18`, color }}
                >
                  {isCandidate
                    ? "You"
                    : PERSONA_INITIALS?.[msg.sender] || msg.sender?.[0] || "?"}
                </div>
                <div className={`flex-1 min-w-0 ${isCandidate ? "text-right" : ""}`}>
                  <div className="text-[10px] font-semibold mb-0.5" style={{ color }}>
                    {isCandidate ? "You" : PERSONA_NAMES?.[msg.sender] || msg.sender}
                  </div>
                  <div
                    className={`text-[11px] leading-relaxed whitespace-pre-wrap inline-block max-w-[92%] rounded-lg px-2.5 py-1.5 ${
                      isCandidate
                        ? "bg-ds-primary/10 text-ds-text-secondary text-left"
                        : "text-ds-text-muted"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className="text-[9px] text-ds-text-ghost mt-0.5">
                    {msg.createdAt
                      ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-ds-border shrink-0">
        <div className="flex gap-1.5">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
            disabled={sending}
            placeholder={sending ? "Waiting..." : "Message your team..."}
            className="flex-1 px-2.5 py-2 rounded-lg bg-ds-elevated text-[11px] text-ds-text-secondary placeholder:text-ds-text-ghost focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={onSend}
            disabled={sending || !chatInput.trim()}
            className="px-3 py-2 rounded-lg bg-ds-primary text-white text-[10px] font-semibold disabled:opacity-30 hover:opacity-90 transition-opacity shrink-0"
          >
            Send
          </button>
        </div>
        <div className="text-[9px] text-ds-text-ghost mt-1 px-0.5">
          <span className="text-ds-primary-muted">@sarah</span>{" "}
          <span className="text-ds-primary-muted">@marcus</span>{" "}
          <span className="text-ds-primary-muted">@priya</span>{" "}
          <span className="text-ds-primary-muted">@james</span>
        </div>
      </div>
    </div>
  );
}

// ─── Board ────────────────────────────────────────────

function BoardPanel({ teamTickets }: { teamTickets: TeamTicket[] }) {
  const cols = [
    { key: "TODO", label: "To do", dot: "bg-ds-text-faint" },
    { key: "IN_PROGRESS", label: "In progress", dot: "bg-ds-primary" },
    { key: "IN_REVIEW", label: "Review", dot: "bg-ds-warning" },
    { key: "DONE", label: "Done", dot: "bg-ds-success" },
    { key: "BLOCKED", label: "Blocked", dot: "bg-ds-danger" },
  ];

  if (teamTickets.length === 0) {
    return (
      <div className="flex-1 p-3">
        <div className="text-[11px] text-ds-text-faint text-center py-8">
          Board will populate as the sprint progresses.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2.5">
      {cols.map(({ key, label, dot }) => {
        const items = teamTickets.filter((t) => t.status === key);
        if (items.length === 0) return null;

        return (
          <div key={key} className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
              <span className="text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">
                {label} ({items.length})
              </span>
            </div>
            <div className="space-y-1">
              {items.map((t) => {
                const c = PERSONA_COLORS[t.assignee] || "#7B7990";
                return (
                  <div key={t.id} className="p-2 rounded-md bg-ds-elevated">
                    <div className="flex items-center justify-between mb-0.5">
                      <code className="text-[9px] font-mono text-ds-text-ghost">{t.ticketCode}</code>
                      <span
                        className="text-[8px] font-semibold px-1 py-0.5 rounded"
                        style={{ background: `${c}12`, color: c }}
                      >
                        {PERSONA_NAMES?.[t.assignee]?.split(" ")[0] || t.assignee}
                      </span>
                    </div>
                    <div className="text-[10px] text-ds-text-muted">{t.title}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Ticket ───────────────────────────────────────────

function TicketPanel({
  ticket,
  ticketSeq,
  totalTickets,
}: {
  ticket: any;
  ticketSeq: number;
  totalTickets: number;
}) {
  if (!ticket) {
    return (
      <div className="flex-1 p-3 text-[11px] text-ds-text-faint text-center py-8">
        No ticket loaded.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-3 pt-3 pb-2.5 border-b border-ds-border-subtle">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-ds-primary/12 flex items-center justify-center text-[10px] font-bold text-ds-primary-muted">
            {ticket.sequence}
          </div>
          <h3 className="text-[12px] font-semibold text-ds-text leading-snug flex-1 min-w-0 truncate">
            {ticket.title}
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-ds-text-faint">
          <span>Ticket {ticketSeq} of {totalTickets}</span>
          <span>{ticket.estimatedMinutes} min</span>
          {ticket.hasStandup && (
            <span className="text-ds-warning flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-ds-warning" />
              Standup after
            </span>
          )}
        </div>
        <div className="flex gap-1 mt-2.5">
          {Array.from({ length: totalTickets }, (_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full ${
                i + 1 < ticketSeq ? "bg-ds-success" : i + 1 === ticketSeq ? "bg-ds-primary" : "bg-ds-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Brief — rendered clean */}
      <div className="px-3 py-3">
        <BriefRenderer text={ticket.brief} />
      </div>
    </div>
  );
}

// ─── Brief markdown renderer ──────────────────────────

function BriefRenderer({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="mb-2.5 space-y-1">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] text-ds-text-dim leading-relaxed">
              <span className="w-1 h-1 rounded-full bg-ds-primary/50 mt-[7px] shrink-0" />
              <span>{inlineFormat(item)}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flushList(); return; }

    // Headings
    if (t.startsWith("### ")) {
      flushList();
      elements.push(<div key={i} className="text-[10px] font-semibold text-ds-text-muted uppercase tracking-wider mt-3 mb-1.5">{t.slice(4)}</div>);
      return;
    }
    if (t.startsWith("## ")) {
      flushList();
      elements.push(<div key={i} className="text-[11px] font-semibold text-ds-text-secondary mt-3 mb-1.5">{t.slice(3)}</div>);
      return;
    }
    if (t.startsWith("# ")) {
      flushList();
      elements.push(<div key={i} className="text-[12px] font-semibold text-ds-text mt-2 mb-1.5">{t.slice(2)}</div>);
      return;
    }

    // Lists
    if (t.match(/^[-*]\s/) || t.match(/^\d+\.\s/)) {
      listItems.push(t.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""));
      return;
    }

    // Checkboxes
    if (t.match(/^[-*]\s*\[[ xX]\]/)) {
      flushList();
      const checked = t.includes("[x]") || t.includes("[X]");
      const content = t.replace(/^[-*]\s*\[[ xX]\]\s*/, "");
      elements.push(
        <div key={i} className="flex items-start gap-2 mb-1 text-[11px]">
          <div className={`w-3.5 h-3.5 rounded mt-[2px] flex items-center justify-center shrink-0 ${
            checked ? "bg-ds-success/15 text-ds-success" : "bg-ds-border-strong"
          }`}>
            {checked && <span className="text-[8px]">✓</span>}
          </div>
          <span className={checked ? "text-ds-text-muted line-through" : "text-ds-text-dim"}>
            {inlineFormat(content)}
          </span>
        </div>
      );
      return;
    }

    // Code fence
    if (t.startsWith("```")) { flushList(); return; }

    // Paragraph
    flushList();
    elements.push(
      <p key={i} className="text-[11px] text-ds-text-dim leading-relaxed mb-2">
        {inlineFormat(t)}
      </p>
    );
  });

  flushList();
  return <>{elements}</>;
}

function inlineFormat(text: string): React.ReactNode {
  // Simple inline: **bold**, `code`, *italic*
  const parts: React.ReactNode[] = [];
  let rest = text;
  let k = 0;

  while (rest.length > 0) {
    const bold = rest.match(/\*\*(.+?)\*\*/);
    const code = rest.match(/`([^`]+)`/);

    let earliest: { m: RegExpMatchArray; type: string } | null = null;
    for (const [m, type] of [[bold, "b"], [code, "c"]] as [RegExpMatchArray | null, string][]) {
      if (m && m.index !== undefined && (!earliest || m.index < earliest.m.index!)) {
        earliest = { m, type };
      }
    }

    if (!earliest) { parts.push(rest); break; }

    const before = rest.substring(0, earliest.m.index!);
    if (before) parts.push(before);

    if (earliest.type === "b") {
      parts.push(<strong key={k++} className="text-ds-text-secondary font-semibold">{earliest.m[1]}</strong>);
    } else {
      parts.push(<code key={k++} className="text-[10px] font-mono bg-ds-elevated px-1 py-0.5 rounded text-ds-info">{earliest.m[1]}</code>);
    }

    rest = rest.substring(earliest.m.index! + earliest.m[0].length);
  }

  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
}