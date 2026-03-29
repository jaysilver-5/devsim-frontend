// app/(app)/classroom/assignments/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { STACK_LABELS } from "@/lib/constants";
import Link from "next/link";

type Assignment = {
  id: string;
  title: string;
  status: string;
  inviteCode: string;
  simulation?: { title: string; stack: string; estimatedMinutes: number };
  _count?: { candidates: number };
};

export default function AssignmentsPage() {
  const { getApiToken } = useApiToken();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiToken();
        const data = (await api.assessments.list(token)) as Assignment[];
        setAssignments(data);
      } catch (err) {
        console.error("Failed to load:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getApiToken]);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="text-sm text-ds-text-dim">Loading assignments...</div></div>;
  }

  return (
    <div className="px-5 py-6 max-w-300 mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-ds-text tracking-tight mb-1">Assignments</h1>
          <p className="text-sm text-ds-text-dim">{assignments.length} assignment{assignments.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="px-4 py-2 rounded-md bg-ds-primary text-white text-xs font-semibold hover:opacity-90">+ New assignment</button>
      </div>

      {assignments.length === 0 ? (
        <div className="p-10 text-center rounded-lg border border-dashed border-ds-border bg-ds-surface">
          <div className="text-sm text-ds-text-dim mb-1">No assignments yet</div>
          <p className="text-xs text-ds-text-faint">Create an assignment from an available simulation</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {assignments.map((a) => (
            <Link key={a.id} href={`/classroom/${a.id}`}
              className="p-4 rounded-lg border border-ds-border bg-ds-surface hover:border-ds-border-strong transition-colors">
              <div className="text-[10px] text-ds-text-faint mb-1">
                {a.simulation?.title} — {STACK_LABELS[a.simulation?.stack as keyof typeof STACK_LABELS] || a.simulation?.stack}
              </div>
              <div className="text-sm font-semibold text-ds-text mb-2">{a.title}</div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-ds-text-dim">{a._count?.candidates || 0} students</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${a.status === "ACTIVE" ? "bg-ds-success/10 text-ds-success" : "bg-ds-elevated text-ds-text-dim"}`}>
                  {a.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}