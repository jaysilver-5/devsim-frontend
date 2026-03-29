"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { WsEvent } from "@/lib/types";

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
  teamTickets?: Ticket[];
};

type ChatMessage = {
  id: string;
  content: string;
  persona?: string;
  personaName?: string;
  createdAt?: string;
};

type UseWorkspaceSessionReturn = {
  token: string | null;
  loading: boolean;
  connected: boolean;
  session: WorkspaceSessionData | null;
  messages: ChatMessage[];
  chatInput: string;
  chatSending: boolean;
  teamTickets: Ticket[];
  setChatInput: (value: string) => void;
  sendChat: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

async function safeJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export default function useWorkspaceSession(
  sessionId: string
): UseWorkspaceSessionReturn {
  const { getToken } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const [session, setSession] = useState<WorkspaceSessionData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [teamTickets, setTeamTickets] = useState<Ticket[]>([]);

  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  const apiBase = useMemo(() => {
    return (
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
      "http://localhost:4000/api"
    );
  }, []);

  const authHeaders = useCallback(
    (bearer?: string | null) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (bearer) {
        headers.Authorization = `Bearer ${bearer}`;
      }

      return headers;
    },
    []
  );

  const fetchSession = useCallback(
    async (bearer: string) => {
      const res = await fetch(`${apiBase}/workspace/sessions/${sessionId}`, {
        method: "GET",
        headers: authHeaders(bearer),
        cache: "no-store",
      });

      return safeJson<WorkspaceSessionData>(res);
    },
    [apiBase, authHeaders, sessionId]
  );

  const fetchMessages = useCallback(
    async (bearer: string) => {
      const possibleEndpoints = [
        `${apiBase}/chat/sessions/${sessionId}/messages`,
        `${apiBase}/chat/${sessionId}/messages`,
        `${apiBase}/workspace/sessions/${sessionId}/messages`,
      ];

      for (const url of possibleEndpoints) {
        try {
          const res = await fetch(url, {
            method: "GET",
            headers: authHeaders(bearer),
            cache: "no-store",
          });

          if (!res.ok) continue;

          const data = (await res.json()) as ChatMessage[] | { messages?: ChatMessage[] };
          if (Array.isArray(data)) return data;
          if (Array.isArray(data?.messages)) return data.messages;
        } catch {
          continue;
        }
      }

      return [] as ChatMessage[];
    },
    [apiBase, authHeaders, sessionId]
  );

  const refreshSession = useCallback(async () => {
    if (!token) return;

    try {
      const nextSession = await fetchSession(token);
      setSession(nextSession);
      setTeamTickets(nextSession.teamTickets ?? []);
    } catch (error) {
      console.error("[workspace] failed to refresh session", error);
    }
  }, [fetchSession, token]);

  const sendChat = useCallback(async () => {
    if (!token || !chatInput.trim()) return;

    const content = chatInput.trim();
    setChatSending(true);
    setChatInput("");

    const optimisticMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      content,
      personaName: "You",
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const possibleEndpoints = [
      `${apiBase}/chat/sessions/${sessionId}/messages`,
      `${apiBase}/chat/${sessionId}/messages`,
      `${apiBase}/workspace/sessions/${sessionId}/messages`,
    ];

    try {
      let sent = false;

      for (const url of possibleEndpoints) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify({ content }),
          });

          if (!res.ok) continue;

          sent = true;
          break;
        } catch {
          continue;
        }
      }

      if (!sent) {
        throw new Error("Unable to send message");
      }
    } catch (error) {
      console.error("[workspace] failed to send chat", error);
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
      setChatInput(content);
    } finally {
      setChatSending(false);
    }
  }, [apiBase, authHeaders, chatInput, sessionId, token]);

  useEffect(() => {
    let mounted = true;

    getToken()
      .then((value) => {
        if (!mounted) return;
        setToken(value ?? null);
      })
      .catch((error) => {
        console.error("[workspace] failed to get token", error);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [getToken]);

    useEffect(() => {
    if (!token) return;

    const bearer = token;
    let mounted = true;

    async function boot() {
        try {
        setLoading(true);

        const [nextSession, nextMessages] = await Promise.all([
            fetchSession(bearer),
            fetchMessages(bearer),
        ]);

        if (!mounted) return;

        setSession(nextSession);
        setTeamTickets(nextSession.teamTickets ?? []);
        setMessages(nextMessages);

        const socket = connectSocket(bearer, sessionId);

        const handleConnect = () => {
            if (!mounted) return;
            setConnected(true);
        };

        const handleDisconnect = () => {
            if (!mounted) return;
            setConnected(false);
        };

        const handleChatMessage = (payload: ChatMessage) => {
            if (!mounted) return;
            setMessages((prev) => {
            if (prev.some((msg) => msg.id === payload.id)) return prev;
            return [...prev, payload];
            });
        };

        const handleChatHistory = (payload: ChatMessage[]) => {
            if (!mounted || !Array.isArray(payload)) return;
            setMessages(payload);
        };

        const handleBoardUpdate = (payload: { teamTickets?: Ticket[] }) => {
            if (!mounted) return;
            if (Array.isArray(payload?.teamTickets)) {
            setTeamTickets(payload.teamTickets);
            }
        };

        const handleSessionUpdate = (payload: Partial<WorkspaceSessionData>) => {
            if (!mounted) return;
            setSession((prev) => {
            if (!prev) return prev;
            const merged = { ...prev, ...payload };
            if (Array.isArray(payload.teamTickets)) {
                merged.teamTickets = payload.teamTickets;
            }
            return merged;
            });

            if (Array.isArray(payload.teamTickets)) {
            setTeamTickets(payload.teamTickets);
            }
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on(WsEvent.CHAT_MESSAGE, handleChatMessage);
        socket.on(WsEvent.CHAT_HISTORY, handleChatHistory);
        socket.on(WsEvent.BOARD_UPDATE, handleBoardUpdate);
        socket.on(WsEvent.SESSION_UPDATE, handleSessionUpdate);

        setConnected(socket.connected);
        } catch (error) {
        console.error("[workspace] failed to boot session", error);
        } finally {
        if (mounted) setLoading(false);
        }
    }

    void boot();

    return () => {
        mounted = false;
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
    }, [fetchMessages, fetchSession, sessionId, token]);

  return {
    token,
    loading,
    connected,
    session,
    messages,
    chatInput,
    chatSending,
    teamTickets,
    setChatInput,
    sendChat,
    refreshSession,
  };
}