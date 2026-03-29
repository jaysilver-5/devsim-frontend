// app/(app)/billing/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useApiToken } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatCents } from "@/lib/utils";
import type { BillingInfo } from "@/lib/types";

const PLANS = [
  {
    key: "FREE",
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["2 Sessions", "1 Sprint", "All tracks"],
  },
  {
    key: "STARTER",
    name: "Starter",
    price: "$9",
    period: "/month",
    features: ["Unlimited Sessions", "5 Sprints/month", "All tracks", "Full reports"],
    popular: true,
  },
  {
    key: "PRO",
    name: "Pro",
    price: "$19",
    period: "/month",
    features: ["Unlimited Sessions", "15 Sprints/month", "All tracks", "Full reports", "Priority support"],
  },
];

export default function BillingPage() {
  const { getApiToken } = useApiToken();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<{ message: string; success: boolean } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiToken();
        const bill = (await api.billing.getInfo(token)) as BillingInfo;
        setBilling(bill);
      } catch (err) {
        console.error("Failed to load billing:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getApiToken]);

  const handleUpgrade = async (plan: string) => {
    if (plan === "FREE") return;
    try {
      const token = await getApiToken();
      const result = (await api.billing.subscribe(
        plan as "STARTER" | "PRO",
        `${window.location.origin}/billing?success=true`,
        `${window.location.origin}/billing`,
        token
      )) as { url: string };
      if (result.url) window.location.href = result.url;
    } catch (err) {
      console.error("Checkout failed:", err);
    }
  };

  const handleBuyCredits = async (packIndex: number) => {
    try {
      const token = await getApiToken();
      const result = (await api.billing.purchaseCredits(
        "SPRINT",
        packIndex,
        `${window.location.origin}/billing?purchased=true`,
        `${window.location.origin}/billing`,
        token
      )) as { url?: string };
      if (result.url) window.location.href = result.url;
    } catch (err) {
      console.error("Purchase failed:", err);
    }
  };

  const handlePromo = async () => {
    if (!promoCode.trim()) return;
    try {
      const token = await getApiToken();
      const result = (await api.promo.redeem(promoCode, token)) as { message: string };
      setPromoResult({ message: result.message, success: true });
      // Reload billing info after promo redemption
      const bill = (await api.billing.getInfo(token)) as BillingInfo;
      setBilling(bill);
    } catch {
      setPromoResult({ message: "Invalid or expired promo code", success: false });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="text-sm text-ds-text-dim">Loading billing...</div></div>;
  }

  return (
    <div className="px-5 py-6 max-w-[900px] mx-auto">
      <h1 className="text-lg font-semibold text-ds-text tracking-tight mb-1">Billing</h1>
      <p className="text-sm text-ds-text-dim mb-6">Manage your plan and credits.</p>

      {/* Current usage */}
      {billing && (
        <div className="grid grid-cols-3 gap-2.5 mb-8">
          <div className="p-3.5 rounded-lg bg-ds-surface border border-ds-border">
            <div className="text-[10px] text-ds-text-faint uppercase tracking-wider mb-0.5">Current plan</div>
            <div className="text-lg font-bold text-ds-primary-muted">{billing.planLabel}</div>
          </div>
          <div className="p-3.5 rounded-lg bg-ds-surface border border-ds-border">
            <div className="text-[10px] text-ds-text-faint uppercase tracking-wider mb-0.5">Sprint credits</div>
            <div className="text-lg font-bold text-ds-text">{billing.sprintCreditsTotal}</div>
            <div className="text-[10px] text-ds-text-faint">{billing.sprintCreditsMonthly} monthly + {billing.sprintCreditsBonus} bonus</div>
          </div>
          <div className="p-3.5 rounded-lg bg-ds-surface border border-ds-border">
            <div className="text-[10px] text-ds-text-faint uppercase tracking-wider mb-0.5">Assessor credits</div>
            <div className="text-lg font-bold text-ds-text">{billing.assessorCredits}</div>
            <div className="text-[10px] text-ds-text-faint">{billing.assessorCandidatesUsed}/{billing.assessorFreeLimit} free used</div>
          </div>
        </div>
      )}

      {/* Plans */}
      <h2 className="text-[13px] font-semibold text-ds-text-secondary mb-3">Plans</h2>
      <div className="grid grid-cols-3 gap-2.5 mb-8">
        {PLANS.map((plan) => {
          const isCurrent = billing?.plan === plan.key;
          return (
            <div key={plan.key} className={`p-4 rounded-lg border bg-ds-surface ${plan.popular ? "border-ds-primary" : isCurrent ? "border-ds-success/40" : "border-ds-border"}`}>
              {plan.popular && <div className="text-[10px] font-semibold text-ds-primary bg-ds-primary/10 px-2 py-0.5 rounded inline-block mb-2">Most popular</div>}
              <div className="text-sm font-semibold text-ds-text mb-1">{plan.name}</div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold text-ds-text">{plan.price}</span>
                <span className="text-xs text-ds-text-dim">{plan.period}</span>
              </div>
              <ul className="space-y-1.5 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="text-[11px] text-ds-text-dim flex items-start gap-1.5">
                    <span className="text-ds-success mt-px">&#10003;</span>{f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="w-full py-2 text-center rounded-md border border-ds-success/30 bg-ds-success/8 text-ds-success text-xs font-semibold">Current plan</div>
              ) : (
                <button onClick={() => handleUpgrade(plan.key)}
                  className={`w-full py-2 rounded-md text-xs font-semibold transition-opacity ${
                    plan.popular ? "bg-ds-primary text-white hover:opacity-90" : "border border-ds-border-strong bg-ds-elevated text-ds-text-secondary hover:bg-ds-active"
                  }`}>
                  {plan.key === "FREE" ? "Downgrade" : "Upgrade"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Credit packs */}
      {billing && billing.sprintPacks.length > 0 && (
        <>
          <h2 className="text-[13px] font-semibold text-ds-text-secondary mb-3">Buy Sprint credits</h2>
          <div className="grid grid-cols-4 gap-2.5 mb-8">
            {billing.sprintPacks.map((pack, i) => (
              <button key={i} onClick={() => handleBuyCredits(i)}
                className="p-3.5 rounded-lg border border-ds-border bg-ds-surface hover:border-ds-border-strong transition-colors text-left">
                <div className="text-sm font-semibold text-ds-text mb-0.5">{pack.label}</div>
                <div className="text-lg font-bold text-ds-primary-muted">{formatCents(pack.cents)}</div>
                <div className="text-[10px] text-ds-text-faint">{pack.perUnit}/sprint</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Promo code */}
      <h2 className="text-[13px] font-semibold text-ds-text-secondary mb-3">Promo code</h2>
      <div className="flex gap-2 max-w-md mb-2">
        <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Enter promo code"
          className="flex-1 px-3 py-2.5 rounded-lg border border-ds-border-strong bg-ds-base text-ds-text-secondary text-sm placeholder:text-ds-text-ghost focus:border-ds-primary focus:outline-none" />
        <button onClick={handlePromo} className="px-5 py-2.5 rounded-lg bg-ds-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">Apply</button>
      </div>
      {promoResult && <p className={`text-xs ${promoResult.success ? "text-ds-success" : "text-ds-danger"}`}>{promoResult.message}</p>}
    </div>
  );
}