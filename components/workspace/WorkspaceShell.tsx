// components/workspace/WorkspaceShell.tsx
"use client";

import dynamic from "next/dynamic";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Explorer from "./explorer/Explorer";
import Editor from "./editor/Editor";
import RightSidebar from "./right/RightSidebar";
import Topbar from "./Topbar";
import Statusbar from "./Statusbar";
import { StandupCall } from "@/components/standup/StandupCall";

import useWorkspaceSession from "@/hooks/workspace/useWorkspaceSession";
import useWorkspaceFiles from "@/hooks/workspace/useWorkspaceFiles";
import { useEffect, useState, useCallback, useRef } from "react";

const Terminal = dynamic(() => import("./terminal/Terminal"), { ssr: false });

// ─── Loading screen ─────────────────────────────────────

const BOOT_STEPS = [
  "Connecting to workspace...",
  "Provisioning container...",
  "Loading project files...",
  "Starting dev server...",
  "Syncing team board...",
  "Almost ready...",
];

function WorkspaceLoading() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s < BOOT_STEPS.length - 1 ? s + 1 : s));
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-screen flex items-center justify-center bg-ds-base">
      <div className="text-center w-full max-w-[280px]">
        <div className="text-lg font-bold text-ds-primary-muted mb-6 tracking-tight">
          devsim
        </div>
        <div className="h-1 rounded-full bg-ds-border overflow-hidden mb-4">
          <div
            className="h-full rounded-full bg-ds-primary transition-all duration-1000 ease-out"
            style={{ width: `${((step + 1) / BOOT_STEPS.length) * 100}%` }}
          />
        </div>
        <div className="space-y-1.5 text-left">
          {BOOT_STEPS.slice(0, step + 1).map((label, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs transition-all duration-300 ${
                i === step ? "text-ds-text-secondary" : "text-ds-text-faint"
              }`}
            >
              {i < step ? (
                <span className="text-ds-success text-[10px]">✓</span>
              ) : (
                <span className="w-3 h-3 rounded-full border border-ds-primary/40 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-ds-primary animate-pulse" />
                </span>
              )}
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main workspace ─────────────────────────────────────

export default function WorkspaceShell({ sessionId }: { sessionId: string }) {
  const session = useWorkspaceSession(sessionId);
  const files = useWorkspaceFiles(sessionId, session.token, session.hasContainer);

  const [showStandup, setShowStandup] = useState(false);
  const [standupNumber, setStandupNumber] = useState(1);

  // Track which standup numbers have been completed/dismissed
  // to prevent the standup from re-triggering on session refresh
  const completedStandupsRef = useRef<Set<number>>(new Set());
  const standupTriggeredRef = useRef(false);

  const isStandupPending = session.session?.status === "STANDUP_PENDING";

  // Determine the right standup number from the session data
  useEffect(() => {
    if (!session.session) return;

    const standups = (session.session as any)?.standups;
    if (Array.isArray(standups)) {
      const pending = standups.find((s: any) => s.status === "PENDING");
      if (pending) {
        setStandupNumber(pending.standupNumber);
      }
    }
  }, [session.session]);

  // Trigger standup when status is STANDUP_PENDING
  // But only if we haven't already completed/dismissed this one
  useEffect(() => {
    if (
      isStandupPending &&
      !showStandup &&
      !standupTriggeredRef.current &&
      !completedStandupsRef.current.has(standupNumber)
    ) {
      standupTriggeredRef.current = true;
      setShowStandup(true);
    }

    if (!isStandupPending) {
      standupTriggeredRef.current = false;
    }
  }, [isStandupPending, showStandup, standupNumber]);

  const handleStandupComplete = useCallback(() => {
    completedStandupsRef.current.add(standupNumber);
    standupTriggeredRef.current = false;
    setShowStandup(false);

    // Small delay before refreshing so the session status update propagates
    setTimeout(() => {
      session.refreshSession();
    }, 500);
  }, [session, standupNumber]);

  const handleStandupEnd = useCallback(() => {
    completedStandupsRef.current.add(standupNumber);
    standupTriggeredRef.current = false;
    setShowStandup(false);
    session.refreshSession();
  }, [session, standupNumber]);

  if (session.loading || !files.loaded) {
    return <WorkspaceLoading />;
  }

  return (
    <div className="h-screen flex flex-col bg-ds-base text-ds-text-secondary text-[13px]">
      <Topbar
        session={session.session}
        sessionId={sessionId}
        token={session.token}
        connected={session.connected}
        onAdvance={session.refreshSession}
      />

      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={17} minSize={14}>
            <Explorer
              paths={files.paths}
              activeFile={files.activeFile}
              dirtyFiles={files.dirtyFiles}
              expandedFolders={files.expandedFolders}
              createState={files.createState}
              renameState={files.renameState}
              setActiveFile={files.setActiveFile}
              toggleFolder={files.toggleFolder}
              startCreate={files.startCreate}
              cancelCreate={files.cancelCreate}
              commitCreate={files.commitCreate}
              startRename={files.startRename}
              cancelRename={files.cancelRename}
              renamePath={files.renamePath}
              deletePath={files.deletePath}
            />
          </Panel>

          <PanelResizeHandle className="w-[1px] bg-ds-border hover:bg-ds-primary/40 transition-colors" />

          <Panel defaultSize={59}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={70}>
                <Editor
                  openFiles={files.openFiles}
                  activeFile={files.activeFile}
                  fileMap={files.fileMap}
                  dirtyFiles={files.dirtyFiles}
                  setActiveFile={files.setActiveFile}
                  closeFile={files.closeFile}
                  updateFile={files.updateFile}
                  saveFile={files.saveFile}
                />
              </Panel>

              <PanelResizeHandle className="h-[1px] bg-ds-border hover:bg-ds-primary/40 transition-colors" />

              <Panel defaultSize={30} minSize={15}>
                <Terminal sessionId={sessionId} token={session.token} />
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-[1px] bg-ds-border hover:bg-ds-primary/40 transition-colors" />

          <Panel defaultSize={24} minSize={18}>
            <RightSidebar
              messages={session.messages}
              chatInput={session.chatInput}
              chatSending={session.chatSending}
              teamTickets={session.teamTickets}
              session={session.session}
              setChatInput={session.setChatInput}
              sendChat={session.sendChat}
            />
          </Panel>
        </PanelGroup>
      </div>

      <Statusbar
        connected={session.connected}
        hasContainer={session.hasContainer}
        activeFile={files.activeFile}
      />

      {showStandup && (
        <StandupCall
          sessionId={sessionId}
          standupNumber={standupNumber}
          onComplete={handleStandupComplete}
          onEnd={handleStandupEnd}
        />
      )}
    </div>
  );
}