"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";
import {
  PlayCircle,
  Send,
  RotateCcw,
  X,
  CheckCircle,
  AlertTriangle,
  Trophy,
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
  const [resetting, setResetting] = useState(false);

  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<EvalApiResult | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const getFreshTokens = useCallback(async () => {
    const primary = await getToken();
    if (!primary) {
      throw new Error("Missing auth token");
    }

    const retry = await getToken({ skipCache: true }).catch(() => primary);

    return {
      token: primary,
      retryToken: retry || primary,
    };
  }, [getToken]);

  const normalizeOutcome = (result: EvalApiResult) => {
    return result.outcome ?? result.status;
  };

  const handleCheck = useCallback(async () => {
    if (checking) return;

    setChecking(true);
    setCheckResult(null);

    try {
      const { token, retryToken } = await getFreshTokens();

      const result = (await api.evaluation.runCheck(
        sessionId,
        token,
        retryToken
      )) as any;

      const message =
        result.feedback ||
        result.message ||
        result.terminalOutput ||
        "Check complete. See terminal for details.";

      setCheckResult(message);
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

      const result = (await api.evaluation.submitTicket(
        sessionId,
        token,
        retryToken
      )) as EvalApiResult;

      setSubmitResult(result);
      setShowOverlay(true);
    } catch (err: any) {
      setSubmitResult({
        error: err.message || "Submission failed",
      });
      setShowOverlay(true);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, getFreshTokens, sessionId]);

  const handleReset = useCallback(async () => {
    if (resetting) return;

    const confirmed = window.confirm(
      "Reset this ticket? You will move on, but the score for this ticket will be capped."
    );

    if (!confirmed) return;

    setResetting(true);

    try {
      const { token, retryToken } = await getFreshTokens();

      await api.evaluation.resetTicket(
        sessionId,
        currentTicketSeq,
        token,
        retryToken
      );

      onAdvance();
    } catch (err: any) {
      console.error("Reset failed:", err);
      setSubmitResult({
        error: err.message || "Reset failed",
      });
      setShowOverlay(true);
    } finally {
      setResetting(false);
    }
  }, [resetting, getFreshTokens, sessionId, currentTicketSeq, onAdvance]);

  const handleOverlayClose = useCallback(() => {
    const outcome = submitResult ? normalizeOutcome(submitResult) : undefined;

    setShowOverlay(false);

    if (outcome === "passed" || outcome === "complete" || submitResult?.isComplete) {
      onAdvance();
    }
  }, [submitResult, onAdvance]);

  const outcome = submitResult ? normalizeOutcome(submitResult) : undefined;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleCheck}
          disabled={checking}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-ds-border-strong bg-ds-elevated text-[10px] font-semibold text-ds-text-secondary hover:bg-ds-active disabled:opacity-40 transition-colors"
        >
          <PlayCircle className="w-3 h-3" />
          {checking ? "Checking..." : "Run Checks"}
        </button>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ds-primary text-white text-[10px] font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          <Send className="w-3 h-3" />
          {submitting ? "Submitting..." : "Submit"}
        </button>

        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-ds-danger/30 text-[10px] font-semibold text-ds-danger hover:bg-ds-danger/8 disabled:opacity-40 transition-colors"
          title="Reset ticket and move on with a capped score"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {checkResult && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm p-3.5 rounded-lg bg-ds-elevated border border-ds-border shadow-xl animate-in slide-in-from-bottom-2">
          <div className="flex items-start gap-2">
            <PlayCircle className="w-4 h-4 text-ds-info shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-ds-text mb-1">
                Check Result
              </div>
              <div className="text-[11px] text-ds-text-dim leading-relaxed whitespace-pre-wrap">
                {checkResult}
              </div>
            </div>
            <button
              onClick={() => setCheckResult(null)}
              className="text-ds-text-faint hover:text-ds-text-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {showOverlay && submitResult && (
        <div className="fixed inset-0 z-50 bg-ds-base/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-xl bg-ds-surface border border-ds-border shadow-2xl">
            {submitResult.error ? (
              <>
                <div className="w-14 h-14 rounded-full bg-ds-danger/15 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-7 h-7 text-ds-danger" />
                </div>
                <h2 className="text-lg font-semibold text-ds-text text-center mb-2">
                  Submission Failed
                </h2>
                <p className="text-sm text-ds-text-dim text-center mb-5">
                  {submitResult.error}
                </p>
              </>
            ) : outcome === "complete" || submitResult.isComplete ? (
              <>
                <div className="w-14 h-14 rounded-full bg-ds-success/15 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-7 h-7 text-ds-success" />
                </div>
                <h2 className="text-lg font-semibold text-ds-text text-center mb-2">
                  Sprint Complete!
                </h2>
                <p className="text-sm text-ds-text-dim text-center mb-5">
                  You&apos;ve completed all tickets. View your full scorecard.
                </p>
              </>
            ) : outcome === "passed" ? (
              <>
                <div className="w-14 h-14 rounded-full bg-ds-success/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-ds-success" />
                </div>
                <h2 className="text-lg font-semibold text-ds-text text-center mb-2">
                  Ticket Passed!
                </h2>
                <p className="text-sm text-ds-text-dim text-center mb-3">
                  Moving to the next ticket.
                </p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-ds-warning/15 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-7 h-7 text-ds-warning" />
                </div>
                <h2 className="text-lg font-semibold text-ds-text text-center mb-2">
                  Below Threshold
                </h2>
                <p className="text-sm text-ds-text-dim text-center mb-3">
                  Keep working on it or use Reset to move on.
                </p>
                {typeof submitResult.minimumRequired === "number" && (
                  <p className="text-xs text-ds-text-faint text-center mb-2">
                    Minimum required: {submitResult.minimumRequired}%
                  </p>
                )}
              </>
            )}

            {submitResult.scores && (
              <div className="grid grid-cols-2 gap-2 mb-5">
                {Object.entries(submitResult.scores).map(([key, val]) => (
                  <div
                    key={key}
                    className="p-2.5 rounded-lg bg-ds-base border border-ds-border text-center"
                  >
                    <div className="text-[10px] text-ds-text-faint capitalize mb-0.5">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        val >= 80
                          ? "text-ds-success"
                          : val >= 60
                          ? "text-ds-warning"
                          : "text-ds-danger"
                      }`}
                    >
                      {val}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(submitResult.feedback ||
              submitResult.terminalOutput ||
              submitResult.triggerMessage) && (
              <div className="space-y-3 mb-5">
                {(submitResult.feedback || submitResult.terminalOutput) && (
                  <div className="p-3 rounded-lg bg-ds-base border border-ds-border">
                    <div className="text-[11px] text-ds-text-dim leading-relaxed whitespace-pre-wrap">
                      {submitResult.feedback || submitResult.terminalOutput}
                    </div>
                  </div>
                )}

                {submitResult.triggerMessage && (
                  <div className="p-3 rounded-lg bg-ds-primary/8 border border-ds-primary/15">
                    <div className="text-[10px] font-semibold text-ds-primary-muted mb-1">
                      Team update
                    </div>
                    <div className="text-[11px] text-ds-text-dim leading-relaxed whitespace-pre-wrap">
                      {submitResult.triggerMessage}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleOverlayClose}
              className="w-full py-2.5 rounded-lg bg-ds-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {outcome === "complete" || submitResult.isComplete
                ? "View Report"
                : outcome === "passed"
                ? "Continue"
                : "Keep Working"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}