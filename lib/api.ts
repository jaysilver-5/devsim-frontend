const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
  params?: Record<string, string>;
  retryToken?: string | null;
};

class ApiError extends Error {
  status: number;
  data: any;

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
  const {
    method = "GET",
    body,
    headers = {},
    token,
    params,
    retryToken,
  } = options;

  let url = `${API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const buildHeaders = (authToken?: string | null) => {
    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    if (authToken) {
      fetchHeaders.Authorization = `Bearer ${authToken}`;
    }

    return fetchHeaders;
  };

  const doFetch = async (authToken?: string | null) => {
    return fetch(url, {
      method,
      headers: buildHeaders(authToken),
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch(token);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));

    const looksExpired =
      res.status === 401 &&
      typeof data?.message === "string" &&
      data.message.toLowerCase().includes("expired");

    if (looksExpired && retryToken && retryToken !== token) {
      res = await doFetch(retryToken);

      if (!res.ok) {
        const retryData = await res.json().catch(() => ({}));
        throw new ApiError(
          res.status,
          retryData.message || `API error: ${res.status}`,
          retryData
        );
      }
    } else {
      throw new ApiError(
        res.status,
        data.message || `API error: ${res.status}`,
        data
      );
    }
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ═══════════════════════════════════════════════════════
// AUTH — /auth
// ═══════════════════════════════════════════════════════

const auth = {
  setRole: (role: string, token: string, retryToken?: string) =>
    request("/auth/set-role", {
      method: "POST",
      body: { role },
      token,
      retryToken,
    }),

  getProfile: (token: string, retryToken?: string) =>
    request("/auth/profile", { token, retryToken }),
};

// ═══════════════════════════════════════════════════════
// SIMULATIONS — /simulations
// ═══════════════════════════════════════════════════════

const simulations = {
  list: (
    filters?: { stack?: string; difficulty?: string; experienceType?: string },
    token?: string,
    retryToken?: string
  ) =>
    request("/simulations", {
      token: token || undefined,
      retryToken: retryToken || undefined,
      params: filters as Record<string, string> | undefined,
    }),

  get: (id: string, token?: string, retryToken?: string) =>
    request(`/simulations/${id}`, {
      token: token || undefined,
      retryToken: retryToken || undefined,
    }),
};

// ═══════════════════════════════════════════════════════
// WORKSPACE — /workspace
// ═══════════════════════════════════════════════════════

const workspace = {
  startSession: (simulationId: string, token: string, retryToken?: string) =>
    request("/workspace/sessions", {
      method: "POST",
      body: { simulationId },
      token,
      retryToken,
    }),

  getSessionBySim: (simulationId: string, token: string, retryToken?: string) =>
    request(`/workspace/sessions/by-sim/${simulationId}`, { token, retryToken }),

  getSession: (sessionId: string, token: string, retryToken?: string) =>
    request(`/workspace/sessions/${sessionId}`, { token, retryToken }),

  advanceTicket: (sessionId: string, token: string, retryToken?: string) =>
    request(`/workspace/sessions/${sessionId}/advance`, {
      method: "POST",
      token,
      retryToken,
    }),

  completeSession: (sessionId: string, token: string, retryToken?: string) =>
    request(`/workspace/sessions/${sessionId}/complete`, {
      method: "POST",
      token,
      retryToken,
    }),

  exec: (
    sessionId: string,
    command: string,
    token: string,
    retryToken?: string
  ) =>
    request(`/workspace/sessions/${sessionId}/exec`, {
      method: "POST",
      body: { command },
      token,
      retryToken,
    }),

  getFiles: (sessionId: string, token: string, retryToken?: string) =>
    request(`/workspace/sessions/${sessionId}/files`, { token, retryToken }),

  readFile: (
    sessionId: string,
    filePath: string,
    token: string,
    retryToken?: string
  ) =>
    request(`/workspace/sessions/${sessionId}/files/read`, {
      token,
      retryToken,
      params: { path: filePath },
    }),

  writeFile: (
    sessionId: string,
    path: string,
    content: string,
    token: string,
    retryToken?: string
  ) =>
    request(`/workspace/sessions/${sessionId}/files`, {
      method: "POST",
      body: { path, content },
      token,
      retryToken,
    }),

  saveSnapshot: (
    sessionId: string,
    snapshotType: string,
    fileTree: Record<string, string>,
    token: string,
    retryToken?: string
  ) =>
    request(`/workspace/sessions/${sessionId}/snapshots`, {
      method: "POST",
      body: { snapshotType, fileTree },
      token,
      retryToken,
    }),

  getStarterFiles: (sessionId: string, token: string, retryToken?: string) =>
    request(`/workspace/sessions/${sessionId}/starter`, { token, retryToken }),

  sendWelcome: (sessionId: string, token: string, retryToken?: string) =>
    request(`/workspace/sessions/${sessionId}/welcome`, {
      method: "POST",
      token,
      retryToken,
    }),
};

// ═══════════════════════════════════════════════════════
// CHAT — /chat
// ═══════════════════════════════════════════════════════

const chat = {
  sendMessage: (
    sessionId: string,
    content: string,
    target: string,
    token: string,
    retryToken?: string
  ) =>
    request(`/chat/${sessionId}/message`, {
      method: "POST",
      body: { content, target },
      token,
      retryToken,
    }),

  getHistory: (sessionId: string, token: string, retryToken?: string) =>
    request(`/chat/${sessionId}/history`, { token, retryToken }),
};

// ═══════════════════════════════════════════════════════
// EVALUATION — /evaluate
// ═══════════════════════════════════════════════════════

const evaluation = {
  runCheck: (sessionId: string, token: string, retryToken?: string) =>
    request(`/evaluate/${sessionId}/check`, {
      method: "POST",
      token,
      retryToken,
    }),

  submitTicket: (sessionId: string, token: string, retryToken?: string) =>
    request(`/evaluate/${sessionId}/submit`, {
      method: "POST",
      token,
      retryToken,
    }),

  resetTicket: (
    sessionId: string,
    ticketSeq: number,
    token: string,
    retryToken?: string
  ) =>
    request(`/evaluate/${sessionId}/reset/${ticketSeq}`, {
      method: "POST",
      token,
      retryToken,
    }),

  getReport: (sessionId: string, token: string, retryToken?: string) =>
    request(`/evaluate/${sessionId}/report`, { token, retryToken }),
};

// ═══════════════════════════════════════════════════════
// STANDUP — /standup
// ═══════════════════════════════════════════════════════

const standup = {
  start: (
    sessionId: string,
    standupNumber: number,
    token: string,
    retryToken?: string
  ) =>
    request(`/standup/${sessionId}/start/${standupNumber}`, {
      method: "POST",
      token,
      retryToken,
    }),

  completeTurn: (
    standupId: string,
    turnNumber: number,
    audioBase64?: string,
    token?: string,
    retryToken?: string
  ) =>
    request(`/standup/${standupId}/turn/${turnNumber}/complete`, {
      method: "POST",
      body: audioBase64 ? { audioBase64 } : {},
      token: token || undefined,
      retryToken: retryToken || undefined,
    }),

  completeTurnText: (
    standupId: string,
    turnNumber: number,
    text: string,
    token?: string,
    retryToken?: string
  ) =>
    request(`/standup/${standupId}/turn/${turnNumber}/complete-text`, {
      method: "POST",
      body: { text },
      token: token || undefined,
      retryToken: retryToken || undefined,
    }),

  getStatus: (
    sessionId: string,
    standupNumber: number,
    token: string,
    retryToken?: string
  ) =>
    request(`/standup/${sessionId}/status/${standupNumber}`, {
      token,
      retryToken,
    }),

  getAll: (sessionId: string, token: string, retryToken?: string) =>
    request(`/standup/${sessionId}/all`, { token, retryToken }),

  createAdHoc: (
    sessionId: string,
    reason: string,
    token: string,
    retryToken?: string
  ) =>
    request(`/standup/${sessionId}/ad-hoc`, {
      method: "POST",
      body: { reason },
      token,
      retryToken,
    }),
};

// ═══════════════════════════════════════════════════════
// BILLING — /billing
// ═══════════════════════════════════════════════════════

const billing = {
  getInfo: (token: string, retryToken?: string) =>
    request("/billing/info", { token, retryToken }),

  canStart: (
    type: "session" | "sprint",
    token: string,
    retryToken?: string
  ) =>
    request(`/billing/can-start/${type}`, { token, retryToken }),

  canEvaluate: (token: string, retryToken?: string) =>
    request("/billing/can-evaluate", { token, retryToken }),

  subscribe: (
    plan: "STARTER" | "PRO",
    successUrl: string,
    cancelUrl: string,
    token: string,
    retryToken?: string
  ) =>
    request("/billing/subscribe", {
      method: "POST",
      body: { plan, successUrl, cancelUrl },
      token,
      retryToken,
    }),

  purchaseCredits: (
    creditType: string,
    packIndex: number,
    successUrl: string,
    cancelUrl: string,
    token: string,
    retryToken?: string
  ) =>
    request("/billing/purchase-credits", {
      method: "POST",
      body: { creditType, packIndex, successUrl, cancelUrl },
      token,
      retryToken,
    }),

  getHistory: (token: string, retryToken?: string) =>
    request("/billing/history", { token, retryToken }),

  createPortal: (returnUrl: string, token: string, retryToken?: string) =>
    request("/billing/portal", {
      method: "POST",
      body: { returnUrl },
      token,
      retryToken,
    }),
};

// ═══════════════════════════════════════════════════════
// PROMO — /promo
// ═══════════════════════════════════════════════════════

const promo = {
  redeem: (code: string, token: string, retryToken?: string) =>
    request("/promo/redeem", {
      method: "POST",
      body: { code },
      token,
      retryToken,
    }),

  validate: (code: string, token: string, retryToken?: string) =>
    request("/promo/validate", {
      method: "POST",
      body: { code },
      token,
      retryToken,
    }),
};

// ═══════════════════════════════════════════════════════
// ASSESSMENTS — /assessments
// ═══════════════════════════════════════════════════════

const assessments = {
  create: (
    data: {
      simulationId: string;
      title?: string;
      settings?: Record<string, unknown>;
    },
    token: string,
    retryToken?: string
  ) =>
    request("/assessments", {
      method: "POST",
      body: data,
      token,
      retryToken,
    }),

  list: (token: string, retryToken?: string) =>
    request("/assessments", { token, retryToken }),

  getByInviteCode: (code: string) =>
    request(`/assessments/invite/${code}`),

  join: (code: string, token: string, retryToken?: string) =>
    request(`/assessments/invite/${code}/join`, {
      method: "POST",
      token,
      retryToken,
    }),

  get: (id: string, token: string, retryToken?: string) =>
    request(`/assessments/${id}`, { token, retryToken }),

  close: (id: string, token: string, retryToken?: string) =>
    request(`/assessments/${id}/close`, {
      method: "PATCH",
      token,
      retryToken,
    }),

  reopen: (id: string, token: string, retryToken?: string) =>
    request(`/assessments/${id}/reopen`, {
      method: "PATCH",
      token,
      retryToken,
    }),
};

// ═══════════════════════════════════════════════════════
// SIMULATION REQUESTS — /simulation-requests
// ═══════════════════════════════════════════════════════

const simulationRequests = {
  create: (
    data: {
      role: string;
      techStack: string;
      skills: string[];
      difficulty: string;
      duration: string;
      description: string;
    },
    token: string,
    retryToken?: string
  ) =>
    request("/simulation-requests", {
      method: "POST",
      body: data,
      token,
      retryToken,
    }),

  list: (token: string, retryToken?: string) =>
    request("/simulation-requests", { token, retryToken }),
};

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