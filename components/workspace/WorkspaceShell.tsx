// components/workspace/WorkspaceShell.tsx
"use client";

import dynamic from "next/dynamic";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Explorer from "./explorer/Explorer";
import Editor from "./editor/Editor";
import RightSidebar from "./right/RightSidebar";
import Topbar from "./Topbar";
import Statusbar from "./Statusbar";

import useWorkspaceSession from "@/hooks/workspace/useWorkspaceSession";
import useWorkspaceFiles from "@/hooks/workspace/useWorkspaceFiles";

const Terminal = dynamic(() => import("./terminal/Terminal"), {
  ssr: false,
});

export default function WorkspaceShell({ sessionId }: { sessionId: string }) {
  const session = useWorkspaceSession(sessionId);

  // Files hook now takes sessionId + token + hasContainer
  const files = useWorkspaceFiles(sessionId, session.token, session.hasContainer);

  if (session.loading || !files.loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-ds-base text-ds-text-dim">
        Loading workspace...
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-ds-base text-ds-text-secondary">
      <Topbar session={session.session} />

      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={18} minSize={14}>
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

          <PanelResizeHandle className="w-[1px] bg-ds-border" />

          <Panel defaultSize={58}>
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

              <PanelResizeHandle className="h-[1px] bg-ds-border" />

              <Panel defaultSize={30} minSize={18}>
                <Terminal sessionId={sessionId} token={session.token} />
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-[1px] bg-ds-border" />

          <Panel defaultSize={24}>
            <RightSidebar {...session} />
          </Panel>
        </PanelGroup>
      </div>

      <Statusbar
        connected={session.connected}
        activeFile={files.activeFile}
        language={
          files.activeFile?.split(".").pop()?.toLowerCase() === "ts"
            ? "typescript"
            : files.activeFile?.split(".").pop()?.toLowerCase() || "plaintext"
        }
      />
    </div>
  );
}