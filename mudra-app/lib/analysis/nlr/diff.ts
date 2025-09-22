import type { Delta, NlrInput } from "@/lib/analysis/nlr/types";
import { NOTABILITY } from "@/lib/analysis/nlr/constants";

export interface DeltaOptions {
  relativeThreshold?: number; // e.g., 0.05 => 5%
  absoluteThreshold?: number; // e.g., 3 points
}

export function computeDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  options: DeltaOptions = {}
): Delta<number> {
  const cur = current ?? null;
  const prev = previous ?? null;
  if (cur == null && prev == null) {
    return { current: null, previous: null, absolute: null, relative: null, direction: "flat", notable: false };
  }
  if (prev == null) {
    return { current: cur, previous: null, absolute: null, relative: null, direction: "up", notable: false };
  }
  if (cur == null) {
    return { current: null, previous: prev, absolute: null, relative: null, direction: "down", notable: false };
  }

  const absolute = cur - prev;
  const relative = prev !== 0 ? absolute / prev : null;
  const direction = absolute > 0 ? "up" : absolute < 0 ? "down" : "flat";

  const relThresh = options.relativeThreshold ?? 0.05; // default 5%
  const absThresh = options.absoluteThreshold ?? 3; // default 3 points
  const notable = relative != null ? Math.abs(relative) >= relThresh : Math.abs(absolute) >= absThresh;

  return { current: cur, previous: prev, absolute, relative, direction, notable };
}

export function formatPercent(rel: number | null | undefined): string {
  if (rel == null) return "0%";
  const pct = rel * 100;
  return `${pct.toFixed(1)}%`;
}

export function clampDelta(delta: Delta<number>, min: number, max: number): Delta<number> {
  if (delta.current == null) return delta;
  const clamped = Math.max(min, Math.min(max, delta.current));
  const absolute = delta.previous != null ? clamped - delta.previous : delta.absolute ?? null;
  const relative = delta.previous != null && delta.previous !== 0 ? (absolute as number) / delta.previous : delta.relative ?? null;
  const direction = (absolute ?? 0) > 0 ? "up" : (absolute ?? 0) < 0 ? "down" : "flat";
  return { ...delta, current: clamped, absolute: absolute as number | null, relative, direction };
}

export interface RankedChange {
  section: "visibility" | "technical" | "tasks" | "external";
  label: string;
  importance: "high" | "medium" | "low";
  score: number; // ranking score
}

export function rankChanges(input: NlrInput): RankedChange[] {
  const items: RankedChange[] = [];

  // AI Visibility
  if (input.aiVisibility?.score) {
    const d = input.aiVisibility.score;
    const rel = Math.abs(d.relative ?? 0);
    const abs = Math.abs(d.absolute ?? 0);
    const thrRel = NOTABILITY.overrides.visibilityScore?.minRelative ?? NOTABILITY.minRelative;
    const thrAbs = NOTABILITY.overrides.visibilityScore?.minAbsolute ?? NOTABILITY.minAbsolute;
    const notable = rel >= thrRel || abs >= thrAbs;
    if (notable) {
      const dir = d.direction === "up" ? "+" : d.direction === "down" ? "-" : "±";
      const pct = d.relative != null ? `${(d.relative * 100).toFixed(1)}%` : `${d.absolute?.toFixed(1)}`;
      const score = (rel * 100 + abs) * (NOTABILITY.weights.visibilityScore ?? 1);
      items.push({ section: "visibility", label: `AI Visibility ${dir}${pct}`, importance: rel >= 0.15 ? "high" : rel >= 0.08 ? "medium" : "low", score });
    }
  }

  // Technical overall
  const tech = input.technical?.overallScore;
  if (tech) {
    const rel = Math.abs(tech.relative ?? 0);
    const abs = Math.abs(tech.absolute ?? 0);
    const thrRel = NOTABILITY.overrides.technicalOverall?.minRelative ?? NOTABILITY.minRelative;
    const thrAbs = NOTABILITY.overrides.technicalOverall?.minAbsolute ?? NOTABILITY.minAbsolute;
    const notable = rel >= thrRel || abs >= thrAbs;
    if (notable) {
      const dir = tech.direction === "up" ? "+" : tech.direction === "down" ? "-" : "±";
      const pct = tech.relative != null ? `${(tech.relative * 100).toFixed(1)}%` : `${tech.absolute?.toFixed(1)}`;
      const score = (rel * 100 + abs) * (NOTABILITY.weights.technicalOverall ?? 1);
      items.push({ section: "technical", label: `Technical score ${dir}${pct}`, importance: rel >= 0.15 ? "high" : rel >= 0.08 ? "medium" : "low", score });
    }
  }

  // Tasks verification rate
  const tvr = input.tasks?.verificationPassRate;
  if (tvr) {
    const rel = Math.abs(tvr.relative ?? 0);
    const abs = Math.abs(tvr.absolute ?? 0);
    const thrRel = NOTABILITY.overrides.tasksVerificationRate?.minRelative ?? 0.1;
    const thrAbs = NOTABILITY.overrides.tasksVerificationRate?.minAbsolute ?? 0.05;
    const notable = rel >= thrRel || abs >= thrAbs;
    if (notable) {
      const dir = tvr.direction === "up" ? "+" : tvr.direction === "down" ? "-" : "±";
      const pct = tvr.relative != null ? `${(tvr.relative * 100).toFixed(1)}%` : `${(tvr.absolute ?? 0).toFixed(2)}`;
      const score = (rel * 100 + abs * 100) * (NOTABILITY.weights.tasksVerificationRate ?? 1);
      items.push({ section: "tasks", label: `Verification rate ${dir}${pct}`, importance: rel >= 0.2 ? "high" : rel >= 0.1 ? "medium" : "low", score });
    }
  }

  // External mentions (placeholder)
  if (input.external?.mentions) {
    const d = input.external.mentions;
    const rel = Math.abs(d.relative ?? 0);
    const abs = Math.abs(d.absolute ?? 0);
    const thrRel = NOTABILITY.overrides.externalMentions?.minRelative ?? NOTABILITY.minRelative;
    const thrAbs = NOTABILITY.overrides.externalMentions?.minAbsolute ?? NOTABILITY.minAbsolute;
    const notable = rel >= thrRel || abs >= thrAbs;
    if (notable) {
      const dir = d.direction === "up" ? "+" : d.direction === "down" ? "-" : "±";
      const pct = d.relative != null ? `${(d.relative * 100).toFixed(1)}%` : `${d.absolute?.toFixed(0)}`;
      const score = (rel * 100 + abs) * (NOTABILITY.weights.externalMentions ?? 1);
      items.push({ section: "external", label: `External mentions ${dir}${pct}`, importance: rel >= 0.2 ? "high" : rel >= 0.1 ? "medium" : "low", score });
    }
  }

  // Sort by score desc and cap
  items.sort((a, b) => b.score - a.score);
  return items.slice(0, NOTABILITY.maxItems);
}


