// components/workspace/editor/Editor.tsx
"use client";

import MonacoEditor from "@monaco-editor/react";
import { X } from "lucide-react";

type EditorProps = {
  openFiles: string[];
  activeFile: string | null;
  fileMap: Record<string, string>;
  dirtyFiles: Set<string>;
  setActiveFile: (path: string) => void;
  closeFile: (path: string) => void;
  updateFile: (path: string, content: string) => void;
  saveFile: (path?: string) => void;
};

function getLanguage(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", md: "markdown", css: "css", html: "html", py: "python",
    prisma: "graphql", env: "ini", yaml: "yaml", yml: "yaml",
  };
  return map[ext || ""] ?? "plaintext";
}

export default function Editor({
  openFiles, activeFile, fileMap, dirtyFiles,
  setActiveFile, closeFile, updateFile, saveFile,
}: EditorProps) {
  const value = activeFile ? fileMap[activeFile] ?? "" : "";

  return (
    <div className="h-full flex flex-col bg-ds-base">
      {/* Tab bar */}
      <div className="h-9 flex items-center border-b border-ds-border bg-ds-surface/50 overflow-x-auto shrink-0">
        {openFiles.length === 0 ? (
          <div className="px-3 text-[11px] text-ds-text-ghost">No file open</div>
        ) : (
          openFiles.map((path) => {
            const active = path === activeFile;
            const dirty = dirtyFiles.has(path);

            return (
              <div
                key={path}
                className={`group h-full min-w-[120px] max-w-[200px] flex items-center gap-1.5 px-3 text-[11px] transition-colors ${
                  active
                    ? "bg-ds-base text-ds-text-secondary border-b-2 border-b-ds-primary"
                    : "text-ds-text-dim hover:bg-ds-elevated/50"
                }`}
              >
                <button
                  onClick={() => setActiveFile(path)}
                  className="flex-1 truncate text-left"
                >
                  {path.split("/").pop()}
                  {dirty && <span className="ml-1 text-ds-warning">●</span>}
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); closeFile(path); }}
                  className="opacity-0 group-hover:opacity-100 text-ds-text-ghost hover:text-ds-text-muted transition-opacity"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })
        )}

        {/* Save button */}
        {activeFile && dirtyFiles.has(activeFile) && (
          <button
            onClick={() => saveFile()}
            className="ml-auto mr-2 px-2 py-0.5 rounded text-[10px] text-ds-primary-muted bg-ds-primary/8 hover:bg-ds-primary/15 transition-colors shrink-0"
          >
            Save
          </button>
        )}
      </div>

      {/* Editor body */}
      <div className="flex-1 min-h-0">
        {!activeFile ? (
          <div className="h-full flex items-center justify-center text-ds-text-ghost text-sm">
            Select a file from the explorer
          </div>
        ) : (
          <MonacoEditor
            path={activeFile}
            theme="vs-dark"
            language={getLanguage(activeFile)}
            value={value}
            onChange={(next) => updateFile(activeFile, next ?? "")}
            options={{
              fontSize: 13,
              lineHeight: 20,
              minimap: { enabled: false },
              smoothScrolling: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: "gutter",
              fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace',
            }}
          />
        )}
      </div>
    </div>
  );
}