// app/(app)/assessments/candidates/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import Link from "next/link";

type AssessmentWithCandidates = {
  id: string;
  title: string;
  inviteCode: string;
  status: string;
  simulation?: { title: string; stack: string };
  candidates?: {
    id: string;
    status: string;
    user: { id: string; email: string; username: string; displayName: string | null };
    session: { id: string; status: string; currentTicketSeq: number; completedAt: string | null } | null;
  }[];
};

export default function CandidatesPage() {
  const { getApiToken } = useApiToken();
  const [assessments, setAssessments] = useState<AssessmentWithCandidates[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiToken();
        const data = (await api.assessments.list(token)) as AssessmentWithCandidates[];
        setAssessments(data);
      } catch (err) {
        console.error("Failed to load:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getApiToken]);

  // Flatten all candidates across assessments
  const allCandidates = assessments.flatMap((a) =>
    (a.candidates || []).map((c) => ({ ...c, assessmentTitle: a.title, assessmentId: a.id }))
  );

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="text-sm text-ds-text-dim">Loading candidates...</div></div>;
  }

  return (
    <div className="px-5 py-6 max-w-300 mx-auto">
      <h1 className="text-lg font-semibold text-ds-text tracking-tight mb-1">All candidates</h1>
      <p className="text-sm text-ds-text-dim mb-5">{allCandidates.length} candidate{allCandidates.length !== 1 ? "s" : ""} across {assessments.length} assessment{assessments.length !== 1 ? "s" : ""}</p>

      {allCandidates.length === 0 ? (
        <div className="p-10 text-center rounded-lg border border-dashed border-ds-border bg-ds-surface">
          <div className="text-sm text-ds-text-dim mb-1">No candidates yet</div>
          <p className="text-xs text-ds-text-faint">Create an assessment and share the invite link</p>
        </div>
      ) : (
        <div className="rounded-lg border border-ds-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-ds-surface">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Candidate</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Assessment</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Status</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Progress</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {allCandidates.map((c) => (
                <tr key={c.id} className="border-t border-ds-border/50 hover:bg-ds-surface/50">
                  <td className="px-3 py-2.5">
                    <div className="text-xs font-medium text-ds-text">{c.user.displayName || c.user.username}</div>
                    <div className="text-[10px] text-ds-text-faint">{c.user.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/assessments/${c.assessmentId}`} className="text-xs text-ds-primary-muted hover:underline">{c.assessmentTitle}</Link>
                  </td>
                  <td className="px-3 py-2.5"><CandidateStatus status={c.status} /></td>
                  <td className="px-3 py-2.5">
                    {c.session ? <span className="text-[10px] text-ds-text-faint">Ticket {c.session.currentTicketSeq}/5</span> : <span className="text-[10px] text-ds-text-ghost">--</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.session?.id && c.status === "COMPLETED" && (
                      <Link href={`/reports/${c.session.id}`} className="text-[11px] text-ds-primary hover:underline">Report</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CandidateStatus({ status }: { status: string }) {
  const s: Record<string, string> = {
    INVITED: "bg-ds-elevated text-ds-text-dim", IN_PROGRESS: "bg-ds-primary/10 text-ds-primary-muted",
    COMPLETED: "bg-ds-success/10 text-ds-success", ABANDONED: "bg-ds-danger/10 text-ds-danger",
  };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${s[status] || s.INVITED}`}>{status}</span>;
}