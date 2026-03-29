// app/(app)/assessments/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { Assessment, BillingInfo } from "@/lib/types";
import Link from "next/link";

export default function AssessmentsDashboard() {
  const { getApiToken } = useApiToken();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiToken();
        const [assess, bill] = await Promise.all([
          api.assessments.list(token) as Promise<Assessment[]>,
          api.billing.getInfo(token) as Promise<BillingInfo>,
        ]);
        setAssessments(assess);
        setBilling(bill);
      } catch (err) {
        console.error("Failed to load assessments:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getApiToken]);

  const active = assessments.filter((a) => a.status === "ACTIVE");
  const totalCandidates = assessments.reduce((sum, a) => sum + (a._count?.candidates || 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="text-sm text-ds-text-dim">Loading assessments...</div></div>;
  }

  return (
    <div className="px-5 py-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold text-ds-text tracking-tight">Assessments</h1>
        <button className="px-4 py-2 rounded-md bg-ds-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity">+ New assessment</button>
      </div>

      <div className="grid grid-cols-4 gap-2.5 mb-6">
        <StatCard label="Active assessments" value={active.length} color="text-ds-primary" />
        <StatCard label="Candidates invited" value={totalCandidates} color="text-ds-primary-muted" />
        <StatCard label="Credits remaining" value={billing?.assessorCredits ?? 0} color="text-ds-success" />
        <StatCard label="Avg score" value="--" color="text-ds-warning" />
      </div>

      <h2 className="text-[13px] font-semibold text-ds-text-secondary mb-3">Active assessments</h2>

      {assessments.length === 0 ? (
        <div className="p-8 text-center rounded-lg border border-dashed border-ds-border bg-ds-surface">
          <p className="text-sm text-ds-text-dim mb-3">No assessments yet. Create one to start evaluating candidates.</p>
          <button className="px-4 py-2 rounded-md bg-ds-primary text-white text-xs font-semibold">Create your first assessment</button>
        </div>
      ) : (
        <div className="rounded-lg border border-ds-border overflow-hidden mb-6">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-ds-surface">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Assessment</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Simulation</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Candidates</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Invite code</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Status</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className="border-t border-ds-border/50 hover:bg-ds-surface/50 transition-colors">
                  <td className="px-3 py-2.5"><span className="font-medium text-ds-text">{a.title}</span></td>
                  <td className="px-3 py-2.5 text-ds-text-dim">{a.simulation?.title || "--"}</td>
                  <td className="px-3 py-2.5 text-ds-text-dim">{a._count?.candidates || 0} invited</td>
                  <td className="px-3 py-2.5"><code className="text-[11px] bg-ds-elevated px-2 py-0.5 rounded text-ds-primary-muted font-mono">{a.inviteCode}</code></td>
                  <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                  <td className="px-3 py-2.5"><Link href={`/assessments/${a.id}`} className="text-[11px] text-ds-primary hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="p-3.5 rounded-lg bg-ds-surface border border-ds-border">
      <div className="text-[10px] text-ds-text-faint uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-ds-success/12 text-ds-success",
    CLOSED: "bg-ds-text-faint/12 text-ds-text-dim",
    ARCHIVED: "bg-ds-text-faint/12 text-ds-text-ghost",
  };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${styles[status] || styles.ACTIVE}`}>{status}</span>;
}