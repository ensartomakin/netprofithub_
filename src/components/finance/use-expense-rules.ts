"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ExpenseRule, ExpenseRuleType } from "@/lib/expense-rules";
import { createExpenseRule, loadExpenseRules, saveExpenseRules } from "@/lib/expense-rules";

export function useExpenseRules(storeId: string | null) {
  const subscribe = useMemo(() => {
    return (onStoreChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const handler = () => onStoreChange();
      window.addEventListener("storage", handler);
      window.addEventListener("nph_expense_rules", handler as EventListener);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener("nph_expense_rules", handler as EventListener);
      };
    };
  }, []);

  const getSnapshot = useMemo(() => {
    return () => loadExpenseRules(storeId);
  }, [storeId]);

  const rules = useSyncExternalStore(subscribe, getSnapshot, () => [] as ExpenseRule[]);

  const api = useMemo(
    () => ({
      rules,
      setRules: (next: ExpenseRule[]) => {
        if (typeof window === "undefined") return;
        if (!storeId) return;
        saveExpenseRules(storeId, next);
      },
      addRule: (params: { category: string; type: ExpenseRuleType; value: number }) => {
        if (typeof window === "undefined") return;
        if (!storeId) return;
        const next = [createExpenseRule(params), ...rules];
        saveExpenseRules(storeId, next);
      },
      toggleRule: (id: string) => {
        if (typeof window === "undefined") return;
        if (!storeId) return;
        const next = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
        saveExpenseRules(storeId, next);
      },
      deleteRule: (id: string) => {
        if (typeof window === "undefined") return;
        if (!storeId) return;
        const next = rules.filter((r) => r.id !== id);
        saveExpenseRules(storeId, next);
      },
    }),
    [rules, storeId]
  );

  return api;
}

