"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";

type CreateMode = "file" | "folder";
type CreateState = { parentPath: string; mode: CreateMode } | null;
type RenameState = { path: string; type: "file" | "folder" } | null;

export default function useWorkspaceFiles(
  sessionId: string,
  token: string | null,
  hasContainer: boolean
) {
  const { getToken } = useAuth();

  const [fileMap, setFileMap] = useState<Record<string, string>>({});
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFileState] = useState<string | null>(null);
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [createState, setCreateState] = useState<CreateState>(null);
  const [renameState, setRenameState] = useState<RenameState>(null);
  const [loaded, setLoaded] = useState(false);

  const getFreshTokens = useCallback(async () => {
    const primary = await getToken();
    if (!primary) throw new Error("Missing auth token");

    const retry = await getToken({ skipCache: true }).catch(() => primary);
    return {
      token: primary,
      retryToken: retry || primary,
    };
  }, [getToken]);

  useEffect(() => {
    if (!token || !sessionId || loaded) return;

    async function loadFiles() {
      try {
        const { token: freshToken, retryToken } = await getFreshTokens();

        const resp = (await api.workspace.getStarterFiles(
          sessionId,
          freshToken,
          retryToken
        )) as {
          files: Record<string, string>;
          restoredFrom?: string;
        };

        if (!resp?.files) return;

        setFileMap(resp.files);

        const folders = new Set<string>();
        Object.keys(resp.files).forEach((path) => {
          const parts = path.split("/");
          for (let i = 1; i < parts.length; i++) {
            folders.add(parts.slice(0, i).join("/"));
          }
        });
        setExpandedFolders(folders);

        const paths = Object.keys(resp.files);
        const autoOpen =
          paths.find((p) => /ticket\.md$/i.test(p)) ||
          paths.find((p) => /src\/index\.(ts|js)$/.test(p)) ||
          paths.find((p) => /readme\.md$/i.test(p)) ||
          paths.find((p) => !p.endsWith(".gitkeep"));

        if (autoOpen) {
          setActiveFileState(autoOpen);
          setOpenFiles([autoOpen]);
        }

        if (hasContainer) {
          try {
            const liveFiles = (await api.workspace.getFiles(
              sessionId,
              freshToken,
              retryToken
            )) as string[];

            if (liveFiles.length > 0) {
              setFileMap((prev) => {
                const merged = { ...prev };
                liveFiles.forEach((p) => {
                  if (!merged[p]) merged[p] = "";
                });
                return merged;
              });
            }
          } catch {
            // non-fatal
          }
        }

        console.log(
          `[files] Loaded ${Object.keys(resp.files).length} files (${resp.restoredFrom ?? "starter"})`
        );
      } catch (err) {
        console.error("[files] Failed to load starter files:", err);
      } finally {
        setLoaded(true);
      }
    }

    loadFiles();
  }, [sessionId, token, hasContainer, loaded, getFreshTokens]);

  useEffect(() => {
    if (!token || !sessionId || Object.keys(fileMap).length === 0) return;

    const interval = setInterval(async () => {
      try {
        const { token: freshToken, retryToken } = await getFreshTokens();
        await api.workspace.saveSnapshot(
          sessionId,
          "auto",
          fileMap,
          freshToken,
          retryToken
        );
      } catch {
        // best-effort
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [token, sessionId, fileMap, getFreshTokens]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

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

  const saveFile = useCallback(
    async (path?: string) => {
      const target = path ?? activeFile;
      if (!target) return;

      if (hasContainer) {
        try {
          const { token: freshToken, retryToken } = await getFreshTokens();
          await api.workspace.writeFile(
            sessionId,
            target,
            fileMap[target] ?? "",
            freshToken,
            retryToken
          );
        } catch (err) {
          console.warn("[files] Write to container failed:", err);
        }
      }

      setDirtyFiles((prev) => {
        const next = new Set(prev);
        next.delete(target);
        return next;
      });
    },
    [activeFile, fileMap, hasContainer, sessionId, getFreshTokens]
  );

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

    if (createState.mode === "folder") {
      setFileMap((prev) => ({ ...prev, [`${fullPath}/.gitkeep`]: "" }));
      setExpandedFolders((prev) => new Set(prev).add(fullPath));
    } else {
      setFileMap((prev) => ({ ...prev, [fullPath]: "" }));
      setActiveFile(fullPath);

      if (hasContainer) {
        getFreshTokens()
          .then(({ token: freshToken, retryToken }) =>
            api.workspace.writeFile(
              sessionId,
              fullPath,
              "",
              freshToken,
              retryToken
            )
          )
          .catch(() => {});
      }
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
    if (!cleanName || cleanName === oldPath.split("/").pop()) {
      setRenameState(null);
      return;
    }

    const oldParts = oldPath.split("/");
    oldParts[oldParts.length - 1] = cleanName;
    const newPath = oldParts.join("/");

    if (type === "file") {
      setFileMap((prev) => {
        const next = { ...prev };
        const content = next[oldPath];
        delete next[oldPath];
        next[newPath] = content ?? "";
        return next;
      });

      setOpenFiles((prev) => prev.map((item) => (item === oldPath ? newPath : item)));
      if (activeFile === oldPath) setActiveFileState(newPath);

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
            next[path.replace(oldPath, newPath)] = content;
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
          next.add(
            item === oldPath || item.startsWith(`${oldPath}/`)
              ? item.replace(oldPath, newPath)
              : item
          );
        });
        return next;
      });

      setExpandedFolders((prev) => {
        const next = new Set<string>();
        prev.forEach((item) => {
          next.add(
            item === oldPath || item.startsWith(`${oldPath}/`)
              ? item.replace(oldPath, newPath)
              : item
          );
        });
        return next;
      });
    }

    setRenameState(null);
  }

  function deletePath(path: string, type: "file" | "folder") {
    const isPrefix = (p: string) => p === path || p.startsWith(`${path}/`);
    const shouldRemove = type === "file" ? (p: string) => p === path : isPrefix;

    setFileMap((prev) => {
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (!shouldRemove(key)) next[key] = value;
      });
      return next;
    });

    setOpenFiles((prev) => {
      const next = prev.filter((item) => !shouldRemove(item));
      if (activeFile && shouldRemove(activeFile)) {
        setActiveFileState(next[next.length - 1] ?? null);
      }
      return next;
    });

    setDirtyFiles((prev) => {
      const next = new Set<string>();
      prev.forEach((item) => {
        if (!shouldRemove(item)) next.add(item);
      });
      return next;
    });

    if (type === "folder") {
      setExpandedFolders((prev) => {
        const next = new Set<string>();
        prev.forEach((item) => {
          if (!isPrefix(item)) next.add(item);
        });
        return next;
      });
    }
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
    loaded,
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