"use client";

type Props = {
  connected?: boolean;
  activeFile?: string | null;
  language?: string;
};

export default function Statusbar({
  connected = false,
  activeFile = null,
  language = "plaintext",
}: Props) {
  return (
    <div className="flex h-7 items-center gap-4 border-t border-[#2f81f7]/25 bg-[#0d2347] px-3 text-[11px] text-[#d7e9ff]">
      <span>{connected ? "Live" : "Disconnected"}</span>
      <span className="truncate">{activeFile ?? "No file selected"}</span>
      <span className="ml-auto uppercase">{language}</span>
    </div>
  );
}