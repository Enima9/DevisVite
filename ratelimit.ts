/**
 * Limitation de débit en mémoire (MVP mono-instance).
 * Fenêtre glissante : max N appels par durée, par clé (entreprise).
 */

interface Window {
  timestamps: number[];
}

const windows = new Map<string, Window>();

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  now?: number; // injectable pour les tests
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = options.now ?? Date.now();
  const win = windows.get(key) ?? { timestamps: [] };

  // Purge des timestamps hors fenêtre
  win.timestamps = win.timestamps.filter((t) => now - t < options.windowMs);

  if (win.timestamps.length >= options.max) {
    const oldest = win.timestamps[0];
    windows.set(key, win);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: options.windowMs - (now - oldest),
    };
  }

  win.timestamps.push(now);
  windows.set(key, win);
  return {
    allowed: true,
    remaining: options.max - win.timestamps.length,
    retryAfterMs: 0,
  };
}

/** Limiteur IA : 20 appels par heure et par entreprise. */
export function checkAiRateLimit(companyId: string, now?: number): RateLimitResult {
  return checkRateLimit(`ai:${companyId}`, {
    max: 20,
    windowMs: 60 * 60 * 1000,
    now,
  });
}

/** Réinitialise (tests). */
export function resetRateLimits(): void {
  windows.clear();
}
