"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Search, Square, X, Play } from "lucide-react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";
import { WsEvent } from "@/lib/types";

type TerminalTab = {
  id: string;
  title: string;
  terminalId: string | null;
  ready: boolean;
};

type Props = {
  sessionId: string;
  token: string | null;
};

type SpawnResponse = {
  terminalId?: string;
  error?: string;
};

export default function Terminal({ sessionId }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const searchAddonRef = useRef<any>(null);
  const cleanupTerminalRef = useRef<null | (() => void)>(null);

  const boundSocketRef = useRef<Socket | null>(null);
  const bindPollRef = useRef<number | null>(null);

  const tabsRef = useRef<TerminalTab[]>([]);
  const activeTabRef = useRef<string>("tab-1");

  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: "tab-1", title: "Terminal", terminalId: null, ready: false },
  ]);
  const [activeTabId, setActiveTabId] = useState("tab-1");

  const [xtermReady, setXtermReady] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [socketLabel, setSocketLabel] = useState("Waiting for socket...");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeTabRef.current = activeTabId;
  }, [activeTabId]);

  const writeLine = useCallback((text: string) => {
    xtermRef.current?.write(`${text}\r\n`);
  }, []);

  const clearAndWriteStatus = useCallback(
    (text: string) => {
      if (!xtermRef.current) return;
      xtermRef.current.clear();
      writeLine(`\x1b[90m${text}\x1b[0m`);
    },
    [writeLine]
  );

  const bindSocketListeners = useCallback(
    (socket: Socket) => {
      if (boundSocketRef.current === socket) {
        setSocketReady(socket.connected);
        setSocketLabel(socket.connected ? "Connected" : "Connecting...");
        return;
      }

      if (boundSocketRef.current) {
        boundSocketRef.current.off("connect");
        boundSocketRef.current.off("disconnect");
        boundSocketRef.current.off(WsEvent.TERMINAL_OUTPUT);
        boundSocketRef.current.off(WsEvent.TERMINAL_EXIT);
        boundSocketRef.current.off(WsEvent.ERROR);
      }

      const onConnect = () => {
        setSocketReady(true);
        setSocketLabel("Connected");
      };

      const onDisconnect = () => {
        setSocketReady(false);
        setSocketLabel("Disconnected");
      };

      const onOutput = (payload: { terminalId: string; data: string }) => {
        const currentTab = tabsRef.current.find((t) => t.id === activeTabRef.current);
        if (!currentTab?.terminalId) return;
        if (payload.terminalId !== currentTab.terminalId) return;

        xtermRef.current?.write(payload.data ?? "");
      };

      const onExit = (payload: { terminalId: string }) => {
        const matchedTab = tabsRef.current.find((t) => t.terminalId === payload.terminalId);
        if (!matchedTab) return;

        if (matchedTab.id === activeTabRef.current) {
          writeLine("\x1b[33m[process exited]\x1b[0m");
        }

        setTabs((prev) =>
          prev.map((tab) =>
            tab.terminalId === payload.terminalId
              ? { ...tab, terminalId: null, ready: false }
              : tab
          )
        );
      };

      const onError = (payload: { message?: string }) => {
        if (payload?.message) {
          writeLine(`\x1b[31m${payload.message}\x1b[0m`);
        }
      };

      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on(WsEvent.TERMINAL_OUTPUT, onOutput);
      socket.on(WsEvent.TERMINAL_EXIT, onExit);
      socket.on(WsEvent.ERROR, onError);

      boundSocketRef.current = socket;
      setSocketReady(socket.connected);
      setSocketLabel(socket.connected ? "Connected" : "Connecting...");
    },
    [writeLine]
  );

  const tryBindSocket = useCallback(() => {
    const socket = getSocket();

    if (!socket) {
      setSocketReady(false);
      setSocketLabel("Waiting for session socket...");
      return false;
    }

    bindSocketListeners(socket);
    return true;
  }, [bindSocketListeners]);

  useEffect(() => {
    let disposed = false;

    async function bootXterm() {
      if (!hostRef.current) return;

      const [{ Terminal: XTerm }, { FitAddon }, { SearchAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-search"),
      ]);
      await import("@xterm/xterm/css/xterm.css");

      if (disposed || !hostRef.current) return;

      const term = new XTerm({
        fontFamily:
          'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        fontSize: 12.5,
        lineHeight: 1.5,
        cursorBlink: true,
        cursorStyle: "block",
        scrollback: 5000,
        allowTransparency: true,
        convertEol: true,
        theme: {
          background: "#0b1020",
          foreground: "#d8e1f0",
          cursor: "#6cb6ff",
          selectionBackground: "rgba(108,182,255,0.22)",
        },
      });

      const fitAddon = new FitAddon();
      const searchAddon = new SearchAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(searchAddon);
      term.open(hostRef.current);
      fitAddon.fit();
      term.focus();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;
      setXtermReady(true);

      clearAndWriteStatus("Terminal ready. Waiting for session socket...");

      const onDataDispose = term.onData((data: string) => {
        const socket = getSocket();
        const currentTab = tabsRef.current.find((t) => t.id === activeTabRef.current);

        if (!socket?.connected || !currentTab?.terminalId) return;

        socket.emit(WsEvent.TERMINAL_DATA, {
          terminalId: currentTab.terminalId,
          data,
        });
      });

      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();

        const socket = getSocket();
        const currentTab = tabsRef.current.find((t) => t.id === activeTabRef.current);

        if (!socket?.connected || !currentTab?.terminalId) return;

        socket.emit(WsEvent.TERMINAL_RESIZE, {
          terminalId: currentTab.terminalId,
          cols: term.cols,
          rows: term.rows,
        });
      });

      resizeObserver.observe(hostRef.current);

      cleanupTerminalRef.current = () => {
        onDataDispose.dispose();
        resizeObserver.disconnect();
        term.dispose();
      };
    }

    void bootXterm();

    return () => {
      disposed = true;
      cleanupTerminalRef.current?.();
    };
  }, [clearAndWriteStatus]);

  useEffect(() => {
    if (!xtermReady) return;

    tryBindSocket();

    bindPollRef.current = window.setInterval(() => {
      tryBindSocket();
    }, 1000);

    return () => {
      if (bindPollRef.current) {
        window.clearInterval(bindPollRef.current);
        bindPollRef.current = null;
      }
    };
  }, [xtermReady, tryBindSocket]);

  useEffect(() => {
    if (!xtermReady) return;
    fitAddonRef.current?.fit();
    xtermRef.current?.focus();
  }, [xtermReady, activeTabId]);

  const spawnTerminal = useCallback(
    (tabId: string) => {
      const socket = getSocket();
      const term = xtermRef.current;

      if (!socket?.connected || !term) {
        clearAndWriteStatus("Socket not connected yet...");
        return;
      }

      term.clear();
      writeLine("\x1b[90mStarting terminal...\x1b[0m");

      socket.emit(
        WsEvent.TERMINAL_SPAWN,
        {
          sessionId,
          tabId,
          cols: term.cols,
          rows: term.rows,
        },
        (response: SpawnResponse) => {
          if (response?.error) {
            writeLine(`\x1b[31m${response.error}\x1b[0m`);
            return;
          }

          if (!response?.terminalId) {
            writeLine("\x1b[31mUnable to start terminal.\x1b[0m");
            return;
          }

          setTabs((prev) =>
            prev.map((tab) =>
              tab.id === tabId
                ? { ...tab, terminalId: response.terminalId!, ready: true }
                : tab
            )
          );
        }
      );
    },
    [clearAndWriteStatus, sessionId, writeLine]
  );

  useEffect(() => {
    if (!xtermReady || !socketReady || !activeTab || activeTab.ready) return;
    spawnTerminal(activeTab.id);
  }, [xtermReady, socketReady, activeTab, spawnTerminal]);

  function createNewTab() {
    const id = `tab-${Date.now()}`;

    setTabs((prev) => [
      ...prev,
      {
        id,
        title: `Terminal ${prev.length + 1}`,
        terminalId: null,
        ready: false,
      },
    ]);
    setActiveTabId(id);
  }

  function closeTab(tabId: string) {
    const socket = getSocket();
    const target = tabs.find((tab) => tab.id === tabId);
    if (!target) return;

    if (target.terminalId && socket?.connected) {
      socket.emit(WsEvent.TERMINAL_KILL, {
        terminalId: target.terminalId,
      });
    }

    const nextTabs = tabs.filter((tab) => tab.id !== tabId);

    if (nextTabs.length === 0) {
      setTabs([{ id: "tab-1", title: "Terminal", terminalId: null, ready: false }]);
      setActiveTabId("tab-1");
      return;
    }

    setTabs(nextTabs);

    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  }

  function killActiveTerminal() {
    const socket = getSocket();
    if (!socket?.connected || !activeTab?.terminalId) return;

    socket.emit(WsEvent.TERMINAL_KILL, {
      terminalId: activeTab.terminalId,
    });
  }

  function restartActiveTerminal() {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, terminalId: null, ready: false }
          : tab
      )
    );

    window.setTimeout(() => {
      spawnTerminal(activeTabId);
    }, 50);
  }

  function runSearchNext() {
    if (!searchValue.trim()) return;
    searchAddonRef.current?.findNext(searchValue, {
      caseSensitive: false,
      incremental: true,
    });
  }

  function runSearchPrev() {
    if (!searchValue.trim()) return;
    searchAddonRef.current?.findPrevious(searchValue, {
      caseSensitive: false,
      incremental: true,
    });
  }

  /** Send a command string to the active terminal as if the user typed it. */
  function sendCommand(command: string) {
    const socket = getSocket();
    const currentTab = tabsRef.current.find((t) => t.id === activeTabRef.current);
    if (!socket?.connected || !currentTab?.terminalId) return;

    // Clear the current line, type the command, and press Enter
    socket.emit(WsEvent.TERMINAL_DATA, {
      terminalId: currentTab.terminalId,
      data: command + "\r",
    });

    xtermRef.current?.focus();
  }

  function runTests() {
    sendCommand("npm test");
  }

  return (
    <div className="flex h-full flex-col border-t border-white/10 bg-[#0a0f1b]">
      <div className="flex h-9 items-center border-b border-white/10 bg-[#0e1627]">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active = tab.id === activeTabId;

            return (
              <div
                key={tab.id}
                className={[
                  "group flex h-9 min-w-[120px] max-w-[180px] items-center gap-2 border-r border-white/10 px-3 text-xs",
                  active ? "bg-[#111b2e] text-white" : "text-white/50 hover:bg-white/5",
                ].join(" ")}
              >
                <button
                  onClick={() => setActiveTabId(tab.id)}
                  className="min-w-0 flex-1 truncate text-left"
                >
                  {tab.title}
                  {!tab.ready ? " •" : ""}
                </button>

                {tabs.length > 1 && (
                  <button
                    onClick={() => closeTab(tab.id)}
                    className="text-white/35 opacity-0 transition group-hover:opacity-100 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1 px-2">
          <button
            onClick={runTests}
            disabled={!activeTab?.ready}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-emerald-300/80 hover:text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Run tests (npm test)"
          >
            <Play size={11} />
            <span>Run</span>
          </button>

          <div className="h-3.5 w-px bg-white/10 mx-0.5" />

          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="icon-btn"
            title="Search terminal"
          >
            <Search size={14} />
          </button>

          <button
            onClick={createNewTab}
            className="icon-btn"
            title="New terminal"
          >
            <Plus size={14} />
          </button>

          <button
            onClick={restartActiveTerminal}
            className="icon-btn"
            title="Restart terminal"
          >
            <RefreshCw size={14} />
          </button>

          <button
            onClick={killActiveTerminal}
            className="icon-btn"
            title="Kill terminal"
          >
            <Square size={13} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#0c1424] px-2 py-1.5">
          <input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearchNext();
              if (e.key === "Escape") setSearchOpen(false);
            }}
            placeholder="Find in terminal..."
            className="ide-input flex-1 text-xs"
          />
          <button onClick={runSearchPrev} className="terminal-action-btn">
            Prev
          </button>
          <button onClick={runSearchNext} className="terminal-action-btn">
            Next
          </button>
        </div>
      )}

      <div className="flex h-8 items-center justify-between border-b border-white/10 bg-[#0b1020] px-3 text-[11px] text-white/40">
        <span>{socketLabel}</span>
        <span>{activeTab?.ready ? "Interactive shell" : "Idle / starting..."}</span>
      </div>

      <div ref={hostRef} className="min-h-0 flex-1 px-2 py-1" />
    </div>
  );
}