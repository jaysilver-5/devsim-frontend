// app/(app)/dashboard/history/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { STACK_LABELS, DIFFICULTY_CONFIG } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import { Trophy, Clock, RotateCcw, ChevronRight } from "lucide-react";

type HistorySession = {
  id: string;
  status: string;
  currentTicketSeq: number;
  startedAt: string;
  completedAt: string | null;
  simulation?: {
    id: string;
    title: string;
    stack: string;
    difficulty: string;
    experienceType: string;
    tickets: { sequence: number }[];
  };
  report?: { overallScore: number } | null;
};

export default function HistoryPage() {
  const { getApiToken } = useApiToken();
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiToken();
        // Fetch user's sessions — the backend may expose a list endpoint
        // For now we'll show empty state with proper design
        setSessions([]);
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getApiToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-sm text-ds-text-dim">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 max-w-[800px] mx-auto">
      <h1 className="text-lg font-semibold text-ds-text tracking-tight mb-1">Sprint history</h1>
      <p className="text-sm text-ds-text-dim mb-6">Your completed simulations and scores</p>

      {sessions.length === 0 ? (
        <div className="p-10 text-center rounded-lg border border-dashed border-ds-border bg-ds-surface">
          <div className="w-12 h-12 rounded-xl bg-ds-primary/10 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-6 h-6 text-ds-primary-muted" />
          </div>
          <div className="text-sm text-ds-text-secondary mb-1">No completed sprints yet</div>
          <p className="text-xs text-ds-text-dim mb-4">Complete a simulation to see your results and track progress over time.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs text-ds-primary font-medium hover:underline">
            Browse simulations <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((sess) => {
            const sim = sess.simulation;
            const score = sess.report?.overallScore;
            const totalTickets = sim?.tickets?.length || 5;
            const isComplete = sess.status === "COMPLETED";
            const diff = sim?.difficulty ? DIFFICULTY_CONFIG[sim.difficulty as keyof typeof DIFFICULTY_CONFIG] : null;

            return (
              <Link
                key={sess.id}
                href={isComplete ? `/reports/${sess.id}` : `/workspace/${sess.id}`}
                className="flex items-center gap-3 p-3.5 rounded-lg border border-ds-border bg-ds-surface hover:border-ds-border-strong transition-all"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    score && score >= 80 ? "bg-ds-success/15 text-ds-success"
                      : score && score >= 60 ? "bg-ds-warning/15 text-ds-warning"
                      : score ? "bg-ds-danger/15 text-ds-danger"
                      : "bg-ds-elevated text-ds-text-faint"
                  }`}
                >
                  {score ?? "--"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-ds-text truncate">
                    {sim?.title || "Unknown simulation"}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-ds-text-faint mt-0.5">
                    {diff && (
                      <span className="font-semibold px-1.5 py-0.5 rounded" style={{ background: diff.bg, color: diff.color }}>
                        {diff.label}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {sess.completedAt ? formatRelativeTime(sess.completedAt) : "In progress"}
                    </span>
                    <span>{sess.currentTicketSeq}/{totalTickets} tickets</span>
                  </div>
                </div>
                <div className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${
                  isComplete ? "bg-ds-success/10 text-ds-success" : "bg-ds-primary/10 text-ds-primary-muted"
                }`}>
                  {isComplete ? "View report" : "Resume"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
