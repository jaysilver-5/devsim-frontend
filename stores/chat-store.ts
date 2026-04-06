// stores/chat-store.ts
import { create } from "zustand";
import type { ChatMessage } from "@/lib/types";

type ChatStore = {
  messages: ChatMessage[];
  typingSender: string | null;

  setMessages: (msgs: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  setTyping: (sender: string | null) => void;
  reset: () => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  typingSender: null,

  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setTyping: (typingSender) => set({ typingSender }),
  reset: () => set({ messages: [], typingSender: null }),
}));