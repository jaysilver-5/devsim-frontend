import { io, Socket } from "socket.io-client";
import { WsEvent } from "./types";

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string, sessionId: string): Socket {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(WS_URL, {
    path: "/ws",
    auth: { token },
    query: { sessionId },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    console.log("[ws] Connected:", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[ws] Disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("[ws] Connection error:", err.message);
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
  if (!socket?.connected) {
    console.warn("[ws] Cannot emit, not connected");
    return;
  }
  socket.emit(event, data);
}

export function onEvent<T = unknown>(
  event: WsEvent,
  handler: (data: T) => void
): () => void {
  if (!socket) {
    console.warn("[ws] Cannot listen, no socket");
    return () => {};
  }

  socket.on(event, handler as (...args: unknown[]) => void);

  return () => {
    socket?.off(event, handler as (...args: unknown[]) => void);
  };
}