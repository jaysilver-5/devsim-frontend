// app/(app)/dashboard/simulations/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { STACK_LABELS, DIFFICULTY_CONFIG, STACK_TO_TRACK, TRACK_INFO } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";
import type { Track } from "@/lib/types";
import Link from "next/link";

type SimListItem = {
  id: string;
  title: string;
  description: string;
  stack: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  experienceType: "SESSION" | "SPRINT";
  estimatedMinutes: number;
  _count: { tickets: number };
};

export default function SimulationsPage() {
  const { getApiToken } = useApiToken();
  const [sims, setSims] = useState<SimListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTrack, setActiveTrack] = useState<"ALL" | Track>("ALL");

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiToken().catch(() => null);
        const data = (await api.simulations.list(undefined, token || undefined)) as SimListItem[];
        setSims(data);
      } catch (err) {
        console.error("Failed to load sims:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getApiToken]);

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
    return sims.filter((s) => STACK_TO_TRACK[s.stack as keyof typeof STACK_TO_TRACK] === activeTrack);
  }, [sims, activeTrack]);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="text-sm text-ds-text-dim">Loading simulations...</div></div>;
  }

  return (
    <div className="px-5 py-6 max-w-300 mx-auto">
      <h1 className="text-lg font-semibold text-ds-text tracking-tight mb-1">Simulations</h1>
      <p className="text-sm text-ds-text-dim mb-5">{sims.length} available simulation{sims.length !== 1 ? "s" : ""}</p>

      <div className="flex items-center gap-1 mb-5">
        <TrackTab label="All" active={activeTrack === "ALL"} count={sims.length} onClick={() => setActiveTrack("ALL")} />
        {availableTracks.map((track) => (
          <TrackTab key={track} label={TRACK_INFO[track]?.name || track} active={activeTrack === track}
            count={sims.filter((s) => STACK_TO_TRACK[s.stack as keyof typeof STACK_TO_TRACK] === track).length}
            onClick={() => setActiveTrack(track)} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {filtered.map((sim) => {
          const diff = DIFFICULTY_CONFIG[sim.difficulty];
          return (
            <Link key={sim.id} href={`/dashboard/sim/${sim.id}`}
              className="p-4 rounded-lg border border-ds-border bg-ds-surface hover:border-ds-border-strong transition-all group">
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: diff.bg, color: diff.color }}>
                  {STACK_LABELS[sim.stack as keyof typeof STACK_LABELS] || sim.stack}
                </span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-ds-elevated text-ds-text-faint">
                  {sim.experienceType === "SPRINT" ? "Sprint" : "Session"}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-ds-text mb-1.5 group-hover:text-ds-primary-muted transition-colors">{sim.title}</h3>
              <p className="text-[11px] text-ds-text-dim leading-relaxed mb-3 line-clamp-2">{sim.description}</p>
              <div className="flex items-center gap-2.5 text-[10px] text-ds-text-faint">
                <span className="font-semibold px-1.5 py-0.5 rounded" style={{ background: diff.bg, color: diff.color }}>{diff.label}</span>
                <span>{formatDuration(sim.estimatedMinutes)}</span>
                <span className="text-ds-border">|</span>
                <span>{sim._count.tickets} tickets</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TrackTab({ label, active, count, onClick }: { label: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
        active ? "bg-ds-primary/12 text-ds-primary-muted border border-ds-primary/25" : "text-ds-text-dim hover:text-ds-text-muted hover:bg-ds-elevated border border-transparent"
      }`}>
      {label}
      <span className={`text-[9px] font-semibold px-1 rounded ${active ? "bg-ds-primary/20 text-ds-primary-muted" : "bg-ds-elevated text-ds-text-faint"}`}>{count}</span>
    </button>
  );
}