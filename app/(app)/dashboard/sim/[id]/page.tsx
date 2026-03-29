// app/(app)/dashboard/sim/[id]/page.tsx
"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import {
  STACK_LABELS,
  DIFFICULTY_CONFIG,
  PERSONA_COLORS,
  PERSONA_ROLES,
  STACK_TO_TRACK,
  TRACK_INFO,
} from "@/lib/constants";
import { formatDuration } from "@/lib/utils";
import type { PersonaConfig } from "@/lib/types";
import Link from "next/link";

// Matches GET /api/simulations/:id (full model with includes)
type SimDetail = {
  id: string;
  title: string;
  description: string;
  stack: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  experienceType: "SESSION" | "SPRINT";
  estimatedMinutes: number;
  status: string;
  teamConfig: {
    personas: Record<string, PersonaConfig>;
    standupSchedule: { standupNumber: number; afterTicketSeq: number }[];
  };
  tickets: {
    id: string;
    sequence: number;
    title: string;
    brief: string;
    estimatedMinutes: number;
    hasStandup: boolean;
  }[];
  teamTicketTemplates: {
    assignee: string;
    ticketCode: string;
    title: string;
    description: string;
    dependsOnTicketCode: string | null;
    initialStatus: string;
  }[];
};

export default function SimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { getApiToken } = useApiToken();
  const [sim, setSim] = useState<SimDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = (await api.simulations.get(id)) as SimDetail;
        setSim(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load simulation");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleStart = async () => {
    setStarting(true);
    setError("");
    try {
      const token = await getApiToken();
      const session = (await api.workspace.startSession(id, token)) as { id: string };
      router.push(`/workspace/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-sm text-ds-text-dim">Loading simulation...</div>
      </div>
    );
  }

  if (!sim) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="text-sm text-ds-danger">{error || "Simulation not found"}</div>
        <Link href="/dashboard" className="text-xs text-ds-primary hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  const diff = DIFFICULTY_CONFIG[sim.difficulty];
  const track = STACK_TO_TRACK[sim.stack as keyof typeof STACK_TO_TRACK];
  const personas = sim.teamConfig?.personas ? Object.entries(sim.teamConfig.personas) : [];
  const standupCount = sim.teamConfig?.standupSchedule?.length || 0;
  const totalMinutes = sim.tickets.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  return (
    <div className="px-5 py-6 max-w-300 mx-auto">
      {/* Breadcrumb */}
      <Link href="/dashboard" className="text-xs text-ds-text-faint hover:text-ds-text-dim mb-4 inline-flex items-center gap-1">
        <span>&larr;</span> Back to dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: diff.bg, color: diff.color }}>
              {STACK_LABELS[sim.stack as keyof typeof STACK_LABELS] || sim.stack}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-ds-elevated text-ds-text-faint">
              {sim.experienceType === "SPRINT" ? "Sprint" : "Session"}
            </span>
            {track && (
              <span className="text-[10px] text-ds-text-faint">
                {TRACK_INFO[track]?.name}
              </span>
            )}
          </div>
          <h1 className="text-xl font-semibold text-ds-text tracking-tight mb-2">
            {sim.title}
          </h1>
          <p className="text-sm text-ds-text-dim leading-relaxed max-w-[600px]">
            {sim.description}
          </p>
        </div>

        {/* Start button */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <button
            onClick={handleStart}
            disabled={starting}
            className="px-6 py-3 rounded-lg bg-ds-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {starting ? "Starting..." : "Start Sprint"}
          </button>
          {error && <div className="text-[11px] text-ds-danger max-w-48 text-right">{error}</div>}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-2.5 mb-6">
        <StatBox label="Difficulty" value={diff.label} color={diff.color} />
        <StatBox label="Duration" value={formatDuration(sim.estimatedMinutes)} color="var(--color-ds-text)" />
        <StatBox label="Tickets" value={`${sim.tickets.length}`} color="var(--color-ds-primary-muted)" />
        <StatBox label="Teammates" value={`${personas.length}`} color="var(--color-ds-info)" />
        <StatBox label="Standups" value={`${standupCount}`} color="var(--color-ds-warning)" />
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-5">
        {/* ─── Tickets ──────────────────────────────── */}
        <div>
          <h2 className="text-[13px] font-semibold text-ds-text-secondary mb-3">
            Tickets ({sim.tickets.length})
          </h2>
          <div className="space-y-2">
            {sim.tickets.map((ticket, i) => (
              <div
                key={ticket.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-ds-surface border border-ds-border"
              >
                <div className="w-7 h-7 rounded-md bg-ds-primary/10 flex items-center justify-center text-[11px] font-bold text-ds-primary-muted shrink-0">
                  {ticket.sequence}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-ds-text mb-0.5">
                    {ticket.title}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-ds-text-faint">
                    <span>{formatDuration(ticket.estimatedMinutes)}</span>
                    {ticket.hasStandup && (
                      <span className="flex items-center gap-1 text-ds-warning">
                        <span className="w-1.5 h-1.5 rounded-full bg-ds-warning" />
                        Standup after
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Team tickets (what your teammates are working on) */}
          {sim.teamTicketTemplates.length > 0 && (
            <div className="mt-6">
              <h2 className="text-[13px] font-semibold text-ds-text-secondary mb-3">
                Team board ({sim.teamTicketTemplates.length} tickets)
              </h2>
              <p className="text-[11px] text-ds-text-faint mb-3">
                Your teammates will be working on these in parallel. Their progress shows on the kanban board.
              </p>
              <div className="space-y-1.5">
                {sim.teamTicketTemplates.map((tt, i) => {
                  const color = PERSONA_COLORS[tt.assignee] || "#7B7990";
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 p-2.5 rounded-md bg-ds-surface/70 border border-ds-border/50"
                    >
                      <code className="text-[10px] font-mono text-ds-text-faint w-14 shrink-0">
                        {tt.ticketCode}
                      </code>
                      <div className="flex-1 text-[11px] text-ds-text-muted truncate">
                        {tt.title}
                      </div>
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: `${color}15`, color }}
                      >
                        {tt.assignee}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── Right: Team + info ───────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Your team */}
          <div className="p-4 rounded-lg bg-ds-surface border border-ds-border">
            <h3 className="text-[11px] text-ds-text-faint uppercase tracking-wider mb-3">
              Your team
            </h3>
            <div className="space-y-3">
              {personas.map(([key, persona]) => {
                const senderKey = key.toUpperCase();
                const color = PERSONA_COLORS[senderKey] || "#7B7990";
                return (
                  <div key={key} className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: `${color}20`, color }}
                    >
                      {persona.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-ds-text">
                        {persona.name}
                      </div>
                      <div className="text-[10px] text-ds-text-faint">
                        {persona.role}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* What to expect */}
          <div className="p-4 rounded-lg bg-ds-surface border border-ds-border">
            <h3 className="text-[11px] text-ds-text-faint uppercase tracking-wider mb-3">
              What to expect
            </h3>
            <div className="space-y-2.5 text-[11px] text-ds-text-dim leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="text-ds-primary-muted mt-0.5">1.</span>
                <span>You&apos;ll get a real IDE with terminal, editor, and your project files</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-ds-primary-muted mt-0.5">2.</span>
                <span>Work through {sim.tickets.length} tickets from your PM (Sarah)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-ds-primary-muted mt-0.5">3.</span>
                <span>Chat with your team for help. They won&apos;t give answers directly</span>
              </div>
              {standupCount > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-ds-primary-muted mt-0.5">4.</span>
                  <span>{standupCount} audio standup{standupCount > 1 ? "s" : ""} with your PM during the sprint</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-ds-primary-muted mt-0.5">{standupCount > 0 ? "5" : "4"}.</span>
                <span>Get a multi-dimensional evaluation when you finish</span>
              </div>
            </div>
          </div>

          {/* Scoring weights */}
          <div className="p-4 rounded-lg bg-ds-surface border border-ds-border">
            <h3 className="text-[11px] text-ds-text-faint uppercase tracking-wider mb-3">
              You&apos;ll be scored on
            </h3>
            <div className="space-y-2">
              <ScoreWeight label="Technical accuracy" pct={45} color="var(--color-ds-primary)" />
              <ScoreWeight label="Code quality" pct={30} color="var(--color-ds-success)" />
              <ScoreWeight label="Comprehension" pct={15} color="var(--color-ds-info)" />
              <ScoreWeight label="Time management" pct={10} color="var(--color-ds-warning)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-3 rounded-lg bg-ds-surface border border-ds-border text-center">
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] text-ds-text-faint mt-0.5">{label}</div>
    </div>
  );
}

function ScoreWeight({ label, pct, color }: { label: string; value?: number; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-ds-text-dim flex-1">{label}</span>
      <div className="w-20 h-1.5 bg-ds-border rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] text-ds-text-faint w-7 text-right">{pct}%</span>
    </div>
  );
}