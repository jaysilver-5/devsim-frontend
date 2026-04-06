// app/(app)/assessments/[id]/page.tsx
"use client";

import { useState, useEffect, use } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { PERSONA_COLORS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/utils";
import type { Assessment, AssessmentCandidate } from "@/lib/types";
import Link from "next/link";
import { Copy, Check, ExternalLink, Users, Clock, Shield, ShieldOff } from "lucide-react";

export default function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { getApiToken } = useApiToken();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiToken();
        const data = (await api.assessments.get(id, token)) as Assessment;
        setAssessment(data);
      } catch (err) {
        console.error("Failed to load assessment:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, getApiToken]);

  const copyInviteLink = () => {
    if (!assessment) return;
    const link = `${window.location.origin}/invite/${assessment.inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleStatus = async () => {
    if (!assessment) return;
    setToggling(true);
    try {
      const token = await getApiToken();
      if (assessment.status === "ACTIVE") {
        await api.assessments.close(id, token);
        setAssessment({ ...assessment, status: "CLOSED" });
      } else {
        await api.assessments.reopen(id, token);
        setAssessment({ ...assessment, status: "ACTIVE" });
      }
    } catch (err) {
      console.error("Toggle failed:", err);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-sm text-ds-text-dim">Loading assessment...</div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-sm text-ds-danger">Assessment not found</div>
      </div>
    );
  }

  const candidates = assessment.candidates || [];
  const completed = candidates.filter((c) => c.status === "COMPLETED").length;
  const inProgress = candidates.filter((c) => c.status === "IN_PROGRESS").length;

  return (
    <div className="px-5 py-6 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-semibold text-ds-text tracking-tight">{assessment.title}</h1>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
              assessment.status === "ACTIVE" ? "bg-ds-success/12 text-ds-success" : "bg-ds-text-faint/12 text-ds-text-faint"
            }`}>
              {assessment.status}
            </span>
          </div>
          <p className="text-sm text-ds-text-dim">
            {assessment.simulation?.title || "Simulation"} · {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={toggleStatus}
          disabled={toggling}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
            assessment.status === "ACTIVE"
              ? "border border-ds-danger/30 bg-ds-danger/8 text-ds-danger hover:bg-ds-danger/15"
              : "border border-ds-success/30 bg-ds-success/8 text-ds-success hover:bg-ds-success/15"
          }`}
        >
          {assessment.status === "ACTIVE" ? <><ShieldOff className="w-3.5 h-3.5" /> Close</> : <><Shield className="w-3.5 h-3.5" /> Reopen</>}
        </button>
      </div>

      {/* Invite link */}
      <div className="p-4 rounded-lg bg-ds-surface border border-ds-border mb-6">
        <div className="text-[11px] text-ds-text-dim font-medium mb-2">Invite link</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 rounded-md bg-ds-base border border-ds-border-strong font-mono text-xs text-ds-primary-muted truncate">
            {window.location.origin}/invite/{assessment.inviteCode}
          </div>
          <button onClick={copyInviteLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-ds-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity shrink-0">
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-ds-text-faint">
          <span className="font-mono bg-ds-elevated px-2 py-0.5 rounded text-ds-primary-muted">{assessment.inviteCode}</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{completed}/{candidates.length} completed</span>
          {inProgress > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{inProgress} in progress</span>}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2.5 mb-6">
        <StatCard label="Total candidates" value={String(candidates.length)} color="text-ds-primary-muted" />
        <StatCard label="Completed" value={String(completed)} color="text-ds-success" />
        <StatCard label="In progress" value={String(inProgress)} color="text-ds-warning" />
        <StatCard label="Avg score" value={getAvgScore(candidates)} color="text-ds-primary-muted" />
      </div>

      {/* Candidate table */}
      <h2 className="text-[13px] font-semibold text-ds-text-secondary mb-3">Candidates</h2>

      {candidates.length === 0 ? (
        <div className="p-8 text-center rounded-lg border border-dashed border-ds-border bg-ds-surface">
          <p className="text-sm text-ds-text-dim">No candidates yet</p>
          <p className="text-xs text-ds-text-faint mt-1">Share the invite link to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {candidates.map((cand) => {
            const score = cand.session?.report?.overallScore;
            return (
              <div key={cand.id} className="flex items-center gap-3 p-3 rounded-lg bg-ds-surface border border-ds-border">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  score && score >= 80 ? "bg-ds-success/15 text-ds-success"
                    : score && score >= 60 ? "bg-ds-warning/15 text-ds-warning"
                    : score ? "bg-ds-danger/15 text-ds-danger"
                    : "bg-ds-primary/12 text-ds-primary-muted"
                }`}>
                  {cand.user?.displayName?.[0] || cand.user?.email?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-ds-text truncate">
                    {cand.user?.displayName || cand.user?.username || cand.user?.email || "Unknown"}
                  </div>
                  <div className="text-[10px] text-ds-text-faint">{cand.user?.email}</div>
                </div>
                <div className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  cand.status === "COMPLETED" ? "bg-ds-success/12 text-ds-success"
                    : cand.status === "IN_PROGRESS" ? "bg-ds-primary/12 text-ds-primary-muted"
                    : cand.status === "ABANDONED" ? "bg-ds-danger/12 text-ds-danger"
                    : "bg-ds-elevated text-ds-text-faint"
                }`}>
                  {cand.status.replace("_", " ")}
                </div>
                <div className="text-base font-bold w-10 text-center" style={{
                  color: score && score >= 80 ? "var(--color-ds-success)" : score && score >= 60 ? "var(--color-ds-warning)" : score ? "var(--color-ds-danger)" : "var(--color-ds-text-faint)"
                }}>
                  {score ?? "--"}
                </div>
                {cand.status === "COMPLETED" && cand.sessionId && (
                  <Link href={`/reports/${cand.sessionId}`} className="text-[11px] text-ds-primary hover:underline flex items-center gap-1">
                    Report <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
                {cand.status === "IN_PROGRESS" && (
                  <span className="text-[10px] text-ds-text-faint flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-ds-success animate-pulse" /> Live
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-3.5 rounded-lg bg-ds-surface border border-ds-border">
      <div className="text-[10px] text-ds-text-faint uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function getAvgScore(candidates: AssessmentCandidate[]): string {
  const scores = candidates
    .filter((c) => c.session?.report?.overallScore != null)
    .map((c) => c.session!.report!.overallScore);
  if (scores.length === 0) return "--";
  return String(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
}
