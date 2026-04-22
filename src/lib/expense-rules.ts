export type ExpenseRuleType = "monthly_fixed" | "revenue_rate";

export type ExpenseRule = {
  id: string;
  category: string;
  type: ExpenseRuleType;
  value: number; // monthly_fixed: TRY/month, revenue_rate: 0..1
  enabled: boolean;
  createdAt: string; // ISO
};

export function expenseRulesKey(storeId: string) {
  return `nph_expense_rules:${storeId}`;
}

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object") return {};
  return v as Record<string, unknown>;
}

function normalizeRule(input: unknown): ExpenseRule | null {
  const r = asRecord(input);
  const id = String(r.id ?? "");
  const category = String(r.category ?? "").trim();
  const type = String(r.type ?? "");
  const value = Number(r.value ?? 0);
  const enabled = Boolean(r.enabled ?? true);
  const createdAt = String(r.createdAt ?? new Date().toISOString());

  if (!id || !category) return null;
  if (type !== "monthly_fixed" && type !== "revenue_rate") return null;
  if (!Number.isFinite(value)) return null;

  const normalizedValue =
    type === "revenue_rate"
      ? Math.max(0, Math.min(0.5, value))
      : Math.max(0, Math.min(10_000_000, value));

  return {
    id,
    category,
    type,
    value: normalizedValue,
    enabled,
    createdAt,
  } satisfies ExpenseRule;
}

export function loadExpenseRules(storeId: string | null) {
  if (typeof window === "undefined") return [] as ExpenseRule[];
  if (!storeId) return [] as ExpenseRule[];
  try {
    const raw = window.localStorage.getItem(expenseRulesKey(storeId));
    if (!raw) return [] as ExpenseRule[];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [] as ExpenseRule[];
    return parsed
      .map(normalizeRule)
      .filter((x): x is ExpenseRule => Boolean(x))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  } catch {
    return [] as ExpenseRule[];
  }
}

export function saveExpenseRules(storeId: string, rules: ExpenseRule[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(expenseRulesKey(storeId), JSON.stringify(rules));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event("nph_expense_rules"));
}

export function createExpenseRule(params: {
  category: string;
  type: ExpenseRuleType;
  value: number;
}) {
  return {
    id: `rule_${Date.now()}`,
    category: params.category.trim() || "Diğer",
    type: params.type,
    value: params.value,
    enabled: true,
    createdAt: new Date().toISOString(),
  } satisfies ExpenseRule;
}

