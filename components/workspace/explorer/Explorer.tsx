// components/workspace/explorer/Explorer.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus2,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
  MoreHorizontal,
  FileText,
  FileJson,
  Lock,
  Database,
  File,
} from "lucide-react";

type ExplorerProps = {
  paths: string[];
  activeFile: string | null;
  dirtyFiles: Set<string>;
  expandedFolders: Set<string>;
  createState: { parentPath: string; mode: "file" | "folder" } | null;
  renameState: { path: string; type: "file" | "folder" } | null;
  setActiveFile: (path: string) => void;
  toggleFolder: (path: string) => void;
  startCreate: (mode: "file" | "folder", parentPath?: string) => void;
  cancelCreate: () => void;
  commitCreate: (name: string) => void;
  startRename: (path: string, type: "file" | "folder") => void;
  cancelRename: () => void;
  renamePath: (oldPath: string, nextName: string, type: "file" | "folder") => void;
  deletePath: (path: string, type: "file" | "folder") => void;
};

type TreeNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
};

type MenuState = {
  x: number;
  y: number;
  path: string;
  type: "file" | "folder";
} | null;

function buildTree(paths: string[]): TreeNode[] {
  type Temp = { name: string; path: string; type: "file" | "folder"; children: Record<string, Temp> };
  const root: Record<string, Temp> = {};

  for (const fullPath of paths) {
    const cleanPath = fullPath.replace(/\/\.gitkeep$/, "");
    const parts = cleanPath.split("/").filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/");
      const isFile = index === parts.length - 1 && !fullPath.endsWith("/.gitkeep");

      if (!current[part]) {
        current[part] = { name: part, path, type: isFile ? "file" : "folder", children: {} };
      }
      if (!isFile) current = current[part].children;
    });
  }

  function toArray(node: Record<string, Temp>): TreeNode[] {
    return Object.values(node)
      .map((item): TreeNode =>
        item.type === "folder"
          ? { name: item.name, path: item.path, type: "folder", children: toArray(item.children) }
          : { name: item.name, path: item.path, type: "file" }
      )
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  return toArray(root);
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const cls = "w-3.5 h-3.5 shrink-0";

  switch (ext) {
    case "ts": case "tsx": return <FileCode2 className={`${cls} text-ds-info`} />;
    case "js": case "jsx": return <FileCode2 className={`${cls} text-ds-warning`} />;
    case "json": return <FileJson className={`${cls} text-ds-warning/60`} />;
    case "md": return <FileText className={`${cls} text-ds-text-muted`} />;
    case "prisma": return <Database className={`${cls} text-ds-primary-muted`} />;
    case "env": return <Lock className={`${cls} text-ds-success/60`} />;
    default: return <File className={`${cls} text-ds-text-ghost`} />;
  }
}

export default function Explorer(props: ExplorerProps) {
  const tree = buildTree(props.paths);
  const [menu, setMenu] = useState<MenuState>(null);

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    return () => { window.removeEventListener("click", close); window.removeEventListener("blur", close); };
  }, []);

  return (
    <div className="relative h-full flex flex-col bg-ds-surface" onContextMenu={(e) => e.preventDefault()}>
      {/* Header */}
      <div className="h-9 flex items-center justify-between px-2.5 border-b border-ds-border shrink-0">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ds-text-faint font-semibold">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => props.startCreate("file")}
            className="p-1 rounded text-ds-text-faint hover:text-ds-primary-muted hover:bg-ds-elevated transition-colors"
            title="New file"
          >
            <FilePlus2 size={13} />
          </button>
          <button
            onClick={() => props.startCreate("folder")}
            className="p-1 rounded text-ds-text-faint hover:text-ds-primary-muted hover:bg-ds-elevated transition-colors"
            title="New folder"
          >
            <FolderPlus size={13} />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto py-1 select-none">
        {props.createState?.parentPath === "" && (
          <InlineInput
            depth={0}
            mode={props.createState.mode}
            onCancel={props.cancelCreate}
            onCommit={props.commitCreate}
          />
        )}
        {tree.map((node) => (
          <TreeNodeRow key={node.path} node={node} depth={0} menu={menu} setMenu={setMenu} {...props} />
        ))}
      </div>

      {/* Context menu */}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          type={menu.type}
          onClose={() => setMenu(null)}
          onRename={() => { props.startRename(menu.path, menu.type); setMenu(null); }}
          onDelete={() => {
            if (window.confirm(`Delete this ${menu.type}?`)) props.deletePath(menu.path, menu.type);
            setMenu(null);
          }}
          onNewFile={menu.type === "folder" ? () => { props.startCreate("file", menu.path); setMenu(null); } : undefined}
          onNewFolder={menu.type === "folder" ? () => { props.startCreate("folder", menu.path); setMenu(null); } : undefined}
        />
      )}
    </div>
  );
}

function TreeNodeRow({
  node, depth, menu, setMenu, activeFile, dirtyFiles, expandedFolders,
  createState, renameState, setActiveFile, toggleFolder, startCreate,
  cancelCreate, commitCreate, startRename, cancelRename, renamePath, deletePath, paths,
}: ExplorerProps & { node: TreeNode; depth: number; menu: MenuState; setMenu: (m: MenuState) => void }) {
  const isFolder = node.type === "folder";
  const isExpanded = isFolder && expandedFolders.has(node.path);
  const isActive = activeFile === node.path;
  const isRenaming = renameState?.path === node.path;
  const indent = depth * 12 + 8;

  return (
    <div>
      <div
        className={`group h-7 flex items-center text-[12px] transition-colors ${
          isActive ? "bg-ds-primary/10 text-ds-primary-muted" : "text-ds-text-muted hover:bg-ds-elevated/60"
        }`}
        style={{ paddingLeft: `${indent}px` }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, path: node.path, type: node.type });
        }}
      >
        {isFolder ? (
          <button onClick={() => toggleFolder(node.path)} className="mr-1 text-ds-text-ghost hover:text-ds-text-muted">
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="mr-1 w-[13px]" />
        )}

        {isRenaming ? (
          <InlineRename
            type={node.type}
            initialValue={node.name}
            onCancel={cancelRename}
            onCommit={(val) => renamePath(node.path, val, node.type)}
          />
        ) : (
          <>
            <button
              onClick={() => isFolder ? toggleFolder(node.path) : setActiveFile(node.path)}
              className="flex flex-1 items-center gap-1.5 min-w-0 text-left"
            >
              {isFolder
                ? isExpanded
                  ? <FolderOpen size={14} className="shrink-0 text-ds-warning/70" />
                  : <FolderClosed size={14} className="shrink-0 text-ds-warning/50" />
                : <FileIcon name={node.name} />}
              <span className="truncate">{node.name}</span>
              {!isFolder && dirtyFiles.has(node.path) && (
                <span className="text-ds-warning text-[10px] ml-auto mr-1">●</span>
              )}
            </button>

            {/* Hover actions */}
            <div className="hidden group-hover:flex items-center gap-0.5 mr-1">
              {isFolder && (
                <>
                  <button onClick={() => startCreate("file", node.path)} className="p-0.5 text-ds-text-ghost hover:text-ds-text-muted" title="New file"><FilePlus2 size={11} /></button>
                  <button onClick={() => startCreate("folder", node.path)} className="p-0.5 text-ds-text-ghost hover:text-ds-text-muted" title="New folder"><FolderPlus size={11} /></button>
                </>
              )}
              <button onClick={() => startRename(node.path, node.type)} className="p-0.5 text-ds-text-ghost hover:text-ds-text-muted" title="Rename"><Pencil size={11} /></button>
              <button
                onClick={(e) => setMenu({
                  x: e.currentTarget.getBoundingClientRect().left - 120,
                  y: e.currentTarget.getBoundingClientRect().bottom + 4,
                  path: node.path, type: node.type,
                })}
                className="p-0.5 text-ds-text-ghost hover:text-ds-text-muted"
              >
                <MoreHorizontal size={11} />
              </button>
            </div>
          </>
        )}
      </div>

      {isFolder && isExpanded && (
        <div>
          {createState?.parentPath === node.path && (
            <InlineInput depth={depth + 1} mode={createState.mode} onCancel={cancelCreate} onCommit={commitCreate} />
          )}
          {node.children?.map((child) => (
            <TreeNodeRow
              key={child.path} node={child} depth={depth + 1} menu={menu} setMenu={setMenu}
              activeFile={activeFile} dirtyFiles={dirtyFiles} expandedFolders={expandedFolders}
              createState={createState} renameState={renameState} setActiveFile={setActiveFile}
              toggleFolder={toggleFolder} startCreate={startCreate} cancelCreate={cancelCreate}
              commitCreate={commitCreate} startRename={startRename} cancelRename={cancelRename}
              renamePath={renamePath} deletePath={deletePath} paths={[]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InlineInput({ depth, mode, onCancel, onCommit }: {
  depth: number; mode: "file" | "folder"; onCancel: () => void; onCommit: (name: string) => void;
}) {
  return (
    <div className="py-0.5" style={{ paddingLeft: 8 + depth * 12 }}>
      <div className="h-7 flex items-center gap-1.5 bg-ds-elevated rounded px-2">
        {mode === "folder" ? <FolderOpen size={14} className="text-ds-warning/70" /> : <FileCode2 size={14} className="text-ds-info" />}
        <input
          autoFocus
          placeholder={mode === "folder" ? "folder-name" : "file-name.ts"}
          className="flex-1 bg-transparent text-[12px] text-ds-text-secondary outline-none placeholder:text-ds-text-ghost"
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit(e.currentTarget.value);
            if (e.key === "Escape") onCancel();
          }}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v) onCommit(v); else onCancel();
          }}
        />
      </div>
    </div>
  );
}

function InlineRename({ type, initialValue, onCancel, onCommit }: {
  type: "file" | "folder"; initialValue: string; onCancel: () => void; onCommit: (name: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  return (
    <div className="flex flex-1 items-center gap-1.5 bg-ds-elevated rounded px-2">
      {type === "folder" ? <FolderOpen size={14} className="text-ds-warning/70 shrink-0" /> : <FileCode2 size={14} className="text-ds-info shrink-0" />}
      <input
        ref={ref}
        defaultValue={initialValue}
        className="h-6 flex-1 bg-transparent text-[12px] text-ds-text-secondary outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit(e.currentTarget.value);
          if (e.key === "Escape") onCancel();
        }}
        onBlur={(e) => {
          const v = e.currentTarget.value.trim();
          if (v) onCommit(v); else onCancel();
        }}
      />
    </div>
  );
}

function ContextMenu({ x, y, type, onClose, onRename, onDelete, onNewFile, onNewFolder }: {
  x: number; y: number; type: "file" | "folder"; onClose: () => void;
  onRename: () => void; onDelete: () => void; onNewFile?: () => void; onNewFolder?: () => void;
}) {
  return (
    <div
      className="fixed z-50 min-w-40 rounded-lg bg-ds-elevated p-1 shadow-2xl"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {type === "folder" && (
        <>
          <MenuItem icon={<FilePlus2 size={12} />} label="New File" onClick={() => { onNewFile?.(); onClose(); }} />
          <MenuItem icon={<FolderPlus size={12} />} label="New Folder" onClick={() => { onNewFolder?.(); onClose(); }} />
          <div className="my-1 h-px bg-ds-border" />
        </>
      )}
      <MenuItem icon={<Pencil size={12} />} label="Rename" onClick={() => { onRename(); onClose(); }} />
      <MenuItem icon={<Trash2 size={12} />} label="Delete" destructive onClick={() => { onDelete(); onClose(); }} />
    </div>
  );
}

function MenuItem({ icon, label, destructive, onClick }: {
  icon: React.ReactNode; label: string; destructive?: boolean; onClick: () => void;
}) {
  return (
    <button
      className={`flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[11px] ${
        destructive ? "text-ds-danger hover:bg-ds-danger/8" : "text-ds-text-muted hover:bg-ds-base"
      }`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}