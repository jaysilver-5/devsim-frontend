// components/workspace/eval-actions.tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import {
  Play,
  Send,
  SkipForward,
  X,
  CheckCircle,
  AlertTriangle,
  Trophy,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type EvalApiResult = {
  status?: "passed" | "below_threshold" | "complete" | "advanced";
  outcome?: "passed" | "below_threshold" | "complete";
  scores?: Record<string, number>;
  feedback?: string;
  message?: string;
  terminalOutput?: string;
  minimumRequired?: number;
  nextTicketSeq?: number | null;
  triggerMessage?: string | null;
  isComplete?: boolean;
  error?: string;
};

export function EvalActions({
  sessionId,
  currentTicketSeq,
  onAdvance,
}: {
  sessionId: string;
  currentTicketSeq: number;
  onAdvance: () => void;
}) {
  const { getToken } = useAuth();

  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [checkTestStatus, setCheckTestStatus] = useState<{ passed: boolean; passCount: number; failCount: number } | null>(null);
  const [checkExpanded, setCheckExpanded] = useState(true);
  const [submitResult, setSubmitResult] = useState<EvalApiResult | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showOverlay && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [showOverlay]);

  const getFreshTokens = useCallback(async () => {
    const primary = await getToken();
    if (!primary) throw new Error("Missing auth token");
    const retry = await getToken({ skipCache: true }).catch(() => primary);
    return { token: primary, retryToken: retry || primary };
  }, [getToken]);

  const normalizeOutcome = (r: EvalApiResult) => r.outcome ?? r.status;

  const handleCheck = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setCheckResult(null);
    setCheckTestStatus(null);
    setCheckExpanded(true);
    try {
      const { token, retryToken } = await getFreshTokens();
      const result = (await api.evaluation.runCheck(sessionId, token, retryToken)) as any;
      setCheckResult(result.feedback || result.message || result.terminalOutput || "Check complete.");
      if (result.testResults) {
        setCheckTestStatus(result.testResults);
      }
    } catch (err: any) {
      setCheckResult(`Check failed: ${err.message || "Unknown error"}`);
    } finally {
      setChecking(false);
    }
  }, [checking, getFreshTokens, sessionId]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { token, retryToken } = await getFreshTokens();
      const result = (await api.evaluation.submitTicket(sessionId, token, retryToken)) as EvalApiResult;
      setSubmitResult(result);
      setShowOverlay(true);
    } catch (err: any) {
      setSubmitResult({ error: err.message || "Submission failed" });
      setShowOverlay(true);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, getFreshTokens, sessionId]);

  const handleSkip = useCallback(async () => {
    if (skipping) return;
    setSkipping(true);
    setShowSkipConfirm(false);
    try {
      const { token, retryToken } = await getFreshTokens();
      await api.evaluation.resetTicket(sessionId, currentTicketSeq, token, retryToken);
      onAdvance();
    } catch (err: any) {
      setSubmitResult({ error: err.message || "Skip failed" });
      setShowOverlay(true);
    } finally {
      setSkipping(false);
    }
  }, [skipping, getFreshTokens, sessionId, currentTicketSeq, onAdvance]);

  const handleOverlayClose = useCallback(() => {
    const outcome = submitResult ? normalizeOutcome(submitResult) : undefined;
    setShowOverlay(false);
    if (outcome === "passed" || outcome === "complete" || submitResult?.isComplete) onAdvance();
  }, [submitResult, onAdvance]);

  const outcome = submitResult ? normalizeOutcome(submitResult) : undefined;

  return (
    <>
      {/* Buttons */}
      <div className="flex items-center gap-1.5">
        <button onClick={handleCheck} disabled={checking}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-ds-border-strong bg-ds-elevated text-[11px] font-semibold text-ds-text-secondary hover:bg-ds-active disabled:opacity-40 transition-colors">
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {checking ? "Running..." : "Run Checks"}
        </button>

        <button onClick={handleSubmit} disabled={submitting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ds-primary text-white text-[11px] font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity">
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {submitting ? "Submitting..." : "Submit Ticket"}
        </button>

        <button onClick={() => setShowSkipConfirm(true)} disabled={skipping}
          className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-ds-border-strong text-[11px] font-medium text-ds-text-faint hover:text-ds-warning hover:border-ds-warning/30 hover:bg-ds-warning/8 disabled:opacity-40 transition-colors"
          title="Skip this ticket (score will be capped)">
          {skipping ? <Loader2 className="w-3 h-3 animate-spin" /> : <SkipForward className="w-3 h-3" />}
          <span className="hidden sm:inline">Skip</span>
        </button>
      </div>

      {/* Check Result */}
      {checkResult && (
        <div className="fixed bottom-4 right-4 z-50 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl bg-ds-elevated border border-ds-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-3">
          <div className="flex items-center justify-between px-4 py-2.5 bg-ds-surface/50 border-b border-ds-border-subtle">
            <div className="flex items-center gap-2">
              <Play className="w-3.5 h-3.5 text-ds-info" />
              <span className="text-[11px] font-semibold text-ds-text">Check Results</span>
              {checkTestStatus && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  checkTestStatus.passed
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-rose-500/15 text-rose-400"
                }`}>
                  {checkTestStatus.passed ? "TESTS PASSED" : "TESTS FAILED"}
                  {" "}({checkTestStatus.passCount}/{checkTestStatus.passCount + checkTestStatus.failCount})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCheckExpanded(!checkExpanded)} className="text-ds-text-faint hover:text-ds-text-muted p-0.5">
                {checkExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => { setCheckResult(null); setCheckTestStatus(null); }} className="text-ds-text-faint hover:text-ds-text-muted p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {checkExpanded && (
            <div className="max-h-[350px] overflow-y-auto p-4">
              <pre className="text-[11px] text-ds-text-dim leading-relaxed whitespace-pre-wrap font-mono">{checkResult}</pre>
            </div>
          )}
        </div>
      )}

      {/* Skip Confirm */}
      {showSkipConfirm && (
        <div className="fixed inset-0 z-[80] bg-ds-base/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-ds-surface border border-ds-border shadow-2xl p-5">
            <div className="w-12 h-12 rounded-full bg-ds-warning/15 flex items-center justify-center mx-auto mb-4">
              <SkipForward className="w-6 h-6 text-ds-warning" />
            </div>
            <h3 className="text-base font-semibold text-ds-text text-center mb-2">Skip this ticket?</h3>
            <p className="text-sm text-ds-text-dim text-center leading-relaxed mb-5">
              You&apos;ll move to the next ticket, but your score for this one will be capped at the minimum passing rate.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowSkipConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-ds-border-strong text-sm font-medium text-ds-text-secondary hover:bg-ds-elevated transition-colors">
                Keep working
              </button>
              <button onClick={handleSkip}
                className="flex-1 py-2.5 rounded-lg bg-ds-warning/15 border border-ds-warning/25 text-sm font-medium text-ds-warning hover:bg-ds-warning/25 transition-colors">
                Skip ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Overlay — WIDER (max-w-lg) + scrollable + sticky button */}
      {showOverlay && submitResult && (
        <div className="fixed inset-0 z-[80] bg-ds-base/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[88vh] rounded-xl bg-ds-surface border border-ds-border shadow-2xl flex flex-col overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
              {/* Header */}
              {submitResult.error ? (
                <div className="text-center mb-5">
                  <div className="w-14 h-14 rounded-full bg-ds-danger/15 flex items-center justify-center mx-auto mb-3">
                    <AlertTriangle className="w-7 h-7 text-ds-danger" />
                  </div>
                  <h2 className="text-lg font-semibold text-ds-text">Submission Failed</h2>
                  <p className="text-sm text-ds-text-dim mt-1">{submitResult.error}</p>
                </div>
              ) : outcome === "complete" || submitResult.isComplete ? (
                <div className="text-center mb-5">
                  <div className="w-14 h-14 rounded-full bg-ds-success/15 flex items-center justify-center mx-auto mb-3">
                    <Trophy className="w-7 h-7 text-ds-success" />
                  </div>
                  <h2 className="text-lg font-semibold text-ds-text">Sprint Complete!</h2>
                  <p className="text-sm text-ds-text-dim mt-1">All tickets done. Your scorecard is ready.</p>
                </div>
              ) : outcome === "passed" ? (
                <div className="text-center mb-5">
                  <div className="w-14 h-14 rounded-full bg-ds-success/15 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-7 h-7 text-ds-success" />
                  </div>
                  <h2 className="text-lg font-semibold text-ds-text">Ticket Passed</h2>
                  <p className="text-sm text-ds-text-dim mt-1">Nice work. Moving to the next ticket.</p>
                </div>
              ) : (
                <div className="text-center mb-5">
                  <div className="w-14 h-14 rounded-full bg-ds-warning/15 flex items-center justify-center mx-auto mb-3">
                    <AlertTriangle className="w-7 h-7 text-ds-warning" />
                  </div>
                  <h2 className="text-lg font-semibold text-ds-text">Below Threshold</h2>
                  <p className="text-sm text-ds-text-dim mt-1">Keep working on it, or skip to move on.</p>
                  {typeof submitResult.minimumRequired === "number" && (
                    <p className="text-xs text-ds-text-faint mt-1">Minimum: {submitResult.minimumRequired}%</p>
                  )}
                </div>
              )}

              {/* Scores */}
              {submitResult.scores && (
                <div className="grid grid-cols-2 gap-2.5 mb-5">
                  {Object.entries(submitResult.scores).map(([key, val]) => (
                    <div key={key} className="p-3 rounded-lg bg-ds-base border border-ds-border">
                      <div className="text-[10px] text-ds-text-faint capitalize mb-1">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </div>
                      <div className="flex items-end gap-1">
                        <span className={`text-xl font-bold tabular-nums ${val >= 80 ? "text-ds-success" : val >= 60 ? "text-ds-warning" : "text-ds-danger"}`}>
                          {val}
                        </span>
                        <span className="text-xs text-ds-text-faint mb-0.5">/100</span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-ds-border overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${val >= 80 ? "bg-ds-success" : val >= 60 ? "bg-ds-warning" : "bg-ds-danger"}`} style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Feedback / terminal output */}
              {(submitResult.feedback || submitResult.terminalOutput) && (
                <div className="mb-4">
                  <div className="text-[10px] font-semibold text-ds-text-faint uppercase tracking-wider mb-2">Review</div>
                  <div className="p-3.5 rounded-lg bg-ds-base border border-ds-border max-h-[220px] overflow-y-auto">
                    <pre className="text-[11px] text-ds-text-dim leading-relaxed whitespace-pre-wrap font-mono">
                      {submitResult.feedback || submitResult.terminalOutput}
                    </pre>
                  </div>
                </div>
              )}

              {submitResult.triggerMessage && (
                <div className="p-3.5 rounded-lg bg-ds-primary/8 border border-ds-primary/15 mb-4">
                  <div className="text-[10px] font-semibold text-ds-primary-muted mb-1">Team update</div>
                  <div className="text-[12px] text-ds-text-dim leading-relaxed">{submitResult.triggerMessage}</div>
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 px-6 pb-5 pt-3 border-t border-ds-border-subtle bg-ds-surface">
              <button onClick={handleOverlayClose}
                className="w-full py-3 rounded-lg bg-ds-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                {outcome === "complete" || submitResult.isComplete ? "View Report"
                  : outcome === "passed" ? "Next Ticket"
                  : "Keep Working"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}