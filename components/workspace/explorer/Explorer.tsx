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
  type TempTreeNode = {
    name: string;
    path: string;
    type: "file" | "folder";
    children: Record<string, TempTreeNode>;
  };

  const root: Record<string, TempTreeNode> = {};

  for (const fullPath of paths) {
    const cleanPath = fullPath.replace(/\/\.gitkeep$/, "");
    const parts = cleanPath.split("/").filter(Boolean);
    let current = root;

    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/");
      const isFile =
        index === parts.length - 1 && !fullPath.endsWith("/.gitkeep");

      if (!current[part]) {
        current[part] = {
          name: part,
          path,
          type: isFile ? "file" : "folder",
          children: {},
        };
      }

      if (!isFile) {
        current = current[part].children;
      }
    });
  }

  function toArray(node: Record<string, TempTreeNode>): TreeNode[] {
    return Object.values(node)
      .map((item): TreeNode => {
        if (item.type === "folder") {
          return {
            name: item.name,
            path: item.path,
            type: "folder",
            children: toArray(item.children),
          };
        }

        return {
          name: item.name,
          path: item.path,
          type: "file",
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  return toArray(root);
}

export default function Explorer(props: ExplorerProps) {
  const tree = buildTree(props.paths);
  const [menu, setMenu] = useState<MenuState>(null);

  useEffect(() => {
    const handleClose = () => setMenu(null);
    window.addEventListener("click", handleClose);
    window.addEventListener("blur", handleClose);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("blur", handleClose);
    };
  }, []);

  return (
    <div
      className="relative h-full flex flex-col bg-[#0f1524] border-r border-white/10"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="h-10 flex items-center justify-between px-2 border-b border-white/10">
        <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
          Explorer
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => props.startCreate("file")}
            className="icon-btn"
            title="New file"
          >
            <FilePlus2 size={14} />
          </button>
          <button
            onClick={() => props.startCreate("folder")}
            className="icon-btn"
            title="New folder"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-1 py-2">
        {props.createState?.parentPath === "" && (
          <InlineCreateRow
            depth={0}
            mode={props.createState.mode}
            onCancel={props.cancelCreate}
            onCommit={props.commitCreate}
          />
        )}

        {tree.map((node) => (
          <TreeNodeRow
            key={node.path}
            node={node}
            depth={0}
            menu={menu}
            setMenu={setMenu}
            {...props}
          />
        ))}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          type={menu.type}
          onClose={() => setMenu(null)}
          onRename={() => {
            props.startRename(menu.path, menu.type);
            setMenu(null);
          }}
          onDelete={() => {
            const ok = window.confirm(`Delete this ${menu.type}?`);
            if (ok) props.deletePath(menu.path, menu.type);
            setMenu(null);
            }}
          onNewFile={
            menu.type === "folder"
              ? () => {
                  props.startCreate("file", menu.path);
                  setMenu(null);
                }
              : undefined
          }
          onNewFolder={
            menu.type === "folder"
              ? () => {
                  props.startCreate("folder", menu.path);
                  setMenu(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function TreeNodeRow({
  node,
  depth,
  menu,
  setMenu,
  activeFile,
  dirtyFiles,
  expandedFolders,
  createState,
  renameState,
  setActiveFile,
  toggleFolder,
  startCreate,
  cancelCreate,
  commitCreate,
  startRename,
  cancelRename,
  renamePath,
  deletePath,
}: ExplorerProps & {
  node: TreeNode;
  depth: number;
  menu: MenuState;
  setMenu: (menu: MenuState) => void;
}) {
  const isFolder = node.type === "folder";
  const isExpanded = isFolder && expandedFolders.has(node.path);
  const isActive = activeFile === node.path;
  const isRenaming = renameState?.path === node.path;

  return (
    <div>
      <div
        className={[
          "group h-7 flex items-center rounded px-1.5 text-[13px]",
          isActive ? "bg-[#16213a] text-white" : "text-white/70 hover:bg-white/5",
        ].join(" ")}
        style={{ paddingLeft: 8 + depth * 14 }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({
            x: e.clientX,
            y: e.clientY,
            path: node.path,
            type: node.type,
          });
        }}
      >
        {isFolder ? (
          <button
            onClick={() => toggleFolder(node.path)}
            className="mr-1 text-white/45 hover:text-white"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="mr-1 w-3.5" />
        )}

        {isRenaming ? (
          <InlineRenameRow
            depth={0}
            type={node.type}
            initialValue={node.name}
            onCancel={cancelRename}
            onCommit={(value) => renamePath(node.path, value, node.type)}
          />
        ) : (
          <>
            <button
              onClick={() => (isFolder ? toggleFolder(node.path) : setActiveFile(node.path))}
              className="flex flex-1 items-center gap-2 min-w-0 text-left"
            >
              {isFolder ? (
                isExpanded ? (
                  <FolderOpen size={15} className="shrink-0 text-[#dcb76d]" />
                ) : (
                  <FolderClosed size={15} className="shrink-0 text-[#dcb76d]" />
                )
              ) : (
                <FileCode2 size={15} className="shrink-0 text-[#87b7ff]" />
              )}

              <span className="truncate">{node.name}</span>

              {!isFolder && dirtyFiles.has(node.path) && (
                <span className="text-[#6cb6ff]">●</span>
              )}
            </button>

            <div className="hidden group-hover:flex items-center gap-1">
              {isFolder && (
                <>
                  <button
                    onClick={() => startCreate("file", node.path)}
                    className="icon-btn-sm"
                    title="New file"
                  >
                    <FilePlus2 size={12} />
                  </button>
                  <button
                    onClick={() => startCreate("folder", node.path)}
                    className="icon-btn-sm"
                    title="New folder"
                  >
                    <FolderPlus size={12} />
                  </button>
                </>
              )}

              <button
                onClick={() => startRename(node.path, node.type)}
                className="icon-btn-sm"
                title="Rename"
              >
                <Pencil size={12} />
              </button>

              <button
                onClick={(e) =>
                  setMenu({
                    x: e.currentTarget.getBoundingClientRect().left - 120,
                    y: e.currentTarget.getBoundingClientRect().bottom + 4,
                    path: node.path,
                    type: node.type,
                  })
                }
                className="icon-btn-sm"
                title="More"
              >
                <MoreHorizontal size={12} />
              </button>
            </div>
          </>
        )}
      </div>

      {isFolder && isExpanded && (
        <div>
          {createState?.parentPath === node.path && (
            <InlineCreateRow
              depth={depth + 1}
              mode={createState.mode}
              onCancel={cancelCreate}
              onCommit={commitCreate}
            />
          )}

          {node.children?.map((child) => (
            <TreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              menu={menu}
              setMenu={setMenu}
              activeFile={activeFile}
              dirtyFiles={dirtyFiles}
              expandedFolders={expandedFolders}
              createState={createState}
              renameState={renameState}
              setActiveFile={setActiveFile}
              toggleFolder={toggleFolder}
              startCreate={startCreate}
              cancelCreate={cancelCreate}
              commitCreate={commitCreate}
              startRename={startRename}
              cancelRename={cancelRename}
              renamePath={renamePath}
              deletePath={deletePath}
              paths={[]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InlineCreateRow({
  depth,
  mode,
  onCancel,
  onCommit,
}: {
  depth: number;
  mode: "file" | "folder";
  onCancel: () => void;
  onCommit: (name: string) => void;
}) {
  return (
    <div className="py-1" style={{ paddingLeft: 8 + depth * 14 }}>
      <div className="h-7 flex items-center gap-2 rounded border border-[#2f81f7]/30 bg-[#101827] px-2">
        {mode === "folder" ? (
          <FolderOpen size={15} className="text-[#dcb76d]" />
        ) : (
          <FileCode2 size={15} className="text-[#87b7ff]" />
        )}

        <input
          autoFocus
          placeholder={mode === "folder" ? "folder-name" : "file-name.ts"}
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-white/25"
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit(e.currentTarget.value);
            if (e.key === "Escape") onCancel();
          }}
          onBlur={(e) => {
            const value = e.currentTarget.value.trim();
            if (value) onCommit(value);
            else onCancel();
          }}
        />
      </div>
    </div>
  );
}

function InlineRenameRow({
  type,
  initialValue,
  onCancel,
  onCommit,
}: {
  depth: number;
  type: "file" | "folder";
  initialValue: string;
  onCancel: () => void;
  onCommit: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="flex flex-1 items-center gap-2 rounded border border-[#2f81f7]/30 bg-[#101827] px-2">
      {type === "folder" ? (
        <FolderOpen size={15} className="shrink-0 text-[#dcb76d]" />
      ) : (
        <FileCode2 size={15} className="shrink-0 text-[#87b7ff]" />
      )}

      <input
        ref={inputRef}
        defaultValue={initialValue}
        className="h-6 flex-1 bg-transparent text-[13px] outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit(e.currentTarget.value);
          if (e.key === "Escape") onCancel();
        }}
        onBlur={(e) => {
          const value = e.currentTarget.value.trim();
          if (value) onCommit(value);
          else onCancel();
        }}
      />
    </div>
  );
}

function ContextMenu({
  x,
  y,
  type,
  onClose,
  onRename,
  onDelete,
  onNewFile,
  onNewFolder,
}: {
  x: number;
  y: number;
  type: "file" | "folder";
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
}) {
  return (
    <div
      className="fixed z-50 min-w-40 rounded-md border border-white/10 bg-[#111827] p-1 shadow-2xl"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {type === "folder" && (
        <>
          <MenuItem
            icon={<FilePlus2 size={13} />}
            label="New File"
            onClick={() => {
              onNewFile?.();
              onClose();
            }}
          />
          <MenuItem
            icon={<FolderPlus size={13} />}
            label="New Folder"
            onClick={() => {
              onNewFolder?.();
              onClose();
            }}
          />
          <div className="my-1 h-px bg-white/10" />
        </>
      )}

      <MenuItem
        icon={<Pencil size={13} />}
        label="Rename"
        onClick={() => {
          onRename();
          onClose();
        }}
      />

      <MenuItem
        icon={<Trash2 size={13} />}
        label="Delete"
        destructive
        onClick={() => {
          onDelete();
          onClose();
        }}
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  destructive = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[13px]",
        destructive
          ? "text-red-300 hover:bg-red-500/10"
          : "text-white/80 hover:bg-white/6",
      ].join(" ")}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}