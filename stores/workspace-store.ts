// stores/workspace-store.ts
import { create } from "zustand";
import type { TeamTicket } from "@/lib/types";

export type TicketData = {
  id: string;
  sequence: number;
  title: string;
  brief: string;
  estimatedMinutes: number;
  hasStandup: boolean;
};

type SimulationData = {
  id: string;
  title: string;
  description: string;
  stack: string;
  difficulty: string;
  experienceType: string;
  estimatedMinutes: number;
  teamConfig: Record<string, unknown>;
  tickets: TicketData[];
};

type SessionData = {
  id: string;
  simulationId: string;
  status: string;
  currentTicketSeq: number;
  spriteId: string | null;
  simulation?: SimulationData;
  teamTickets?: TeamTicket[];
};

type WorkspaceStore = {
  session: SessionData | null;
  connected: boolean;
  files: string[];
  activeFile: string | null;
  fileContent: string;
  teamTickets: TeamTicket[];
  currentTicket: TicketData | null;

  setSession: (s: SessionData) => void;
  setConnected: (c: boolean) => void;
  setFiles: (f: string[]) => void;
  setActiveFile: (f: string | null) => void;
  setFileContent: (c: string) => void;
  setTeamTickets: (t: TeamTicket[]) => void;
  updateTicketSeq: (seq: number) => void;
  reset: () => void;
};

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  session: null,
  connected: false,
  files: [],
  activeFile: null,
  fileContent: "",
  teamTickets: [],
  currentTicket: null,

  setSession: (session) => {
    const tickets = session.simulation?.tickets ?? [];
    const ticket = tickets.find((t) => t.sequence === session.currentTicketSeq) ?? null;
    set({ session, currentTicket: ticket });
  },

  setConnected: (connected) => set({ connected }),
  setFiles: (files) => set({ files }),
  setActiveFile: (activeFile) => set({ activeFile, fileContent: "" }),
  setFileContent: (fileContent) => set({ fileContent }),
  setTeamTickets: (teamTickets) => set({ teamTickets }),

  updateTicketSeq: (seq) => {
    const { session } = get();
    if (!session) return;
    const tickets = session.simulation?.tickets ?? [];
    const ticket = tickets.find((t) => t.sequence === seq) ?? null;
    set({
      session: { ...session, currentTicketSeq: seq },
      currentTicket: ticket,
    });
  },

  reset: () =>
    set({
      session: null,
      connected: false,
      files: [],
      activeFile: null,
      fileContent: "",
      teamTickets: [],
      currentTicket: null,
    }),
}));