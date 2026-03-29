"use client";

import { useMemo, useState } from "react";

type CreateMode = "file" | "folder";

type CreateState = {
  parentPath: string;
  mode: CreateMode;
} | null;

type RenameState = {
  path: string;
  type: "file" | "folder";
} | null;

export default function useWorkspaceFiles() {
  const [fileMap, setFileMap] = useState<Record<string, string>>({
    "README.md": "# DevSim Workspace",
    "src/index.ts": 'console.log("hello world");\n',
    "src/lib/utils.ts": "export const sum = (a:number,b:number) => a + b;\n",
    "src/components/Button.tsx":
      'export default function Button(){ return <button>Click</button>; }\n',
  });

  const [openFiles, setOpenFiles] = useState<string[]>(["README.md"]);
  const [activeFile, setActiveFileState] = useState<string | null>("README.md");
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["src", "src/lib", "src/components"])
  );
  const [createState, setCreateState] = useState<CreateState>(null);
  const [renameState, setRenameState] = useState<RenameState>(null);

  const paths = useMemo(() => Object.keys(fileMap).sort(), [fileMap]);

  function setActiveFile(path: string) {
    setActiveFileState(path);
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
  }

  function closeFile(path: string) {
    setOpenFiles((prev) => {
      const next = prev.filter((item) => item !== path);

      if (activeFile === path) {
        setActiveFileState(next[next.length - 1] ?? null);
      }

      return next;
    });
  }

  function updateFile(path: string, content: string) {
    setFileMap((prev) => ({ ...prev, [path]: content }));
    setDirtyFiles((prev) => new Set(prev).add(path));
  }

  function saveFile(path?: string) {
    const target = path ?? activeFile;
    if (!target) return;

    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete(target);
      return next;
    });
  }

  function toggleFolder(path: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function startCreate(mode: CreateMode, parentPath = "") {
    if (parentPath) {
      const pieces = parentPath.split("/");
      const parents = pieces.map((_, i) => pieces.slice(0, i + 1).join("/"));
      setExpandedFolders((prev) => new Set([...prev, ...parents]));
    }

    setCreateState({ parentPath, mode });
    setRenameState(null);
  }

  function cancelCreate() {
    setCreateState(null);
  }

  function commitCreate(name: string) {
    if (!createState) return;

    const clean = name.trim().replace(/^\/+/, "");
    if (!clean) {
      setCreateState(null);
      return;
    }

    const fullPath = createState.parentPath
      ? `${createState.parentPath}/${clean}`
      : clean;

    setFileMap((prev) => {
      if (createState.mode === "folder") {
        return { ...prev, [`${fullPath}/.gitkeep`]: "" };
      }

      return { ...prev, [fullPath]: "" };
    });

    if (createState.mode === "file") {
      setActiveFile(fullPath);
    } else {
      setExpandedFolders((prev) => new Set(prev).add(fullPath));
    }

    setCreateState(null);
  }

  function startRename(path: string, type: "file" | "folder") {
    setRenameState({ path, type });
    setCreateState(null);
  }

  function cancelRename() {
    setRenameState(null);
  }

  function renamePath(oldPath: string, nextName: string, type: "file" | "folder") {
    const cleanName = nextName.trim().replace(/^\/+/, "");
    if (!cleanName) {
      setRenameState(null);
      return;
    }

    const oldParts = oldPath.split("/");
    oldParts[oldParts.length - 1] = cleanName;
    const newPath = oldParts.join("/");

    if (newPath === oldPath) {
      setRenameState(null);
      return;
    }

    if (type === "file") {
      setFileMap((prev) => {
        const next = { ...prev };
        const content = next[oldPath];
        delete next[oldPath];
        next[newPath] = content ?? "";
        return next;
      });

      setOpenFiles((prev) => prev.map((item) => (item === oldPath ? newPath : item)));

      if (activeFile === oldPath) {
        setActiveFileState(newPath);
      }

      setDirtyFiles((prev) => {
        const next = new Set(prev);
        const wasDirty = next.has(oldPath);
        next.delete(oldPath);
        if (wasDirty) next.add(newPath);
        return next;
      });
    } else {
      setFileMap((prev) => {
        const next: Record<string, string> = {};

        Object.entries(prev).forEach(([path, content]) => {
          if (path === oldPath || path.startsWith(`${oldPath}/`)) {
            const replaced = path.replace(oldPath, newPath);
            next[replaced] = content;
          } else {
            next[path] = content;
          }
        });

        return next;
      });

      setOpenFiles((prev) =>
        prev.map((item) =>
          item === oldPath || item.startsWith(`${oldPath}/`)
            ? item.replace(oldPath, newPath)
            : item
        )
      );

      if (activeFile && (activeFile === oldPath || activeFile.startsWith(`${oldPath}/`))) {
        setActiveFileState(activeFile.replace(oldPath, newPath));
      }

      setDirtyFiles((prev) => {
        const next = new Set<string>();

        prev.forEach((item) => {
          if (item === oldPath || item.startsWith(`${oldPath}/`)) {
            next.add(item.replace(oldPath, newPath));
          } else {
            next.add(item);
          }
        });

        return next;
      });

      setExpandedFolders((prev) => {
        const next = new Set<string>();

        prev.forEach((item) => {
          if (item === oldPath || item.startsWith(`${oldPath}/`)) {
            next.add(item.replace(oldPath, newPath));
          } else {
            next.add(item);
          }
        });

        return next;
      });
    }

    setRenameState(null);
  }

  function deletePath(path: string, type: "file" | "folder") {
    if (type === "file") {
      setFileMap((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });

      setOpenFiles((prev) => {
        const next = prev.filter((item) => item !== path);
        if (activeFile === path) {
          setActiveFileState(next[next.length - 1] ?? null);
        }
        return next;
      });

      setDirtyFiles((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });

      return;
    }

    setFileMap((prev) => {
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (!(key === path || key.startsWith(`${path}/`))) {
          next[key] = value;
        }
      });
      return next;
    });

    setOpenFiles((prev) => {
      const next = prev.filter(
        (item) => !(item === path || item.startsWith(`${path}/`))
      );

      if (activeFile && (activeFile === path || activeFile.startsWith(`${path}/`))) {
        setActiveFileState(next[next.length - 1] ?? null);
      }

      return next;
    });

    setDirtyFiles((prev) => {
      const next = new Set<string>();
      prev.forEach((item) => {
        if (!(item === path || item.startsWith(`${path}/`))) {
          next.add(item);
        }
      });
      return next;
    });

    setExpandedFolders((prev) => {
      const next = new Set<string>();
      prev.forEach((item) => {
        if (!(item === path || item.startsWith(`${path}/`))) {
          next.add(item);
        }
      });
      return next;
    });
  }

  return {
    fileMap,
    paths,
    openFiles,
    activeFile,
    dirtyFiles,
    expandedFolders,
    createState,
    renameState,
    setActiveFile,
    closeFile,
    updateFile,
    saveFile,
    toggleFolder,
    startCreate,
    cancelCreate,
    commitCreate,
    startRename,
    cancelRename,
    renamePath,
    deletePath,
  };
}