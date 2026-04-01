"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
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

  const socketCleanupRef = useRef<(() => void) | null>(null);

  const hasContainer = !!session?.spriteId;

  const getFreshToken = useCallback(async () => {
    const fresh = await getToken();
    if (!fresh) {
      throw new Error("Missing auth token");
    }
    setToken(fresh);
    return fresh;
  }, [getToken]);

  useEffect(() => {
    let mounted = true;

    getFreshToken()
      .catch((err) => {
        console.error("[workspace] Failed to get token:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [getFreshToken]);

  const refreshSession = useCallback(async () => {
    try {
      const freshToken = await getFreshToken();
      const sess = (await api.workspace.getSession(
        sessionId,
        freshToken
      )) as WorkspaceSessionData;

      setSession(sess);
      setTeamTickets(sess.teamTickets ?? []);
    } catch (err) {
      console.error("[workspace] Refresh failed:", err);
    }
  }, [getFreshToken, sessionId]);

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
      const freshToken = await getFreshToken();
      const result = (await api.chat.sendMessage(
        sessionId,
        content,
        target,
        freshToken
      )) as any;

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
    } catch (err) {
      console.error("[workspace] Chat send failed:", err);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setChatInput(content);
    } finally {
      setChatSending(false);
    }
  }, [chatInput, getFreshToken, sessionId]);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        setLoading(true);

        const freshToken = await getFreshToken();

        const sess = (await api.workspace.getSession(
          sessionId,
          freshToken
        )) as WorkspaceSessionData;

        if (!mounted) return;

        setSession(sess);
        setTeamTickets(sess.teamTickets ?? []);

        try {
          let history = (await api.chat.getHistory(
            sessionId,
            freshToken
          )) as ChatMessage[];

          if (history.length === 0) {
            try {
              await api.workspace.sendWelcome(sessionId, freshToken);
              history = (await api.chat.getHistory(
                sessionId,
                freshToken
              )) as ChatMessage[];
            } catch {
              // non-fatal
            }
          }

          if (mounted) setMessages(history);
        } catch (err) {
          console.warn("[workspace] Chat history failed:", err);
        }

        socketCleanupRef.current?.();

        const socket = connectSocket(freshToken, sessionId);

        socket.on("connect", () => {
          if (mounted) setConnected(true);
        });

        socket.on("disconnect", () => {
          if (mounted) setConnected(false);
        });

        socket.on(WsEvent.CHAT_MESSAGE, (msg: ChatMessage) => {
          if (!mounted) return;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        });

        socket.on(WsEvent.CHAT_HISTORY, (data: ChatMessage[]) => {
          if (mounted && Array.isArray(data)) setMessages(data);
        });

        socket.on(WsEvent.BOARD_UPDATE, (data: { teamTickets?: TeamTicket[] }) => {
          if (mounted && Array.isArray(data?.teamTickets)) {
            setTeamTickets(data.teamTickets);
          }
        });

        socket.on(WsEvent.SESSION_UPDATE, (data: Partial<WorkspaceSessionData>) => {
          if (!mounted) return;
          setSession((prev) => (prev ? { ...prev, ...data } : prev));
          if (Array.isArray(data.teamTickets)) {
            setTeamTickets(data.teamTickets);
          }
        });

        if (mounted) setConnected(socket.connected);
      } catch (err) {
        console.error("[workspace] Boot failed:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    boot();

    return () => {
      mounted = false;
      socketCleanupRef.current?.();
      socketCleanupRef.current = null;

      const socket = getSocket();
      if (socket) {
        socket.off("connect");
        socket.off("disconnect");
        socket.off(WsEvent.CHAT_MESSAGE);
        socket.off(WsEvent.CHAT_HISTORY);
        socket.off(WsEvent.BOARD_UPDATE);
        socket.off(WsEvent.SESSION_UPDATE);
      }

      disconnectSocket();
    };
  }, [getFreshToken, sessionId]);

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