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

  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "css":
      return "css";
    case "html":
      return "html";
    case "py":
      return "python";
    default:
      return "plaintext";
  }
}

export default function Editor({
  openFiles,
  activeFile,
  fileMap,
  dirtyFiles,
  setActiveFile,
  closeFile,
  updateFile,
  saveFile,
}: EditorProps) {
  const value = activeFile ? fileMap[activeFile] ?? "" : "";

  return (
    <div className="h-full flex flex-col bg-[#0d1321]">
      <div className="h-10 flex items-center border-b border-white/10 bg-[#0f1728] overflow-x-auto">
        {openFiles.length === 0 ? (
          <div className="px-3 text-xs text-white/35">No file open</div>
        ) : (
          openFiles.map((path) => {
            const active = path === activeFile;
            const dirty = dirtyFiles.has(path);

            return (
              <div
                key={path}
                className={[
                  "group h-full min-w-[140px] max-w-[220px] flex items-center gap-2 px-3 border-r border-white/10",
                  active ? "bg-[#111b2e] text-white" : "text-white/55 hover:bg-white/5",
                ].join(" ")}
              >
                <button
                  onClick={() => setActiveFile(path)}
                  className="flex-1 truncate text-left text-xs"
                >
                  {path.split("/").pop()}
                  {dirty ? " •" : ""}
                </button>

                <button
                  onClick={() => closeFile(path)}
                  className="opacity-0 group-hover:opacity-100 text-white/35 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })
        )}

        <div className="ml-auto px-3">
          <button
            onClick={() => saveFile()}
            className="px-2 py-1 rounded border border-white/10 bg-white/5 text-[11px] text-white/70 hover:bg-white/10"
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {!activeFile ? (
          <div className="h-full flex items-center justify-center text-white/30">
            Select a file
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
            }}
          />
        )}
      </div>
    </div>
  );
}