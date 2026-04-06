// components/workspace/Topbar.tsx
"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useState, useCallback } from "react";
import { EvalActions } from "./eval-actions";
import { LogOut, X } from "lucide-react";

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
  const [showExitDialog, setShowExitDialog] = useState(false);

  const totalTickets = session?.simulation?.tickets?.length ?? 5;
  const currentSeq = session?.currentTicketSeq ?? 1;
  const hasContainer = !!session?.spriteId;
  const simTitle = session?.simulation?.title ?? "Sprint";

  const currentTicket = session?.simulation?.tickets?.find(
    (t: any) => t.sequence === currentSeq
  );

  const handleExit = useCallback(() => {
    setShowExitDialog(false);
    router.push("/dashboard");
  }, [router]);

  return (
    <>
      <div className="flex items-center h-11 px-3 bg-ds-base border-b border-ds-border shrink-0">
        {/* Left: Logo + Sprint info */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setShowExitDialog(true)}
            className="text-sm font-bold text-ds-primary-muted tracking-tight hover:text-ds-primary transition-colors"
          >
            devsim
          </button>

          <div className="h-4 w-px bg-ds-border" />

          <div className="min-w-0 flex items-center gap-2.5">
            <span className="text-[11px] text-ds-text-dim px-2 py-0.5 bg-ds-elevated rounded truncate max-w-[160px]">
              {simTitle}
            </span>

            {/* Ticket progress dots */}
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
                    title={`Ticket ${seq}${seq === currentSeq ? " (current)" : seq < currentSeq ? " (done)" : ""}`}
                  />
                );
              })}
            </div>

            <span className="text-[10px] font-semibold text-ds-base bg-ds-primary px-2 py-0.5 rounded">
              {currentSeq}/{totalTickets}
            </span>

            {/* Current ticket name */}
            {currentTicket && (
              <>
                <div className="h-3 w-px bg-ds-border hidden md:block" />
                <span className="text-[10px] text-ds-text-faint truncate max-w-[200px] hidden md:block">
                  {currentTicket.title}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Center: Eval actions */}
        <div className="flex-1 flex justify-center">
          <EvalActions
            sessionId={sessionId}
            currentTicketSeq={currentSeq}
            onAdvance={onAdvance}
          />
        </div>

        {/* Right: Status + Exit + Avatar */}
        <div className="flex items-center gap-2.5">
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

          <button
            onClick={() => setShowExitDialog(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-ds-text-faint hover:text-ds-danger hover:bg-ds-danger/8 transition-colors"
            title="Exit sprint"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">Exit</span>
          </button>

          <div className="w-6 h-6 rounded-full bg-ds-elevated flex items-center justify-center text-[9px] font-bold text-ds-primary-muted">
            {user?.firstName?.[0] || "?"}
            {user?.lastName?.[0] || ""}
          </div>
        </div>
      </div>

      {/* Exit confirmation dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 z-[90] bg-ds-base/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-ds-surface border border-ds-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-0">
              <h3 className="text-base font-semibold text-ds-text">
                Leave sprint?
              </h3>
              <button
                onClick={() => setShowExitDialog(false)}
                className="text-ds-text-faint hover:text-ds-text-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-ds-text-dim leading-relaxed">
                Your progress is saved automatically. You can resume this sprint
                anytime from your dashboard.
              </p>
              <p className="text-xs text-ds-text-faint mt-2">
                Currently on ticket {currentSeq} of {totalTickets}
                {currentTicket ? ` — ${currentTicket.title}` : ""}
              </p>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setShowExitDialog(false)}
                className="flex-1 py-2.5 rounded-lg border border-ds-border-strong text-sm font-medium text-ds-text-secondary hover:bg-ds-elevated transition-colors"
              >
                Stay
              </button>
              <button
                onClick={handleExit}
                className="flex-1 py-2.5 rounded-lg bg-ds-danger/15 border border-ds-danger/25 text-sm font-medium text-ds-danger hover:bg-ds-danger/25 transition-colors"
              >
                Exit sprint
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}