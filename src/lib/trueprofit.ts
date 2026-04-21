export type ProfitInputs = {
  grossSales: number;
  cogs: number;
  shipping: number;
  adSpend: number;
  marketplaceFees: number;
  returns: number;
  fixedExpenses: number;
};

export function calculateNetProfit(inputs: ProfitInputs) {
  const {
    grossSales,
    cogs,
    shipping,
    adSpend,
    marketplaceFees,
    returns,
    fixedExpenses,
  } = inputs;

  return (
    grossSales -
    (cogs + shipping + adSpend + marketplaceFees + returns + fixedExpenses)
  );
}

export function calculateRoas(revenue: number, adSpend: number) {
  if (adSpend <= 0) return null;
  return revenue / adSpend;
}

export function calculateMer(revenue: number, adSpend: number) {
  if (revenue <= 0) return null;
  return adSpend / revenue;
}

