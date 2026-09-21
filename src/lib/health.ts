export interface ClientMetrics {
  leadsInRange: number;
  appointmentsInRange: number;
  showedCount: number;
  noShowCount: number;
  opportunitiesWon: number;
  opportunitiesTotal: number;
  daysSinceLastSync: number | null;
}

/**
 * Placeholder 0-100 heuristic health score. Intentionally a plain
 * function with a stable signature (metrics in, number out) so the
 * future multi-factor Client Health Score engine (lead gen, response
 * time, conversion, retention, automation, reputation) can replace the
 * implementation without any caller needing to change.
 */
export function computeHealthScore(m: ClientMetrics): number {
  let score = 50;

  // Lead flow: any leads at all is a baseline positive signal.
  if (m.leadsInRange > 0) score += 10;
  if (m.leadsInRange >= 20) score += 5;

  // Show rate.
  const totalBooked = m.showedCount + m.noShowCount;
  if (totalBooked > 0) {
    const showRate = m.showedCount / totalBooked;
    score += Math.round((showRate - 0.5) * 30); // +/-15 around a 50% baseline
  }

  // Close rate.
  if (m.opportunitiesTotal > 0) {
    const closeRate = m.opportunitiesWon / m.opportunitiesTotal;
    score += Math.round(closeRate * 20);
  }

  // Data freshness — a location that hasn't synced recently is flagged
  // down rather than shown a stale "healthy" score.
  if (m.daysSinceLastSync === null) score -= 20;
  else if (m.daysSinceLastSync > 2) score -= 15;

  return Math.max(0, Math.min(100, score));
}

export type HealthTier = "healthy" | "watch" | "at-risk" | "critical";

export function healthTier(score: number): HealthTier {
  if (score >= 80) return "healthy";
  if (score >= 60) return "watch";
  if (score >= 40) return "at-risk";
  return "critical";
}
