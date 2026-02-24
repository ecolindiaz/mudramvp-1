import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strip internal markers (HTML comments like <!-- FAQ_DATA: ... --> and
 * <!-- REQUIRED_SCHEMA_TYPES: ... -->) from issue descriptions for display.
 * These markers are kept in the DB for the code generation pipeline.
 */
export function stripInternalMarkers(text: string): string {
  return text.replace(/\s*<!--[\s\S]*?-->/g, "").trim();
}
