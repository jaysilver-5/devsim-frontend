// app/(app)/classroom/students/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import Link from "next/link";

type AssessmentWithStudents = {
  id: string;
  title: string;
  candidates?: {
    id: string;
    status: string;
    user: { id: string; email: string; username: string; displayName: string | null };
  }[];
};

export default function StudentsPage() {
  const { getApiToken } = useApiToken();
  const [assessments, setAssessments] = useState<AssessmentWithStudents[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiToken();
        const data = (await api.assessments.list(token)) as AssessmentWithStudents[];
        setAssessments(data);
      } catch (err) {
        console.error("Failed to load:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getApiToken]);

  // Deduplicate students across assignments
  const studentMap = new Map<string, { user: { id: string; email: string; username: string; displayName: string | null }; assignments: string[]; statuses: string[] }>();
  assessments.forEach((a) => {
    (a.candidates || []).forEach((c) => {
      const existing = studentMap.get(c.user.id);
      if (existing) {
        existing.assignments.push(a.title);
        existing.statuses.push(c.status);
      } else {
        studentMap.set(c.user.id, { user: c.user, assignments: [a.title], statuses: [c.status] });
      }
    });
  });
  const students = Array.from(studentMap.values());

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="text-sm text-ds-text-dim">Loading students...</div></div>;
  }

  return (
    <div className="px-5 py-6 max-w-300 mx-auto">
      <h1 className="text-lg font-semibold text-ds-text tracking-tight mb-1">Students</h1>
      <p className="text-sm text-ds-text-dim mb-5">{students.length} student{students.length !== 1 ? "s" : ""} enrolled</p>

      {students.length === 0 ? (
        <div className="p-10 text-center rounded-lg border border-dashed border-ds-border bg-ds-surface">
          <div className="text-sm text-ds-text-dim mb-1">No students yet</div>
          <p className="text-xs text-ds-text-faint">Students will appear here when they join your assignments</p>
        </div>
      ) : (
        <div className="rounded-lg border border-ds-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-ds-surface">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Student</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Assignments</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider">Completed</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const completedCount = s.statuses.filter((st) => st === "COMPLETED").length;
                return (
                  <tr key={s.user.id} className="border-t border-ds-border/50 hover:bg-ds-surface/50">
                    <td className="px-3 py-2.5">
                      <div className="text-xs font-medium text-ds-text">{s.user.displayName || s.user.username}</div>
                      <div className="text-[10px] text-ds-text-faint">{s.user.email}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-ds-text-dim">{s.assignments.length}</td>
                    <td className="px-3 py-2.5 text-xs text-ds-success">{completedCount}/{s.assignments.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}