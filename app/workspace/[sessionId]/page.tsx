"use client";

import { use } from "react";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";

export default function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  return <WorkspaceShell sessionId={sessionId} />;
}