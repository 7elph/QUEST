export function computePerformanceScore(input: {
  completed: number;
  accepted: number;
  totalSubmissions: number;
  onTime: number;
  disputes: number;
}) {
  const quality = input.totalSubmissions ? input.accepted / input.totalSubmissions : 0;
  const punctuality = input.accepted ? input.onTime / input.accepted : 0;
  const volumeFactor = Math.min(1, input.completed / 3);
  const base = punctuality * 40 + quality * 35 + Math.min(25, input.completed * 5) - input.disputes * 5;

  return {
    quality,
    punctuality,
    score: Math.max(0, Math.round(base * volumeFactor)),
    provisional: input.completed < 3,
  };
}
