// lib/socket.ts
import { io, Socket } from "socket.io-client";
import { WsEvent } from "./types";

const WS_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
).replace(/\/api\/?$/, "");

let socket: Socket | null = null;
let hasLoggedError = false;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string, sessionId: string): Socket {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  hasLoggedError = false;

  socket = io(WS_URL, {
    path: "/ws",
    auth: { token },
    query: { sessionId },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 5000,
  });

  socket.on("connect", () => {
    hasLoggedError = false;
    console.log("[ws] Connected:", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[ws] Disconnected:", reason);
  });

  // Only log connection error once to avoid spam
  socket.on("connect_error", (err) => {
    if (!hasLoggedError) {
      console.warn("[ws] Connection failed — falling back to REST:", err.message);
      hasLoggedError = true;
    }
  });

  socket.on(WsEvent.ERROR, (data: { message: string }) => {
    console.error("[ws] Server error:", data.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function emitEvent(event: WsEvent, data?: unknown) {
  if (!socket?.connected) return;
  socket.emit(event, data);
}

export function onEvent<T = unknown>(
  event: WsEvent,
  handler: (data: T) => void
): () => void {
  if (!socket) return () => {};

  socket.on(event, handler as (...args: unknown[]) => void);
  return () => {
    socket?.off(event, handler as (...args: unknown[]) => void);
  };
}