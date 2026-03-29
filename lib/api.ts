// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
  params?: Record<string, string>;
};

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, token, params } = options;

  let url = `${API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const fetchHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    fetchHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers: fetchHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      data.message || `API error: ${res.status}`,
      data
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ═══════════════════════════════════════════════════════
// AUTH — /auth
// ═══════════════════════════════════════════════════════

const auth = {
  // POST /auth/set-role — set user role during onboarding
  setRole: (role: string, token: string) =>
    request("/auth/set-role", { method: "POST", body: { role }, token }),

  // GET /auth/profile — get current user profile
  getProfile: (token: string) =>
    request("/auth/profile", { token }),
};

// ═══════════════════════════════════════════════════════
// SIMULATIONS — /simulations
// ═══════════════════════════════════════════════════════

const simulations = {
  // GET /simulations — list all published simulations (public)
  list: (filters?: { stack?: string; difficulty?: string; experienceType?: string }, token?: string) =>
    request("/simulations", {
      token: token || undefined,
      params: filters as Record<string, string> | undefined,
    }),

  // GET /simulations/:id — get single simulation (public)
  get: (id: string, token?: string) =>
    request(`/simulations/${id}`, { token: token || undefined }),
};

// ═══════════════════════════════════════════════════════
// WORKSPACE — /workspace
// ═══════════════════════════════════════════════════════

const workspace = {
  // POST /workspace/sessions — start a new session
  startSession: (simulationId: string, token: string) =>
    request("/workspace/sessions", {
      method: "POST",
      body: { simulationId },
      token,
    }),

  // GET /workspace/sessions/by-sim/:simulationId — get user's session for a sim
  getSessionBySim: (simulationId: string, token: string) =>
    request(`/workspace/sessions/by-sim/${simulationId}`, { token }),

  // GET /workspace/sessions/:id — get session by id
  getSession: (sessionId: string, token: string) =>
    request(`/workspace/sessions/${sessionId}`, { token }),

  // POST /workspace/sessions/:id/advance — advance to next ticket
  advanceTicket: (sessionId: string, token: string) =>
    request(`/workspace/sessions/${sessionId}/advance`, {
      method: "POST",
      token,
    }),

  // POST /workspace/sessions/:id/complete — complete session (destroys container)
  completeSession: (sessionId: string, token: string) =>
    request(`/workspace/sessions/${sessionId}/complete`, {
      method: "POST",
      token,
    }),

  // POST /workspace/sessions/:id/exec — execute command in container
  exec: (sessionId: string, command: string, token: string) =>
    request(`/workspace/sessions/${sessionId}/exec`, {
      method: "POST",
      body: { command },
      token,
    }),

  // GET /workspace/sessions/:id/files — list file paths
  getFiles: (sessionId: string, token: string) =>
    request(`/workspace/sessions/${sessionId}/files`, { token }),

  // GET /workspace/sessions/:id/files/read?path=... — read a single file
  readFile: (sessionId: string, filePath: string, token: string) =>
    request(`/workspace/sessions/${sessionId}/files/read`, {
      token,
      params: { path: filePath },
    }),

  // POST /workspace/sessions/:id/files — write a file
  writeFile: (sessionId: string, path: string, content: string, token: string) =>
    request(`/workspace/sessions/${sessionId}/files`, {
      method: "POST",
      body: { path, content },
      token,
    }),

  // POST /workspace/sessions/:id/snapshots — save a workspace snapshot
  saveSnapshot: (
    sessionId: string,
    snapshotType: string,
    fileTree: Record<string, string>,
    token: string
  ) =>
    request(`/workspace/sessions/${sessionId}/snapshots`, {
      method: "POST",
      body: { snapshotType, fileTree },
      token,
    }),

  // GET /workspace/sessions/:id/starter — get starter files
  getStarterFiles: (sessionId: string, token: string) =>
    request(`/workspace/sessions/${sessionId}/starter`, { token }),

  // POST /workspace/sessions/:id/welcome — send PM welcome message
  sendWelcome: (sessionId: string, token: string) =>
    request(`/workspace/sessions/${sessionId}/welcome`, {
      method: "POST",
      token,
    }),
};

// ═══════════════════════════════════════════════════════
// CHAT — /chat
// ═══════════════════════════════════════════════════════

const chat = {
  // POST /chat/:sessionId/message — send a message
  sendMessage: (sessionId: string, content: string, target: string, token: string) =>
    request(`/chat/${sessionId}/message`, {
      method: "POST",
      body: { content, target },
      token,
    }),

  // GET /chat/:sessionId/history — get chat history
  getHistory: (sessionId: string, token: string) =>
    request(`/chat/${sessionId}/history`, { token }),
};

// ═══════════════════════════════════════════════════════
// EVALUATION — /evaluate
// ═══════════════════════════════════════════════════════

const evaluation = {
  // POST /evaluate/:sessionId/check — run check (feedback only)
  runCheck: (sessionId: string, token: string) =>
    request(`/evaluate/${sessionId}/check`, { method: "POST", token }),

  // POST /evaluate/:sessionId/submit — submit ticket (scored, advances)
  submitTicket: (sessionId: string, token: string) =>
    request(`/evaluate/${sessionId}/submit`, { method: "POST", token }),

  // POST /evaluate/:sessionId/reset/:ticketSeq — reset ticket (use reference impl)
  resetTicket: (sessionId: string, ticketSeq: number, token: string) =>
    request(`/evaluate/${sessionId}/reset/${ticketSeq}`, {
      method: "POST",
      token,
    }),

  // GET /evaluate/:sessionId/report — get full evaluation report
  getReport: (sessionId: string, token: string) =>
    request(`/evaluate/${sessionId}/report`, { token }),
};

// ═══════════════════════════════════════════════════════
// STANDUP — /standup
// ═══════════════════════════════════════════════════════

const standup = {
  // POST /standup/:sessionId/start/:standupNumber — start a standup
  start: (sessionId: string, standupNumber: number, token: string) =>
    request(`/standup/${sessionId}/start/${standupNumber}`, {
      method: "POST",
      token,
    }),

  // POST /standup/:standupId/turn/:turnNumber/complete — complete a turn
  completeTurn: (
    standupId: string,
    turnNumber: number,
    audioBase64?: string,
    token?: string
  ) =>
    request(`/standup/${standupId}/turn/${turnNumber}/complete`, {
      method: "POST",
      body: audioBase64 ? { audioBase64 } : {},
      token: token || undefined,
    }),

  // GET /standup/:sessionId/status/:standupNumber — get standup status
  getStatus: (sessionId: string, standupNumber: number, token: string) =>
    request(`/standup/${sessionId}/status/${standupNumber}`, { token }),

  // GET /standup/:sessionId/all — get all standups for a session
  getAll: (sessionId: string, token: string) =>
    request(`/standup/${sessionId}/all`, { token }),

  // POST /standup/:sessionId/ad-hoc — create ad hoc standup
  createAdHoc: (sessionId: string, reason: string, token: string) =>
    request(`/standup/${sessionId}/ad-hoc`, {
      method: "POST",
      body: { reason },
      token,
    }),
};

// ═══════════════════════════════════════════════════════
// BILLING — /billing
// ═══════════════════════════════════════════════════════

const billing = {
  // GET /billing/info — get full billing info + plan + credits
  getInfo: (token: string) =>
    request("/billing/info", { token }),

  // GET /billing/can-start/:type — check if user can start session or sprint
  canStart: (type: "session" | "sprint", token: string) =>
    request(`/billing/can-start/${type}`, { token }),

  // GET /billing/can-evaluate — check if assessor can evaluate another candidate
  canEvaluate: (token: string) =>
    request("/billing/can-evaluate", { token }),

  // POST /billing/subscribe — create Stripe subscription checkout
  subscribe: (
    plan: "STARTER" | "PRO",
    successUrl: string,
    cancelUrl: string,
    token: string
  ) =>
    request("/billing/subscribe", {
      method: "POST",
      body: { plan, successUrl, cancelUrl },
      token,
    }),

  // POST /billing/purchase-credits — purchase a credit pack
  purchaseCredits: (
    creditType: string,
    packIndex: number,
    successUrl: string,
    cancelUrl: string,
    token: string
  ) =>
    request("/billing/purchase-credits", {
      method: "POST",
      body: { creditType, packIndex, successUrl, cancelUrl },
      token,
    }),

  // GET /billing/history — get purchase history
  getHistory: (token: string) =>
    request("/billing/history", { token }),

  // POST /billing/portal — create Stripe billing portal session
  createPortal: (returnUrl: string, token: string) =>
    request("/billing/portal", {
      method: "POST",
      body: { returnUrl },
      token,
    }),
};

// ═══════════════════════════════════════════════════════
// PROMO — /promo
// ═══════════════════════════════════════════════════════

const promo = {
  // POST /promo/redeem — redeem a promo code
  redeem: (code: string, token: string) =>
    request("/promo/redeem", { method: "POST", body: { code }, token }),

  // POST /promo/validate — validate without redeeming
  validate: (code: string, token: string) =>
    request("/promo/validate", { method: "POST", body: { code }, token }),
};

// ═══════════════════════════════════════════════════════
// ASSESSMENTS — /assessments
// ═══════════════════════════════════════════════════════

const assessments = {
  // POST /assessments — create an assessment
  create: (
    data: {
      simulationId: string;
      title?: string;
      settings?: Record<string, unknown>;
    },
    token: string
  ) =>
    request("/assessments", { method: "POST", body: data, token }),

  // GET /assessments — list my assessments
  list: (token: string) =>
    request("/assessments", { token }),

  // GET /assessments/invite/:code — get assessment by invite code (public)
  getByInviteCode: (code: string) =>
    request(`/assessments/invite/${code}`),

  // POST /assessments/invite/:code/join — join an assessment via invite code
  join: (code: string, token: string) =>
    request(`/assessments/invite/${code}/join`, { method: "POST", token }),

  // GET /assessments/:id — get assessment details
  get: (id: string, token: string) =>
    request(`/assessments/${id}`, { token }),

  // PATCH /assessments/:id/close — close an assessment
  close: (id: string, token: string) =>
    request(`/assessments/${id}/close`, { method: "PATCH", token }),

  // PATCH /assessments/:id/reopen — reopen an assessment
  reopen: (id: string, token: string) =>
    request(`/assessments/${id}/reopen`, { method: "PATCH", token }),
};

// ═══════════════════════════════════════════════════════
// SIMULATION REQUESTS — /simulation-requests
// ═══════════════════════════════════════════════════════

const simulationRequests = {
  // POST /simulation-requests — request a custom simulation
  create: (
    data: {
      role: string;
      techStack: string;
      skills: string[];
      difficulty: string;
      duration: string;
      description: string;
    },
    token: string
  ) =>
    request("/simulation-requests", { method: "POST", body: data, token }),

  // GET /simulation-requests — list my requests
  list: (token: string) =>
    request("/simulation-requests", { token }),
};

// ═══════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════

export const api = {
  auth,
  simulations,
  workspace,
  chat,
  evaluation,
  standup,
  billing,
  promo,
  assessments,
  simulationRequests,
};

export { ApiError };