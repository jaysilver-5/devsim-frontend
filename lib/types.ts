// lib/types.ts
// ─── Enums (mirrored from backend) ────────────────────

export type Role = "LEARNER" | "INSTRUCTOR" | "HIRING_MANAGER" | "CANDIDATE" | "ADMIN";
export type Plan = "FREE" | "STARTER" | "PRO" | "CUSTOM";

export type Stack =
  | "NODE_EXPRESS_PRISMA"
  | "PYTHON_FASTAPI"
  | "PYTHON_DJANGO"
  | "GO_GIN"
  | "JAVA_SPRING"
  | "REACT_NEXTJS"
  | "REACT_VITE"
  | "VUE_NUXT"
  | "SVELTE_KIT"
  | "FULLSTACK_NEXTJS"
  | "FULLSTACK_REMIX"
  | "CYBER_PENTEST"
  | "CYBER_INCIDENT_RESPONSE"
  | "CYBER_SECURE_CODE";

export type Track = "BACKEND" | "FRONTEND" | "FULLSTACK" | "CYBERSECURITY";
export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type ExperienceType = "SESSION" | "SPRINT";
export type SimStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type SessionStatus = "ACTIVE" | "PAUSED" | "STANDUP_PENDING" | "COMPLETED" | "ABANDONED";
export type ChatSender = "CANDIDATE" | "PM" | "SARAH" | "MARCUS" | "PRIYA" | "JAMES" | "SYSTEM";
export type TeamTicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED";
export type StandupStatus = "PENDING" | "ACTIVE" | "COMPLETE";
export type AssessmentStatus = "ACTIVE" | "CLOSED" | "ARCHIVED";
export type CandidateStatus = "INVITED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
export type CreditType = "SPRINT" | "ASSESSOR";

// ─── Core models ──────────────────────────────────────

export interface User {
  id: string;
  clerkId: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
  plan: Plan;
  sprintCreditsMonthly: number;
  sprintCreditsBonus: number;
  assessorCredits: number;
  freeSessionsUsed: number;
  freeSprintsUsed: number;
}

export interface Simulation {
  id: string;
  title: string;
  description: string;
  stack: Stack;
  difficulty: Difficulty;
  experienceType: ExperienceType;
  estimatedMinutes: number;
  status: SimStatus;
  teamConfig: TeamConfig;
}

export interface Ticket {
  id: string;
  simulationId: string;
  sequence: number;
  title: string;
  brief: string;
  testFiles: string[];
  estimatedMinutes: number;
  hasStandup: boolean;
}

export interface WorkspaceSession {
  id: string;
  userId: string;
  simulationId: string;
  status: SessionStatus;
  currentTicketSeq: number;
  spriteId: string | null;
  boardState: Record<string, unknown>;
  startedAt: string;
  lastActiveAt: string;
  completedAt: string | null;
  simulation?: Simulation;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: ChatSender;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TeamTicket {
  id: string;
  sessionId: string;
  assignee: ChatSender;
  ticketCode: string;
  title: string;
  description: string;
  status: TeamTicketStatus;
  unlocksAfterTicketSeq: number;
}

export interface EvaluationReport {
  id: string;
  sessionId: string;
  codeScores: Record<string, number>;
  communicationScores: Record<string, number>;
  standupScores: Record<string, number>;
  collaborationScores: Record<string, number>;
  integrityScore: number;
  overallScore: number;
  aiSummary: string;
}

export interface Assessment {
  id: string;
  creatorId: string;
  simulationId: string;
  title: string;
  inviteCode: string;
  status: AssessmentStatus;
  simulation?: Simulation;
  candidates?: AssessmentCandidate[];
  _count?: { candidates: number };
}

export interface AssessmentCandidate {
  id: string;
  assessmentId: string;
  userId: string;
  sessionId: string | null;
  status: CandidateStatus;
  user?: Pick<User, "id" | "email" | "username" | "displayName" | "avatarUrl">;
  session?: WorkspaceSession & { report?: EvaluationReport };
}

// ─── Persona config ───────────────────────────────────

export interface PersonaConfig {
  name: string;
  role: string;
  personality: string;
  avatar: string;
}

export interface TeamConfig {
  personas: Record<string, PersonaConfig>;
  standupSchedule: { standupNumber: number; afterTicketSeq: number }[];
}

// ─── Billing ──────────────────────────────────────────

export interface BillingInfo {
  plan: Plan;
  planLabel: string;
  monthlyCents: number;
  sprintCreditsMonthly: number;
  sprintCreditsBonus: number;
  sprintCreditsTotal: number;
  monthlyAllocation: number;
  freeSessionsUsed: number;
  freeSessionsTotal: number;
  freeSprintsUsed: number;
  freeSprintsTotal: number;
  assessorCredits: number;
  assessorCandidatesUsed: number;
  assessorFreeLimit: number;
  currentPeriodStart: string | null;
  sprintPacks: CreditPack[];
  assessorPacks: CreditPack[];
}

export interface CreditPack {
  credits: number;
  cents: number;
  label: string;
  perUnit: string;
  role?: Role;
}

// ─── WebSocket events ─────────────────────────────────

export enum WsEvent {
  TERMINAL_DATA = "terminal:data",
  TERMINAL_RESIZE = "terminal:resize",
  TERMINAL_SPAWN = "terminal:spawn",
  TERMINAL_KILL = "terminal:kill",
  TERMINAL_OUTPUT = "terminal:output",
  TERMINAL_EXIT = "terminal:exit",
  CHAT_MESSAGE = "chat:message",
  CHAT_TYPING = "chat:typing",
  CHAT_HISTORY = "chat:history",
  BOARD_UPDATE = "board:update",
  FILE_SYNC = "file:sync",
  FILE_CHANGED = "file:changed",
  FILE_LIST = "file:list",
  FILE_READ = "file:read",
  BEHAVIORAL_EVENT = "behavioral:event",
  SESSION_UPDATE = "session:update",
  SESSION_STATUS = "session:status",

  // ═══ Standup — streaming voice pipeline ═══════════
  STANDUP_BEGIN = "standup:begin",
  STANDUP_PM_SPEAKING = "standup:pm_speaking",
  STANDUP_READY = "standup:ready",
  STANDUP_AUDIO_CHUNK = "standup:audio_chunk",
  STANDUP_INTERIM = "standup:interim",
  STANDUP_END_TURN = "standup:end_turn",
  STANDUP_PROCESSING = "standup:processing",
  STANDUP_TURN_RESULT = "standup:turn_result",
  STANDUP_COMPLETE = "standup:complete",
  STANDUP_STATE = "standup:state",
  STANDUP_ERROR = "standup:error",

  // NEW — streaming audio chunks (replaces Cloudinary URLs)
  STANDUP_PM_AUDIO_CHUNK = "standup:pm_audio_chunk",
  STANDUP_PM_AUDIO_END = "standup:pm_audio_end",

  // NEW — VAD auto-end (server detected silence)
  STANDUP_VAD_SPEECH_END = "standup:vad_speech_end",

  // NEW — deferred scoring
  STANDUP_SCORE_READY = "standup:score_ready",

  // Legacy aliases
  STANDUP_START = "standup:start",
  STANDUP_PM_AUDIO = "standup:pm_audio",
  STANDUP_CANDIDATE_AUDIO = "standup:candidate_audio",
  STANDUP_TRANSCRIPT = "standup:transcript",

  ERROR = "error",
}

export interface StandupRealtimeBootstrap {
  provider: 'openai-realtime';
  standupId: string;
  turnNumber: number;
  strategy: string;
  openingLine: string;
  ticketTitle: string;
  ticketBrief: string;
  clientSecret: {
    client_secret?: { value: string; expires_at: number };
    session?: Record<string, unknown>;
  };
}
