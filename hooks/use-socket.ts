// hooks/use-socket.ts
"use client";

import { useEffect, useRef } from "react";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useChatStore } from "@/stores/chat-store";
import type { ChatMessage, TeamTicket } from "@/lib/types";

export function useWorkspaceSocket(sessionId: string, token: string | null) {
  const initialized = useRef(false);
  const { setConnected, setFiles, setTeamTickets, setFileContent, updateTicketSeq } =
    useWorkspaceStore();
  const { setMessages, addMessage, setTyping } = useChatStore();

  useEffect(() => {
    if (!token || !sessionId || initialized.current) return;
    initialized.current = true;

    const socket = connectSocket(token, sessionId);

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // Initial data
    socket.on("chat:history", (data: ChatMessage[]) => setMessages(data));
    socket.on("file:list", (data: string[]) => setFiles(data));
    socket.on("board:update", (data: { teamTickets?: TeamTicket[]; currentTicketSeq?: number }) => {
      if (data.teamTickets) setTeamTickets(data.teamTickets);
      if (data.currentTicketSeq) updateTicketSeq(data.currentTicketSeq);
    });

    // Live updates
    socket.on("chat:message", (msg: ChatMessage) => addMessage(msg));
    socket.on("chat:typing", (data: { sender: string }) => {
      setTyping(data.sender);
      setTimeout(() => setTyping(null), 3000);
    });
    socket.on("file:changed", (data: { path: string; content: string }) => {
      const store = useWorkspaceStore.getState();
      if (data.path === store.activeFile) {
        setFileContent(data.content);
      }
    });
    socket.on("session:status", (data: { status: string; currentTicketSeq?: number }) => {
      if (data.currentTicketSeq) updateTicketSeq(data.currentTicketSeq);
    });

    return () => {
      disconnectSocket();
      initialized.current = false;
    };
  }, [token, sessionId]);

  return getSocket();
}