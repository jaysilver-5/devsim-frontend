// app/(app)/classroom/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { Assessment, BillingInfo } from "@/lib/types";
import Link from "next/link";

export default function ClassroomDashboard() {
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
        console.error("Failed to load classroom:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getApiToken]);

  const totalStudents = assessments.reduce((sum, a) => sum + (a._count?.candidates || 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="text-sm text-ds-text-dim">Loading classroom...</div></div>;
  }

  return (
    <div className="px-5 py-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold text-ds-text tracking-tight">Classroom</h1>
        <div className="flex gap-2">
          <button className="px-3.5 py-2 rounded-md border border-ds-border-strong bg-ds-surface text-ds-text-dim text-[11px] font-medium hover:bg-ds-elevated transition-colors">Export grades</button>
          <button className="px-4 py-2 rounded-md bg-ds-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity">+ New assignment</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5 mb-6">
        <StatCard label="Students enrolled" value={totalStudents} color="text-[#E17055]" />
        <StatCard label="Assignments" value={assessments.length} color="text-ds-primary-muted" />
        <StatCard label="Student credits" value={billing?.assessorCredits ?? 0} color="text-ds-success" />
        <StatCard label="Class avg" value="--" color="text-ds-warning" />
      </div>

      <h2 className="text-[13px] font-semibold text-ds-text-secondary mb-3">Assignments</h2>

      {assessments.length === 0 ? (
        <div className="p-8 text-center rounded-lg border border-dashed border-ds-border bg-ds-surface">
          <p className="text-sm text-ds-text-dim mb-3">No assignments yet. Create one from an available simulation.</p>
          <button className="px-4 py-2 rounded-md bg-ds-primary text-white text-xs font-semibold">Create your first assignment</button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          {assessments.map((a) => {
            const candidateCount = a._count?.candidates || 0;
            const completed = a.candidates?.filter((c) => c.status === "COMPLETED").length || 0;
            const progress = candidateCount > 0 ? Math.round((completed / candidateCount) * 100) : 0;
            return (
              <Link key={a.id} href={`/classroom/${a.id}`} className="p-3.5 rounded-lg border border-ds-border bg-ds-surface hover:border-ds-border-strong transition-colors">
                <div className="text-[10px] text-ds-text-dim mb-1">{a.simulation?.title || "Simulation"}</div>
                <div className="text-[13px] font-semibold text-ds-text mb-2">{a.title}</div>
                <div className="flex items-center justify-between text-[11px] text-ds-text-dim mb-2">
                  <span>{completed}/{candidateCount} submitted</span>
                </div>
                <div className="h-1 bg-ds-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${progress}%`,
                    background: progress === 100 ? "var(--color-ds-success)" : progress > 0 ? "var(--color-ds-warning)" : "var(--color-ds-border)",
                  }} />
                </div>
              </Link>
            );
          })}
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