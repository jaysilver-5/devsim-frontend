// app/(app)/classroom/[id]/page.tsx
"use client";

import { useState, useEffect, use } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { DIFFICULTY_CONFIG } from "@/lib/constants";
import type { Assessment, AssessmentCandidate } from "@/lib/types";
import Link from "next/link";
import { Copy, Check, ExternalLink, Users, ArrowLeft } from "lucide-react";

export default function ClassroomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { getApiToken } = useApiToken();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiToken();
        const data = (await api.assessments.get(id, token)) as Assessment;
        setAssessment(data);
      } catch (err) {
        console.error("Failed to load assignment:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, getApiToken]);

  const copyLink = () => {
    if (!assessment) return;
    navigator.clipboard.writeText(`${window.location.origin}/invite/${assessment.inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="text-sm text-ds-text-dim">Loading assignment...</div></div>;
  if (!assessment) return <div className="flex items-center justify-center h-[60vh]"><div className="text-sm text-ds-danger">Assignment not found</div></div>;

  const candidates = assessment.candidates || [];
  const completed = candidates.filter((c) => c.status === "COMPLETED");
  const inProgress = candidates.filter((c) => c.status === "IN_PROGRESS");

  return (
    <div className="px-5 py-6 max-w-[900px] mx-auto">
      <Link href="/classroom" className="inline-flex items-center gap-1 text-xs text-ds-text-dim hover:text-ds-text-muted mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to classroom
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-ds-text tracking-tight">{assessment.title}</h1>
          <p className="text-sm text-ds-text-dim mt-0.5">{assessment.simulation?.title} · {candidates.length} students</p>
        </div>
        <div className="flex gap-2">
          <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-ds-border-strong bg-ds-surface text-xs font-medium text-ds-text-secondary hover:bg-ds-elevated transition-colors">
            {copied ? <><Check className="w-3.5 h-3.5 text-ds-success" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy invite link</>}
          </button>
        </div>
      </div>

      {/* Progress stats */}
      <div className="grid grid-cols-4 gap-2.5 mb-6">
        <div className="p-3.5 rounded-lg bg-ds-surface border border-ds-border">
          <div className="text-[10px] text-ds-text-faint uppercase tracking-wider mb-0.5">Students</div>
          <div className="text-xl font-bold text-[#E17055]">{candidates.length}</div>
        </div>
        <div className="p-3.5 rounded-lg bg-ds-surface border border-ds-border">
          <div className="text-[10px] text-ds-text-faint uppercase tracking-wider mb-0.5">Submitted</div>
          <div className="text-xl font-bold text-ds-success">{completed.length}</div>
        </div>
        <div className="p-3.5 rounded-lg bg-ds-surface border border-ds-border">
          <div className="text-[10px] text-ds-text-faint uppercase tracking-wider mb-0.5">Completion</div>
          <div className="text-xl font-bold text-ds-primary-muted">
            {candidates.length > 0 ? Math.round((completed.length / candidates.length) * 100) : 0}%
          </div>
        </div>
        <div className="p-3.5 rounded-lg bg-ds-surface border border-ds-border">
          <div className="text-[10px] text-ds-text-faint uppercase tracking-wider mb-0.5">Class avg</div>
          <div className="text-xl font-bold text-ds-warning">
            {completed.length > 0
              ? Math.round(completed.reduce((sum, c) => sum + (c.session?.report?.overallScore || 0), 0) / completed.length)
              : "--"}
          </div>
        </div>
      </div>

      {/* Student list */}
      <h2 className="text-[13px] font-semibold text-ds-text-secondary mb-3">Student progress</h2>

      {candidates.length === 0 ? (
        <div className="p-8 text-center rounded-lg border border-dashed border-ds-border bg-ds-surface">
          <Users className="w-8 h-8 text-ds-text-faint mx-auto mb-3" />
          <p className="text-sm text-ds-text-dim">No students have joined yet</p>
          <p className="text-xs text-ds-text-faint mt-1">Share the invite link with your class</p>
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-ds-border">
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Student</th>
              <th className="text-left py-2 px-3 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Status</th>
              <th className="text-center py-2 px-3 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Score</th>
              <th className="text-right py-2 px-3 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((cand) => {
              const score = cand.session?.report?.overallScore;
              return (
                <tr key={cand.id} className="border-b border-ds-border/50 hover:bg-ds-surface/50 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="text-xs font-medium text-ds-text">{cand.user?.displayName || cand.user?.username || "Unknown"}</div>
                    <div className="text-[10px] text-ds-text-faint">{cand.user?.email}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      cand.status === "COMPLETED" ? "bg-ds-success/12 text-ds-success"
                        : cand.status === "IN_PROGRESS" ? "bg-ds-primary/12 text-ds-primary-muted"
                        : cand.status === "ABANDONED" ? "bg-ds-danger/12 text-ds-danger"
                        : "bg-ds-elevated text-ds-text-faint"
                    }`}>
                      {cand.status === "IN_PROGRESS" ? "Working" : cand.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-sm font-bold" style={{
                      color: score && score >= 80 ? "var(--color-ds-success)" : score && score >= 60 ? "var(--color-ds-warning)" : score ? "var(--color-ds-danger)" : "var(--color-ds-text-faint)"
                    }}>{score ?? "--"}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {cand.status === "COMPLETED" && cand.sessionId && (
                      <Link href={`/reports/${cand.sessionId}`} className="text-[11px] text-ds-primary hover:underline">Report</Link>
                    )}
                    {cand.status === "IN_PROGRESS" && (
                      <span className="text-[10px] text-ds-text-faint flex items-center justify-end gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-ds-success animate-pulse" /> Live
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
