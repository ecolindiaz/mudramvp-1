import type { DOMExtraction } from "./types";
import { detectPageType } from "./dom-extractor";

export interface BogusPageResult {
	isBogus: boolean;
	reason: string | null;
	heuristic: "redirect" | "canonical-mismatch" | "auth-wall" | "soft-404" | null;
}

const NOT_BOGUS: BogusPageResult = { isBogus: false, reason: null, heuristic: null };

const AUTH_WALL_RE = /\b(log\s*in|sign\s*in|sign\s*up|register|authenticat)/i;

/**
 * Normalise a URL to its pathname for comparison.
 * Lowercases, strips trailing slash, strips common locale prefixes.
 */
function normalizePath(url: string): string {
	try {
		let p = new URL(url).pathname.toLowerCase().replace(/\/+$/, "") || "/";
		p = p.replace(/^\/(?:[a-z]{2}(?:-[a-z]{2})?)(?=\/|$)/, "") || "/";
		return p;
	} catch {
		return url.toLowerCase().replace(/\/+$/, "") || "/";
	}
}

/**
 * Check whether two URLs point to the same host (ignoring www prefix).
 */
function sameHost(a: string, b: string): boolean {
	try {
		const ha = new URL(a).hostname.replace(/^www\./, "");
		const hb = new URL(b).hostname.replace(/^www\./, "");
		return ha === hb;
	} catch {
		return true; // can't parse → skip host check
	}
}

/**
 * Detects whether a scraped page is bogus (redirect, soft-404, auth wall).
 *
 * Pure function — no I/O, no side effects.
 * Heuristics are checked in order; first match wins.
 */
export function detectBogusPage(
	requestedUrl: string,
	sourceURL: string | undefined,
	extraction: DOMExtraction,
	brandName?: string,
): BogusPageResult {
	const reqPath = normalizePath(requestedUrl);

	// --- Heuristic 1: Redirect (sourceURL differs) ---
	if (sourceURL && sameHost(requestedUrl, sourceURL)) {
		const srcPath = normalizePath(sourceURL);
		if (reqPath !== srcPath) {
			return {
				isBogus: true,
				reason: `Redirected from ${reqPath} to ${srcPath}`,
				heuristic: "redirect",
			};
		}
	}

	// --- Heuristic 2: Canonical mismatch ---
	const canonical = extraction.extraction.metadata.canonical;
	if (canonical.present && canonical.href) {
		const canonPath = normalizePath(canonical.href);
		if (sameHost(requestedUrl, canonical.href) && reqPath !== canonPath) {
			return {
				isBogus: true,
				reason: `Canonical mismatch: requested ${reqPath}, canonical ${canonPath}`,
				heuristic: "canonical-mismatch",
			};
		}
	}

	// --- Heuristic 3: Auth wall ---
	const title = extraction.extraction.metadata.title;
	const wordCount = extraction.extraction.content_snapshot.word_count;
	if (title.present && title.content && AUTH_WALL_RE.test(title.content)) {
		const requestedType = detectPageType(requestedUrl);
		if (requestedType !== "login" && requestedType !== "signup" && wordCount < 200) {
			return {
				isBogus: true,
				reason: `Auth wall detected: title "${title.content}" on ${requestedType} page`,
				heuristic: "auth-wall",
			};
		}
	}

	// --- Heuristic 4: Soft 404 ---
	const desc = extraction.extraction.metadata.meta_description;
	const maxTitleLen = (brandName?.length ?? 0) + 5;
	const titleIsGeneric = !title.present || !title.content || title.content.length <= maxTitleLen;
	const descMissing = !desc.present || !desc.content || desc.content.length === 0;
	const noCanonical = !canonical.present || !canonical.href;

	if (titleIsGeneric && descMissing && wordCount < 100 && noCanonical) {
		return {
			isBogus: true,
			reason: `Soft 404: generic title "${title.content ?? "(none)"}", no description, ${wordCount} words`,
			heuristic: "soft-404",
		};
	}

	return NOT_BOGUS;
}
