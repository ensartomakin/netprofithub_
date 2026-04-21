export function calculateDIR(stockLevel: number, avgDailyUnits: number) {
  if (stockLevel <= 0) return 0;
  if (avgDailyUnits <= 0) return null;
  return stockLevel / avgDailyUnits;
}

