import { io, Socket } from "socket.io-client";
import { WsEvent } from "./types";

const WS_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
).replace(/\/api\/?$/, "");

let socket: Socket | null = null;
let hasLoggedError = false;

let currentSessionId: string | null = null;
let currentToken: string | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function getSocketContext() {
  return {
    sessionId: currentSessionId,
    token: currentToken,
  };
}

function attachBaseListeners(target: Socket) {
  target.on("connect", () => {
    hasLoggedError = false;
    console.log("[ws] Connected:", target.id);
  });

  target.on("disconnect", (reason) => {
    console.log("[ws] Disconnected:", reason);
  });

  target.on("connect_error", (err) => {
    if (!hasLoggedError) {
      console.warn("[ws] Connection failed — falling back to REST:", err.message);
      hasLoggedError = true;
    }
  });

  target.on(WsEvent.ERROR, (data: { message: string }) => {
    console.error("[ws] Server error:", data.message);
  });
}

export function connectSocket(token: string, sessionId: string): Socket {
  currentToken = token;
  currentSessionId = sessionId;

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

  attachBaseListeners(socket);

  return socket;
}

export function reconnectSocketWithToken(token: string): Socket | null {
  if (!currentSessionId) {
    return null;
  }

  currentToken = token;

  if (!socket) {
    return connectSocket(token, currentSessionId);
  }

  socket.auth = { token };

  const currentQuery = socket.io.opts.query;
  socket.io.opts.query =
    typeof currentQuery === "object" && currentQuery
      ? { ...currentQuery, sessionId: currentSessionId }
      : { sessionId: currentSessionId };

  if (socket.connected) {
    socket.disconnect();
  }

  socket.connect();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = null;
  currentSessionId = null;
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