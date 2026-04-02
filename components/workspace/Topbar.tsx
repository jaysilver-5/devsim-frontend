"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { EvalActions } from "./eval-actions";

type Props = {
  session: any;
  sessionId: string;
  token: string | null;
  connected: boolean;
  onAdvance: () => void;
};

export default function Topbar({
  session,
  sessionId,
  token,
  connected,
  onAdvance,
}: Props) {
  const router = useRouter();
  const { user } = useUser();

  const totalTickets = session?.simulation?.tickets?.length ?? 5;
  const currentSeq = session?.currentTicketSeq ?? 1;
  const hasContainer = !!session?.spriteId;

  return (
    <div className="flex items-center h-11 px-3 bg-ds-base border-b border-ds-border shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm font-bold text-ds-primary-muted tracking-tight hover:text-ds-primary transition-colors"
        >
          devsim
        </button>

        <div className="h-4 w-px bg-ds-border" />

        <div className="min-w-0 flex items-center gap-2.5">
          <span className="text-[11px] text-ds-text-dim px-2 py-0.5 bg-ds-elevated rounded">
            {session?.simulation?.title ?? "Sprint"}
          </span>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalTickets }, (_, i) => {
              const seq = i + 1;
              return (
                <div
                  key={seq}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    seq < currentSeq
                      ? "bg-ds-success"
                      : seq === currentSeq
                      ? "bg-ds-primary"
                      : "bg-ds-border-strong"
                  }`}
                  title={`Ticket ${seq}`}
                />
              );
            })}
          </div>

          <span className="text-[10px] font-semibold text-ds-base bg-ds-primary px-2 py-0.5 rounded">
            {currentSeq}/{totalTickets}
          </span>
        </div>
      </div>

      <div className="flex-1 flex justify-center">
        <EvalActions
          sessionId={sessionId}
          currentTicketSeq={currentSeq}
          onAdvance={onAdvance}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              connected
                ? "bg-ds-success shadow-[0_0_6px_rgba(0,210,160,0.4)]"
                : hasContainer
                ? "bg-ds-warning"
                : "bg-ds-text-faint"
            }`}
          />
          <span
            className={`text-[10px] ${
              connected
                ? "text-ds-success"
                : hasContainer
                ? "text-ds-warning"
                : "text-ds-text-faint"
            }`}
          >
            {connected ? "Live" : hasContainer ? "REST" : "Local"}
          </span>
        </div>

        <div className="w-6 h-6 rounded-full bg-ds-elevated flex items-center justify-center text-[9px] font-bold text-ds-primary-muted">
          {user?.firstName?.[0] || "?"}
          {user?.lastName?.[0] || ""}
        </div>
      </div>
    </div>
  );
}