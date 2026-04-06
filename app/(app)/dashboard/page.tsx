// app/(app)/dashboard/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { STACK_LABELS, DIFFICULTY_CONFIG, STACK_TO_TRACK, TRACK_INFO } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";
import type { BillingInfo, Difficulty, Track } from "@/lib/types";
import Link from "next/link";
import {
  Server, Layout, Layers, Shield, Play, Clock, Ticket,
  ArrowRight, Zap, ChevronRight, Plus, Flame, TrendingUp,
  TrendingDown, Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────

type SimListItem = {
  id: string;
  title: string;
  description: string;
  stack: string;
  difficulty: Difficulty;
  experienceType: "SESSION" | "SPRINT";
  estimatedMinutes: number;
  _count: { tickets: number };
};

type ActiveSession = {
  id: string;
  status: string;
  currentTicketSeq: number;
  startedAt: string;
  lastActiveAt: string;
  _simTitle?: string;
  _simStack?: string;
  _simTickets?: number;
};

// ─── Track icons ──────────────────────────────────────

const TRACK_ICONS: Record<string, { icon: typeof Server; color: string; bg: string }> = {
  BACKEND: { icon: Server, color: "#00D2A0", bg: "rgba(0,210,160,0.08)" },
  FRONTEND: { icon: Layout, color: "#4ECDC4", bg: "rgba(78,205,196,0.08)" },
  FULLSTACK: { icon: Layers, color: "#A29BFE", bg: "rgba(162,155,254,0.08)" },
  CYBERSECURITY: { icon: Shield, color: "#FF6B6B", bg: "rgba(255,107,107,0.08)" },
};

// ─── Main ─────────────────────────────────────────────

export default function LearnerDashboard() {
  const { user: clerkUser } = useUser();
  const { getApiToken } = useApiToken();
  const [sims, setSims] = useState<SimListItem[]>([]);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeTrack, setActiveTrack] = useState<"ALL" | Track>("ALL");
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);

  useEffect(() => {
    async function load() {
      setApiError(null);
      const token = await getApiToken().catch(() => null);
      let loadedSims: SimListItem[] = [];

      try {
        loadedSims = (await api.simulations.list(undefined, token || undefined)) as SimListItem[];
        setSims(loadedSims);
      } catch (err) {
        console.error("[dashboard] Simulations failed:", err);
        setApiError("Could not load simulations. Is the backend running?");
      }

      if (token) {
        try {
          setBilling((await api.billing.getInfo(token)) as BillingInfo);
        } catch (err) {
          console.error("[dashboard] Billing failed (non-fatal):", err);
        }

        const sessions: ActiveSession[] = [];
        for (const sim of loadedSims) {
          try {
            const sess = (await api.workspace.getSessionBySim(sim.id, token)) as ActiveSession | null;
            if (sess && sess.status !== "COMPLETED" && sess.status !== "ABANDONED") {
              sessions.push({ ...sess, _simTitle: sim.title, _simStack: sim.stack, _simTickets: sim._count.tickets });
            }
          } catch { /* No session for this sim */ }
        }
        setActiveSessions(sessions);
      }

      setLoading(false);
    }
    load();
  }, [getApiToken]);

  const displayName = clerkUser?.firstName || clerkUser?.username || "there";

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const availableTracks = useMemo(() => {
    const set = new Set<Track>();
    sims.forEach((s) => {
      const t = STACK_TO_TRACK[s.stack as keyof typeof STACK_TO_TRACK];
      if (t) set.add(t);
    });
    return Array.from(set);
  }, [sims]);

  const filtered = useMemo(() => {
    if (activeTrack === "ALL") return sims;
    return sims.filter(
      (s) => STACK_TO_TRACK[s.stack as keyof typeof STACK_TO_TRACK] === activeTrack
    );
  }, [sims, activeTrack]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-ds-primary/15 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full border-2 border-ds-primary border-t-transparent animate-spin" />
          </div>
          <div className="text-sm text-ds-text-dim">Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-6">
      <div className="grid grid-cols-[1fr_260px] gap-6 max-w-[1100px] mx-auto">

        {/* ─── Main column ──────────────────────────── */}
        <div className="min-w-0">

          {/* Greeting */}
          <h1 className="text-[22px] font-semibold text-ds-text tracking-tight">
            {greeting}, {displayName}
          </h1>
          <p className="text-[13px] text-ds-text-dim mt-1 mb-6">
            {activeSessions.length > 0
              ? `You have ${activeSessions.length} sprint${activeSessions.length !== 1 ? "s" : ""} in progress.`
              : sims.length > 0
                ? "Pick up where you left off, or start a new simulation."
                : "Your simulations will appear here once the backend is running."}
          </p>

          {apiError && (
            <div className="mb-5 px-4 py-3 rounded-lg border border-ds-danger/30 bg-ds-danger/8 text-xs text-ds-danger flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-ds-danger shrink-0" />
              {apiError}
            </div>
          )}

          {/* ── Continue where you left off ──────────── */}
          {activeSessions.length > 0 && (
            <div className="mb-7">
              <SectionHeader title="Continue where you left off" />
              <div className="space-y-2.5">
                {activeSessions.map((sess) => {
                  const totalTickets = sess._simTickets || 5;
                  const progress = Math.round(((sess.currentTicketSeq - 1) / totalTickets) * 100);
                  const track = STACK_TO_TRACK[sess._simStack as keyof typeof STACK_TO_TRACK] || "BACKEND";
                  const trackMeta = TRACK_ICONS[track] || TRACK_ICONS.BACKEND;
                  const TrackIcon = trackMeta.icon;

                  return (
                    <Link
                      key={sess.id}
                      href={`/workspace/${sess.id}`}
                      className="group flex items-center gap-4 p-4 rounded-xl border border-ds-primary/20 bg-gradient-to-r from-ds-primary/[0.04] to-transparent hover:border-ds-primary/35 hover:from-ds-primary/[0.07] transition-all"
                    >
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: trackMeta.bg }}>
                        <TrackIcon className="w-5 h-5" style={{ color: trackMeta.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-semibold px-2 py-0.5 rounded bg-ds-primary/10 text-ds-primary-muted inline-block mb-1.5">
                          {STACK_LABELS[sess._simStack as keyof typeof STACK_LABELS] || sess._simStack || "Sprint"}
                        </div>
                        <div className="text-[14px] font-semibold text-ds-text leading-snug">
                          {sess._simTitle || "Sprint in progress"}
                        </div>
                        <div className="flex items-center gap-2.5 mt-2">
                          <div className="flex-1 h-1.5 bg-ds-border rounded-full overflow-hidden">
                            <div className="h-full bg-ds-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[10px] text-ds-text-dim font-medium shrink-0">
                            Ticket {sess.currentTicketSeq}/{totalTickets}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-ds-primary text-white text-xs font-semibold shrink-0 group-hover:bg-ds-primary-hover transition-colors">
                        <Play className="w-3.5 h-3.5" fill="currentColor" />
                        Resume
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Available simulations ────────────────── */}
          <div className="mb-7">
            <SectionHeader title="Simulations" action={{ label: "View all", href: "/dashboard/simulations" }} />

            {/* Track tabs */}
            <div className="flex items-center gap-1 mb-4">
              <TrackTab label="All" active={activeTrack === "ALL"} count={sims.length} onClick={() => setActiveTrack("ALL")} />
              {availableTracks.map((track) => (
                <TrackTab
                  key={track}
                  label={TRACK_INFO[track]?.name.replace(" Engineering", "") || track}
                  active={activeTrack === track}
                  count={sims.filter((s) => STACK_TO_TRACK[s.stack as keyof typeof STACK_TO_TRACK] === track).length}
                  onClick={() => setActiveTrack(track)}
                />
              ))}
            </div>

            {/* Cards */}
            {filtered.length === 0 && !apiError ? (
              <div className="p-10 text-center rounded-xl border border-dashed border-ds-border bg-ds-surface/50">
                <p className="text-sm text-ds-text-dim">No simulations in this track yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filtered.map((sim) => (
                  <SimCard key={sim.id} sim={sim} />
                ))}
                <Link
                  href="/dashboard/simulations"
                  className="p-5 rounded-xl border border-dashed border-ds-border bg-ds-surface/30 flex flex-col items-center justify-center gap-2.5 min-h-[160px] cursor-pointer hover:border-ds-primary/25 hover:bg-ds-surface/60 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-ds-primary/8 flex items-center justify-center group-hover:bg-ds-primary/15 transition-colors">
                    <Plus className="w-5 h-5 text-ds-primary-muted" />
                  </div>
                  <div className="text-[11px] font-medium text-ds-text-faint group-hover:text-ds-text-dim transition-colors">
                    Request a simulation
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* ── Recent sprints ───────────────────────── */}
          <div className="mb-6">
            <SectionHeader title="Recent sprints" action={{ label: "View all", href: "/dashboard/history" }} />
            <div className="p-5 rounded-xl border border-ds-border bg-ds-surface/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-ds-elevated flex items-center justify-center">
                  <Flame className="w-4 h-4 text-ds-text-ghost" />
                </div>
                <div>
                  <div className="text-[13px] text-ds-text-dim font-medium">No completed sprints yet</div>
                  <div className="text-[11px] text-ds-text-faint mt-0.5">
                    Complete a simulation to track your progress over time
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Right sidebar ────────────────────────── */}
        <div className="flex flex-col gap-3 pt-1">

          {/* Plan card */}
          <div className="p-4 rounded-xl bg-ds-surface border border-ds-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-ds-warning uppercase tracking-wider">
                {billing?.planLabel || "Free"} plan
              </span>
              <Link href="/billing" className="text-[10px] text-ds-primary-muted hover:underline">Manage</Link>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-ds-text">{billing?.sprintCreditsTotal ?? 0}</span>
              <span className="text-xs text-ds-text-dim">
                / {billing?.monthlyAllocation || billing?.freeSprintsTotal || 1} sprints
              </span>
            </div>
            {billing?.currentPeriodStart && (
              <div className="text-[10px] text-ds-text-faint mt-1">
                Resets in {daysUntilReset(billing.currentPeriodStart)} days
              </div>
            )}
            <div className="h-1.5 bg-ds-border rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-ds-primary rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    ((billing?.sprintCreditsTotal ?? 0) /
                      Math.max(billing?.monthlyAllocation || billing?.freeSprintsTotal || 1, 1)) *
                      100,
                    100
                  )}%`,
                }}
              />
            </div>
            {(!billing || billing.plan === "FREE") && (
              <Link
                href="/billing"
                className="flex items-center justify-center gap-1.5 w-full mt-3 py-2 rounded-lg border border-ds-primary/20 bg-ds-primary/8 text-ds-primary-muted text-[11px] font-semibold hover:bg-ds-primary/15 transition-colors"
              >
                <Zap className="w-3 h-3" /> Upgrade to Starter
              </Link>
            )}
          </div>

          {/* Overall score */}
          <div className="p-4 rounded-xl bg-ds-surface border border-ds-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-ds-text-faint uppercase tracking-wider">Overall score</span>
              <TrendingUp className="w-3.5 h-3.5 text-ds-text-ghost" />
            </div>
            <div className="text-[28px] font-bold text-ds-success mt-1 leading-none">--</div>
            <div className="text-[10px] text-ds-text-dim mt-1.5">Complete a sprint to see your score</div>
            <div className="h-1 bg-ds-border rounded-full overflow-hidden mt-2.5">
              <div className="h-full bg-ds-success/30 rounded-full" style={{ width: "0%" }} />
            </div>
          </div>

          {/* Strongest dimension */}
          <div className="p-4 rounded-xl bg-ds-surface border border-ds-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-ds-text-faint uppercase tracking-wider">Strongest</span>
              <TrendingUp className="w-3.5 h-3.5 text-ds-primary/40" />
            </div>
            <div className="text-[15px] font-bold text-ds-primary-muted mt-1.5">--</div>
            <div className="text-[10px] text-ds-text-dim mt-0.5">Avg -- / 100</div>
          </div>

          {/* Needs work */}
          <div className="p-4 rounded-xl bg-ds-surface border border-ds-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-ds-text-faint uppercase tracking-wider">Needs work</span>
              <TrendingDown className="w-3.5 h-3.5 text-ds-danger/40" />
            </div>
            <div className="text-[15px] font-bold text-ds-danger mt-1.5">--</div>
            <div className="text-[10px] text-ds-text-dim mt-0.5">Avg -- / 100</div>
          </div>

          {/* This week */}
          <div className="p-4 rounded-xl bg-ds-surface border border-ds-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-ds-text-faint uppercase tracking-wider">This week</span>
              <Calendar className="w-3.5 h-3.5 text-ds-text-ghost" />
            </div>
            <div className="flex gap-1">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => {
                const today = new Date().getDay();
                const adjustedToday = today === 0 ? 6 : today - 1;
                const isToday = i === adjustedToday;
                const isPast = i < adjustedToday;
                return (
                  <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                    <div
                      className={`w-full aspect-square rounded-md transition-colors ${
                        isToday
                          ? "bg-ds-primary shadow-[0_0_8px_rgba(108,92,231,0.3)]"
                          : isPast
                            ? "bg-ds-primary/20"
                            : "bg-ds-border"
                      }`}
                    />
                    <span className={`text-[9px] font-medium ${isToday ? "text-ds-primary-muted" : "text-ds-text-ghost"}`}>{day}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-ds-text-dim mt-2.5">0 active days this week</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: { label: string; href: string } }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[13px] font-semibold text-ds-text-secondary">{title}</h2>
      {action && (
        <Link href={action.href} className="flex items-center gap-1 text-[11px] text-ds-primary font-medium hover:underline">
          {action.label} <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ─── Track tab ────────────────────────────────────────

function TrackTab({ label, active, count, onClick }: { label: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
        active
          ? "bg-ds-primary/12 text-ds-primary-muted border border-ds-primary/25"
          : "text-ds-text-dim hover:text-ds-text-muted hover:bg-ds-elevated border border-transparent"
      }`}
    >
      {label}
      <span className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
        active ? "bg-ds-primary/20 text-ds-primary-muted" : "bg-ds-elevated text-ds-text-faint"
      }`}>
        {count}
      </span>
    </button>
  );
}

// ─── Simulation card with track icon ──────────────────

function SimCard({ sim }: { sim: SimListItem }) {
  const diff = DIFFICULTY_CONFIG[sim.difficulty];
  const track = STACK_TO_TRACK[sim.stack as keyof typeof STACK_TO_TRACK] || "BACKEND";
  const trackMeta = TRACK_ICONS[track] || TRACK_ICONS.BACKEND;
  const TrackIcon = trackMeta.icon;

  return (
    <Link
      href={`/dashboard/sim/${sim.id}`}
      className="group p-4 rounded-xl border border-ds-border bg-ds-surface hover:border-ds-border-strong hover:bg-ds-surface transition-all relative overflow-hidden"
    >
      {/* Track icon — top right, large, faded */}
      <div className="absolute -top-2 -right-2 opacity-[0.04] pointer-events-none">
        <TrackIcon className="w-24 h-24" strokeWidth={1} />
      </div>

      {/* Track icon — small, inline */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: trackMeta.bg }}>
          <TrackIcon className="w-4 h-4" style={{ color: trackMeta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: `${trackMeta.color}15`, color: trackMeta.color }}>
              {STACK_LABELS[sim.stack as keyof typeof STACK_LABELS] || sim.stack}
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-ds-elevated text-ds-text-faint">
              {sim.experienceType === "SPRINT" ? "Sprint" : "Session"}
            </span>
          </div>
        </div>
      </div>

      <h3 className="text-[14px] font-semibold text-ds-text mb-1.5 group-hover:text-ds-primary-muted transition-colors leading-snug">
        {sim.title}
      </h3>

      <p className="text-[11px] text-ds-text-dim leading-relaxed mb-3.5 line-clamp-2">
        {sim.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-ds-text-faint">
          <span className="font-semibold px-1.5 py-0.5 rounded" style={{ background: diff.bg, color: diff.color }}>
            {diff.label}
          </span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(sim.estimatedMinutes)}</span>
          <span className="flex items-center gap-1"><Ticket className="w-3 h-3" />{sim._count.tickets}</span>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-ds-text-ghost group-hover:text-ds-primary-muted group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

// ─── Helpers ──────────────────────────────────────────

function daysUntilReset(periodStart: string | null): number {
  if (!periodStart) return 30;
  const start = new Date(periodStart).getTime();
  const now = Date.now();
  const daysPassed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.max(30 - daysPassed, 0);
}