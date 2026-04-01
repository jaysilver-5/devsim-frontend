// components/workspace/WorkspaceShell.tsx
"use client";

import dynamic from "next/dynamic";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Explorer from "./explorer/Explorer";
import Editor from "./editor/Editor";
import RightSidebar from "./right/RightSidebar";
import Topbar from "./Topbar";
import Statusbar from "./Statusbar";
import { StandupOverlay } from "@/components/standup/standup-overlay";

import useWorkspaceSession from "@/hooks/workspace/useWorkspaceSession";
import useWorkspaceFiles from "@/hooks/workspace/useWorkspaceFiles";
import { useEffect, useState, useCallback } from "react";

const Terminal = dynamic(() => import("./terminal/Terminal"), { ssr: false });

export default function WorkspaceShell({ sessionId }: { sessionId: string }) {
  const session = useWorkspaceSession(sessionId);
  const files = useWorkspaceFiles(sessionId, session.token, session.hasContainer);

  // Standup overlay
  const [showStandup, setShowStandup] = useState(false);
  const [standupNumber, setStandupNumber] = useState(1);
  const isStandupPending = session.session?.status === "STANDUP_PENDING";

  useEffect(() => {
    if (isStandupPending && !showStandup) setShowStandup(true);
  }, [isStandupPending, showStandup]);

  const handleStandupComplete = useCallback(() => {
    setShowStandup(false);
    setStandupNumber((n) => n + 1);
    session.refreshSession();
  }, [session]);

  if (session.loading || !files.loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-ds-base">
        <div className="text-center">
          <div className="text-lg font-bold text-ds-primary-muted mb-2 tracking-tight">devsim</div>
          <div className="text-xs text-ds-text-dim animate-pulse">Loading workspace...</div>
        </div>
      </div>
    );
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
          {/* File explorer */}
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

          {/* Editor + Terminal */}
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

          {/* Right sidebar — chat, board, ticket */}
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

      {/* Standup overlay */}
      {showStandup && session.token && (
        <StandupOverlay
          sessionId={sessionId}
          standupNumber={standupNumber}
          token={session.token}
          onComplete={handleStandupComplete}
        />
      )}
    </div>
  );
}