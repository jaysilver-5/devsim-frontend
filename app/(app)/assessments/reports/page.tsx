// app/(app)/assessments/reports/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import Link from "next/link";

type AssessmentSummary = {
  id: string;
  title: string;
  status: string;
  simulation?: { title: string };
  candidates?: { id: string; status: string; session: { id: string; completedAt: string | null } | null }[];
  _count?: { candidates: number };
};

export default function AssessmentReportsPage() {
  const { getApiToken } = useApiToken();
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiToken();
        const data = (await api.assessments.list(token)) as AssessmentSummary[];
        setAssessments(data);
      } catch (err) {
        console.error("Failed to load:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getApiToken]);

  // Only show assessments with completed candidates
  const withResults = assessments.filter((a) =>
    a.candidates?.some((c) => c.status === "COMPLETED") || false
  );

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="text-sm text-ds-text-dim">Loading reports...</div></div>;
  }

  return (
    <div className="px-5 py-6 max-w-300 mx-auto">
      <h1 className="text-lg font-semibold text-ds-text tracking-tight mb-1">Reports</h1>
      <p className="text-sm text-ds-text-dim mb-5">Completed assessment results</p>

      {withResults.length === 0 ? (
        <div className="p-10 text-center rounded-lg border border-dashed border-ds-border bg-ds-surface">
          <div className="text-sm text-ds-text-dim mb-1">No completed assessments yet</div>
          <p className="text-xs text-ds-text-faint">Reports will appear here once candidates complete their assessments</p>
        </div>
      ) : (
        <div className="space-y-2">
          {withResults.map((a) => {
            const completed = a.candidates?.filter((c) => c.status === "COMPLETED") || [];
            return (
              <Link key={a.id} href={`/assessments/${a.id}`}
                className="flex items-center justify-between p-3.5 rounded-lg bg-ds-surface border border-ds-border hover:border-ds-border-strong transition-colors">
                <div>
                  <div className="text-xs font-medium text-ds-text">{a.title}</div>
                  <div className="text-[10px] text-ds-text-faint mt-0.5">{a.simulation?.title} — {completed.length} completed</div>
                </div>
                <span className="text-[11px] text-ds-primary">View details</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}