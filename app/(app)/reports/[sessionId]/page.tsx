// app/(app)/reports/[sessionId]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { EvaluationReport } from "@/lib/types";
import Link from "next/link";

export default function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const { getApiToken } = useApiToken();
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiToken();
        // GET /evaluate/:sessionId/report
        const data = (await api.evaluation.getReport(sessionId, token)) as EvaluationReport;
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId, getApiToken]);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="text-sm text-ds-text-dim">Loading report...</div></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="text-sm text-ds-danger">{error}</div>
        <Link href="/dashboard" className="text-xs text-ds-primary">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 max-w-[900px] mx-auto">
      <Link href="/dashboard" className="text-xs text-ds-text-dim hover:text-ds-text-muted mb-4 inline-block">&larr; Back to dashboard</Link>

      <h1 className="text-lg font-semibold text-ds-text tracking-tight mb-1">Evaluation report</h1>
      <p className="text-sm text-ds-text-dim mb-6">Session: {sessionId}</p>

      {report && (
        <>
          {/* Overall score */}
          <div className="flex items-center gap-6 p-5 rounded-lg bg-ds-surface border border-ds-border mb-6">
            <div className="w-20 h-20 rounded-full border-4 border-ds-primary flex items-center justify-center">
              <span className="text-2xl font-bold text-ds-text">{Math.round(report.overallScore)}</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-ds-text mb-1">Overall score</div>
              <div className="text-xs text-ds-text-dim leading-relaxed">{report.aiSummary || "Report summary will appear here."}</div>
            </div>
          </div>

          {/* Dimension scores */}
          <h2 className="text-[13px] font-semibold text-ds-text-secondary mb-3">Dimensions</h2>
          <div className="grid grid-cols-2 gap-2.5 mb-6">
            <DimensionCard label="Code quality" scores={report.codeScores} color="var(--color-ds-primary)" />
            <DimensionCard label="Communication" scores={report.communicationScores} color="var(--color-ds-info)" />
            <DimensionCard label="Standup" scores={report.standupScores} color="var(--color-ds-warning)" />
            <DimensionCard label="Collaboration" scores={report.collaborationScores} color="var(--color-ds-success)" />
          </div>

          {/* Integrity */}
          <div className="p-3.5 rounded-lg bg-ds-surface border border-ds-border mb-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ds-text-secondary">Integrity score</span>
              <span className={`text-lg font-bold ${
                report.integrityScore >= 80 ? "text-ds-success" : report.integrityScore >= 50 ? "text-ds-warning" : "text-ds-danger"
              }`}>
                {Math.round(report.integrityScore)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DimensionCard({ label, scores, color }: { label: string; scores: Record<string, number>; color: string }) {
  const entries = Object.entries(scores);
  const avg = entries.length > 0 ? Math.round(entries.reduce((sum, [, v]) => sum + (v || 0), 0) / entries.length) : 0;

  return (
    <div className="p-3.5 rounded-lg bg-ds-surface border border-ds-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-ds-text-secondary">{label}</span>
        <span className="text-lg font-bold" style={{ color }}>{avg || "--"}</span>
      </div>
      {entries.length > 0 && (
        <div className="space-y-1.5">
          {entries.map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-ds-text-faint w-24 truncate">{key.replace(/([A-Z])/g, " $1").trim()}</span>
              <div className="flex-1 h-1.5 bg-ds-border rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${val}%`, background: color }} />
              </div>
              <span className="text-[10px] text-ds-text-dim w-6 text-right">{Math.round(val)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}