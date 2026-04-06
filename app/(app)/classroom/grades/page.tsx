// app/(app)/classroom/grades/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import Link from "next/link";

type AssessmentGrades = {
  id: string;
  title: string;
  simulation?: { title: string };
  candidates?: {
    id: string;
    status: string;
    user: { displayName: string | null; username: string; email: string };
    session: { id: string; completedAt: string | null } | null;
    scores?: Record<string, number> | null;
    integrityScore?: number | null;
  }[];
};

export default function GradesPage() {
  const { getApiToken } = useApiToken();
  const [assessments, setAssessments] = useState<AssessmentGrades[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiToken();
        const data = (await api.assessments.list(token)) as AssessmentGrades[];
        setAssessments(data);
      } catch (err) {
        console.error("Failed to load:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getApiToken]);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="text-sm text-ds-text-dim">Loading grades...</div></div>;
  }

  return (
    <div className="px-5 py-6 max-w-300 mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-ds-text tracking-tight mb-1">Grades</h1>
          <p className="text-sm text-ds-text-dim">Student scores across all assignments</p>
        </div>
        <button className="px-3.5 py-2 rounded-md border border-ds-border-strong bg-ds-surface text-ds-text-dim text-[11px] font-medium hover:bg-ds-elevated transition-colors">
          Export all grades (CSV)
        </button>
      </div>

      {assessments.length === 0 ? (
        <div className="p-10 text-center rounded-lg border border-dashed border-ds-border bg-ds-surface">
          <div className="text-sm text-ds-text-dim mb-1">No grades yet</div>
          <p className="text-xs text-ds-text-faint">Grades appear after students complete their assignments</p>
        </div>
      ) : (
        <div className="space-y-6">
          {assessments.map((a) => {
            const graded = (a.candidates || []).filter((c) => c.status === "COMPLETED" && c.scores);
            if (graded.length === 0) return null;

            return (
              <div key={a.id}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-[13px] font-semibold text-ds-text-secondary">{a.title}</h2>
                    <div className="text-[10px] text-ds-text-faint">{a.simulation?.title} — {graded.length} graded</div>
                  </div>
                  <Link href={`/classroom/${a.id}`} className="text-[11px] text-ds-primary hover:underline">View assignment</Link>
                </div>

                <div className="rounded-lg border border-ds-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-ds-surface">
                        <th className="text-left px-3 py-2 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Student</th>
                        <th className="text-left px-3 py-2 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Score</th>
                        <th className="text-left px-3 py-2 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Integrity</th>
                        <th className="w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      {graded.map((c) => {
                        const overall = (c.scores as Record<string, number>)?.overall;
                        return (
                          <tr key={c.id} className="border-t border-ds-border/50">
                            <td className="px-3 py-2">
                              <div className="text-xs font-medium text-ds-text">{c.user.displayName || c.user.username}</div>
                              <div className="text-[10px] text-ds-text-faint">{c.user.email}</div>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-sm font-bold ${(overall ?? 0) >= 70 ? "text-ds-success" : (overall ?? 0) >= 50 ? "text-ds-warning" : "text-ds-danger"}`}>
                                {overall != null ? Math.round(overall) : "--"}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {c.integrityScore != null ? (
                                <span className={`text-xs font-semibold ${c.integrityScore >= 80 ? "text-ds-success" : "text-ds-danger"}`}>
                                  {Math.round(c.integrityScore)}
                                </span>
                              ) : "--"}
                            </td>
                            <td className="px-3 py-2">
                              {c.session?.id && (
                                <Link href={`/reports/${c.session.id}`} className="text-[11px] text-ds-primary hover:underline">Report</Link>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}