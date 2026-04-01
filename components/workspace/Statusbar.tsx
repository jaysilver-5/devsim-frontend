// components/workspace/Statusbar.tsx
"use client";

type Props = {
  connected: boolean;
  hasContainer: boolean;
  activeFile: string | null;
};

const LANG_MAP: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TSX",
  js: "JavaScript",
  jsx: "JSX",
  json: "JSON",
  md: "Markdown",
  css: "CSS",
  html: "HTML",
  prisma: "Prisma",
  env: "ENV",
  yaml: "YAML",
  yml: "YAML",
  txt: "Text",
};

export default function Statusbar({ connected, hasContainer, activeFile }: Props) {
  const ext = activeFile?.split(".").pop()?.toLowerCase() || "";
  const language = LANG_MAP[ext] ?? ext.toUpperCase();

  return (
    <div className="flex items-center h-6 px-3 bg-ds-primary/8 border-t border-ds-primary/15 text-[10px] shrink-0">
      <div className="flex items-center gap-3">
        <span className={connected ? "text-ds-success" : "text-ds-text-faint"}>
          {connected ? "● Connected" : hasContainer ? "○ REST mode" : "○ Local"}
        </span>
      </div>

      <div className="flex-1" />

      {activeFile && (
        <div className="flex items-center gap-4 text-ds-text-dim">
          <span className="text-ds-text-faint">{activeFile}</span>
          <span>{language}</span>
          <span>UTF-8</span>
        </div>
      )}
    </div>
  );
}