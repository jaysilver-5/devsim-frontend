"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  reconnectSocketWithToken,
} from "@/lib/socket";
import { WsEvent } from "@/lib/types";
import type { ChatMessage, TeamTicket } from "@/lib/types";

type Ticket = {
  id: string;
  sequence: number;
  title: string;
  brief: string;
  estimatedMinutes: number;
  hasStandup?: boolean;
  status?: string;
};

type Simulation = {
  id: string;
  title: string;
  stack: string;
  tickets: Ticket[];
};

type WorkspaceSessionData = {
  id: string;
  status: string;
  currentTicketSeq: number;
  spriteId: string | null;
  simulation?: Simulation | null;
  teamTickets?: TeamTicket[];
};

export type UseWorkspaceSessionReturn = {
  token: string | null;
  loading: boolean;
  connected: boolean;
  hasContainer: boolean;
  session: WorkspaceSessionData | null;
  messages: ChatMessage[];
  chatInput: string;
  chatSending: boolean;
  teamTickets: TeamTicket[];
  setChatInput: (value: string) => void;
  sendChat: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

export default function useWorkspaceSession(
  sessionId: string
): UseWorkspaceSessionReturn {
  const { getToken } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const [session, setSession] = useState<WorkspaceSessionData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [teamTickets, setTeamTickets] = useState<TeamTicket[]>([]);

  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  const mountedRef = useRef(false);

  const hasContainer = !!session?.spriteId;

  const getFreshTokens = useCallback(async () => {
    const primary = await getToken();
    if (!primary) {
      throw new Error("Missing auth token");
    }

    const retry = await getToken({ skipCache: true }).catch(() => primary);

    setToken(primary);

    return {
      token: primary,
      retryToken: retry || primary,
    };
  }, [getToken]);

  const cleanupSocketListeners = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.off("connect");
    socket.off("disconnect");
    socket.off(WsEvent.CHAT_MESSAGE);
    socket.off(WsEvent.CHAT_HISTORY);
    socket.off(WsEvent.BOARD_UPDATE);
    socket.off(WsEvent.SESSION_UPDATE);
  }, []);

  const bindSocketListeners = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.off("connect");
    socket.off("disconnect");
    socket.off(WsEvent.CHAT_MESSAGE);
    socket.off(WsEvent.CHAT_HISTORY);
    socket.off(WsEvent.BOARD_UPDATE);
    socket.off(WsEvent.SESSION_UPDATE);

    socket.on("connect", () => {
      if (!mountedRef.current) return;
      setConnected(true);
    });

    socket.on("disconnect", () => {
      if (!mountedRef.current) return;
      setConnected(false);
    });

    socket.on(WsEvent.CHAT_MESSAGE, (msg: ChatMessage) => {
      if (!mountedRef.current) return;

      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    });

    socket.on(WsEvent.CHAT_HISTORY, (data: ChatMessage[]) => {
      if (!mountedRef.current || !Array.isArray(data)) return;
      setMessages(data);
    });

    socket.on(WsEvent.BOARD_UPDATE, (data: { teamTickets?: TeamTicket[] }) => {
      if (!mountedRef.current || !Array.isArray(data?.teamTickets)) return;
      setTeamTickets(data.teamTickets);
    });

    socket.on(WsEvent.SESSION_UPDATE, (data: Partial<WorkspaceSessionData>) => {
      if (!mountedRef.current) return;

      setSession((prev) => (prev ? { ...prev, ...data } : prev));

      if (Array.isArray(data.teamTickets)) {
        setTeamTickets(data.teamTickets);
      }
    });

    setConnected(socket.connected);
  }, []);

  const ensureSocketConnection = useCallback(
    async (freshToken: string) => {
      const existing = getSocket();

      if (!existing) {
        connectSocket(freshToken, sessionId);
        bindSocketListeners();
        return;
      }

      reconnectSocketWithToken(freshToken);
      bindSocketListeners();
    },
    [bindSocketListeners, sessionId]
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      cleanupSocketListeners();
      disconnectSocket();
    };
  }, [cleanupSocketListeners]);

  const refreshSession = useCallback(async () => {
    try {
      const { token, retryToken } = await getFreshTokens();

      const sess = (await api.workspace.getSession(
        sessionId,
        token,
        retryToken
      )) as WorkspaceSessionData;

      if (!mountedRef.current) return;

      setSession(sess);
      setTeamTickets(sess.teamTickets ?? []);

      await ensureSocketConnection(token);
    } catch (err) {
      console.error("[workspace] Refresh failed:", err);
    }
  }, [ensureSocketConnection, getFreshTokens, sessionId]);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim()) return;

    const content = chatInput.trim();
    setChatSending(true);
    setChatInput("");

    const mentionMatch = content.match(/@(sarah|marcus|priya|james)/i);
    const target = mentionMatch ? mentionMatch[1].toUpperCase() : "PM";

    const optimisticId = `local-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        sessionId,
        sender: "CANDIDATE",
        content,
        metadata: {},
        createdAt: new Date().toISOString(),
      } as ChatMessage,
    ]);

    try {
      const { token, retryToken } = await getFreshTokens();

      const result = (await api.chat.sendMessage(
        sessionId,
        content,
        target,
        token,
        retryToken
      )) as any;

      if (!mountedRef.current) return;

      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== optimisticId);
        const next = [...without];

        const userMessage = result.userMessage ?? result.candidateMessage;

        if (userMessage && !next.some((m) => m.id === userMessage.id)) {
          next.push(userMessage);
        }

        if (result.aiMessage && !next.some((m) => m.id === result.aiMessage.id)) {
          next.push(result.aiMessage);
        }

        if (Array.isArray(result)) {
          result.forEach((m: ChatMessage) => {
            if (!next.some((x) => x.id === m.id)) next.push(m);
          });
        }

        return next;
      });

      await ensureSocketConnection(token);
    } catch (err) {
      console.error("[workspace] Chat send failed:", err);

      if (!mountedRef.current) return;

      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setChatInput(content);
    } finally {
      if (mountedRef.current) {
        setChatSending(false);
      }
    }
  }, [chatInput, ensureSocketConnection, getFreshTokens, sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        setLoading(true);

        const { token, retryToken } = await getFreshTokens();

        const sess = (await api.workspace.getSession(
          sessionId,
          token,
          retryToken
        )) as WorkspaceSessionData;

        if (cancelled || !mountedRef.current) return;

        setSession(sess);
        setTeamTickets(sess.teamTickets ?? []);

        try {
          let history = (await api.chat.getHistory(
            sessionId,
            token,
            retryToken
          )) as ChatMessage[];

          if (history.length === 0) {
            try {
              await api.workspace.sendWelcome(sessionId, token, retryToken);
              history = (await api.chat.getHistory(
                sessionId,
                token,
                retryToken
              )) as ChatMessage[];
            } catch {
              // non-fatal
            }
          }

          if (!cancelled && mountedRef.current) {
            setMessages(history);
          }
        } catch (err) {
          console.warn("[workspace] Chat history failed:", err);
        }

        await ensureSocketConnection(token);
      } catch (err) {
        console.error("[workspace] Boot failed:", err);
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    }

    boot();

    return () => {
      cancelled = true;
      cleanupSocketListeners();
    };
  }, [cleanupSocketListeners, ensureSocketConnection, getFreshTokens, sessionId]);

  return useMemo(
    () => ({
      token,
      loading,
      connected,
      hasContainer,
      session,
      messages,
      chatInput,
      chatSending,
      teamTickets,
      setChatInput,
      sendChat,
      refreshSession,
    }),
    [
      token,
      loading,
      connected,
      hasContainer,
      session,
      messages,
      chatInput,
      chatSending,
      teamTickets,
      sendChat,
      refreshSession,
    ]
  );
}