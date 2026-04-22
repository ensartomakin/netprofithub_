import type { ExpenseRule } from "@/lib/expense-rules";

export type ExpenseLike = {
  category: string;
  amount: number;
  effective_date: string; // YYYY-MM-DD (local)
  recurring_status?: boolean;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function parseLocalISODate(value: string) {
  // value: YYYY-MM-DD
  const [y, m, d] = String(value).split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function daysInMonth(year: number, monthIndex0: number) {
  // monthIndex0: 0..11
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function minDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

function maxDate(a: Date, b: Date) {
  return a.getTime() >= b.getTime() ? a : b;
}

function diffDays(from: Date, toExclusive: Date) {
  const ms = startOfDay(toExclusive).getTime() - startOfDay(from).getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

function monthRange(from: Date, toExclusive: Date) {
  // returns list of month starts that overlap [from,to)
  const months: Array<{ year: number; month0: number; start: Date; end: Date }> = [];
  const start = startOfDay(from);
  const end = startOfDay(toExclusive);
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur < end) {
    const year = cur.getFullYear();
    const month0 = cur.getMonth();
    const mStart = new Date(year, month0, 1);
    const mEnd = new Date(year, month0 + 1, 1); // exclusive
    months.push({ year, month0, start: mStart, end: mEnd });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function allocateMonthlyAmount(params: {
  monthlyAmount: number;
  from: Date;
  toExclusive: Date;
  effectiveFrom?: Date | null;
  monthStart: Date;
  monthEndExclusive: Date;
}) {
  const { monthlyAmount, from, toExclusive, effectiveFrom, monthStart, monthEndExclusive } = params;
  const activeFrom = effectiveFrom ? maxDate(startOfDay(effectiveFrom), monthStart) : monthStart;
  const activeTo = monthEndExclusive;
  const segFrom = maxDate(startOfDay(from), activeFrom);
  const segTo = minDate(startOfDay(toExclusive), activeTo);
  const overlap = diffDays(segFrom, segTo);
  if (overlap <= 0) return 0;
  const dim = diffDays(monthStart, monthEndExclusive) || daysInMonth(monthStart.getFullYear(), monthStart.getMonth());
  return (monthlyAmount * overlap) / dim;
}

export type ExpenseTotalsResult = {
  total: number;
  byCategory: Array<{ category: string; amount: number }>;
  breakdown: {
    oneOffTotal: number;
    recurringTotal: number;
    ruleTotal: number;
  };
};

export function calculateExpenseTotalsForRange(params: {
  expenses: ExpenseLike[];
  rules?: ExpenseRule[];
  grossSales?: number;
  from: Date;
  toExclusive: Date;
}): ExpenseTotalsResult {
  const { expenses, rules = [], grossSales = 0, from, toExclusive } = params;
  const rangeFrom = startOfDay(from);
  const rangeTo = startOfDay(toExclusive);

  const byCategory = new Map<string, number>();
  let oneOffTotal = 0;
  let recurringTotal = 0;
  let ruleTotal = 0;

  const months = monthRange(rangeFrom, rangeTo);

  // 1) explicit expenses
  for (const e of expenses) {
    const amount = Number(e.amount ?? 0);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const category = String(e.category ?? "Diğer") || "Diğer";
    const eff = parseLocalISODate(String(e.effective_date ?? ""));
    if (!eff) continue;

    const recurring = Boolean(e.recurring_status ?? false);
    if (!recurring) {
      if (eff >= rangeFrom && eff < rangeTo) {
        oneOffTotal += amount;
        byCategory.set(category, (byCategory.get(category) ?? 0) + amount);
      }
      continue;
    }

    // recurring: allocate monthly across overlap, starting at effective_date
    for (const m of months) {
      const alloc = allocateMonthlyAmount({
        monthlyAmount: amount,
        from: rangeFrom,
        toExclusive: rangeTo,
        effectiveFrom: eff,
        monthStart: m.start,
        monthEndExclusive: m.end,
      });
      if (alloc === 0) continue;
      recurringTotal += alloc;
      byCategory.set(category, (byCategory.get(category) ?? 0) + alloc);
    }
  }

  // 2) rules
  const enabledRules = rules.filter((r) => r.enabled);
  for (const r of enabledRules) {
    const category = String(r.category ?? "Diğer") || "Diğer";
    if (r.type === "revenue_rate") {
      const amount = Math.max(0, grossSales) * Math.max(0, Number(r.value ?? 0));
      if (!Number.isFinite(amount) || amount === 0) continue;
      ruleTotal += amount;
      byCategory.set(category, (byCategory.get(category) ?? 0) + amount);
      continue;
    }

    // monthly_fixed: prorate by month overlap
    const monthly = Math.max(0, Number(r.value ?? 0));
    if (!Number.isFinite(monthly) || monthly === 0) continue;
    for (const m of months) {
      const alloc = allocateMonthlyAmount({
        monthlyAmount: monthly,
        from: rangeFrom,
        toExclusive: rangeTo,
        monthStart: m.start,
        monthEndExclusive: m.end,
      });
      if (alloc === 0) continue;
      ruleTotal += alloc;
      byCategory.set(category, (byCategory.get(category) ?? 0) + alloc);
    }
  }

  const total = oneOffTotal + recurringTotal + ruleTotal;
  return {
    total,
    byCategory: Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    breakdown: {
      oneOffTotal,
      recurringTotal,
      ruleTotal,
    },
  };
}

export function calculateRecurringAllocationForExpense(params: {
  expense: ExpenseLike;
  from: Date;
  toExclusive: Date;
}) {
  const { expense, from, toExclusive } = params;
  const amount = Number(expense.amount ?? 0);
  if (!Number.isFinite(amount) || amount === 0) return 0;
  if (!expense.recurring_status) return 0;
  const eff = parseLocalISODate(String(expense.effective_date ?? ""));
  if (!eff) return 0;
  const rangeFrom = startOfDay(from);
  const rangeTo = startOfDay(toExclusive);
  const months = monthRange(rangeFrom, rangeTo);
  let total = 0;
  for (const m of months) {
    total += allocateMonthlyAmount({
      monthlyAmount: amount,
      from: rangeFrom,
      toExclusive: rangeTo,
      effectiveFrom: eff,
      monthStart: m.start,
      monthEndExclusive: m.end,
    });
  }
  return total;
}
