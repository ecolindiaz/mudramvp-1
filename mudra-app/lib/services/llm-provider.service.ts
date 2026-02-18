/**
 * Multi-Provider LLM Caller
 *
 * Tries providers in order (Anthropic → OpenAI → Google) and falls through
 * on 429/503 rate-limit errors. Shared by generate-script and potentially
 * the deploy agent path.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface LlmCallOptions {
	userPrompt: string;
	systemPrompt: string;
	maxTokens?: number; // default 2048
}

export interface LlmCallResult {
	text: string;
	provider: string;
	model: string;
}

interface ProviderConfig {
	name: string;
	model: string;
	call: (opts: LlmCallOptions) => Promise<string>;
}

function getRetryAfterMs(err: unknown): number | null {
	const headers =
		(err as { headers?: Record<string, string> })?.headers ??
		(err as { response?: { headers?: Record<string, string> } })?.response
			?.headers;
	if (!headers) return null;
	const val = headers["retry-after"] ?? headers["Retry-After"];
	if (!val) return null;
	const secs = Number(val);
	if (Number.isNaN(secs) || secs <= 0 || secs > 10) return null;
	return secs * 1000;
}

function isRateLimitOrOverload(err: unknown): boolean {
	const status =
		(err as { status?: number })?.status ??
		(err as { statusCode?: number })?.statusCode ??
		(err as { httpCode?: number })?.httpCode;
	return status === 429 || status === 503;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildProviders(): ProviderConfig[] {
	const providers: ProviderConfig[] = [];

	// Anthropic
	const anthropicKey = process.env.ANTHROPIC_API_KEY;
	if (anthropicKey) {
		const model =
			process.env.SCRIPT_GEN_ANTHROPIC_MODEL ||
			"claude-sonnet-4-5-20250929";
		providers.push({
			name: "anthropic",
			model,
			call: async (opts) => {
				const client = new Anthropic({ apiKey: anthropicKey });
				const response = await client.messages.create({
					model,
					max_tokens: opts.maxTokens ?? 2048,
					system: opts.systemPrompt,
					messages: [{ role: "user", content: opts.userPrompt }],
				});
				const text = response.content.find((c) => c.type === "text");
				if (!text || text.type !== "text")
					throw new Error("No text response from Anthropic");
				return text.text;
			},
		});
	}

	// OpenAI
	const openaiKey = process.env.OPENAI_API_KEY;
	if (openaiKey) {
		const model = process.env.SCRIPT_GEN_OPENAI_MODEL || "gpt-4o";
		providers.push({
			name: "openai",
			model,
			call: async (opts) => {
				const { default: OpenAI } = await import("openai");
				const client = new OpenAI({ apiKey: openaiKey });
				const response = await client.chat.completions.create({
					model,
					max_tokens: opts.maxTokens ?? 2048,
					messages: [
						{ role: "system", content: opts.systemPrompt },
						{ role: "user", content: opts.userPrompt },
					],
				});
				const text = response.choices[0]?.message?.content;
				if (!text) throw new Error("No text response from OpenAI");
				return text;
			},
		});
	}

	// Google
	const googleKey =
		process.env.GEMINI_API_KEY ||
		process.env.GOOGLE_API_KEY ||
		process.env.GOOGLE_GENERATIVE_AI_API_KEY;
	if (googleKey) {
		const model =
			process.env.SCRIPT_GEN_GOOGLE_MODEL ||
			"gemini-2.0-flash";
		providers.push({
			name: "google",
			model,
			call: async (opts) => {
				const { GoogleGenerativeAI } = await import(
					"@google/generative-ai"
				);
				const genAI = new GoogleGenerativeAI(googleKey);
				const genModel = genAI.getGenerativeModel({ model });
				const result = await genModel.generateContent({
					systemInstruction: opts.systemPrompt,
					contents: [
						{ role: "user", parts: [{ text: opts.userPrompt }] },
					],
				});
				const text = result.response.text();
				if (!text) throw new Error("No text response from Google");
				return text;
			},
		});
	}

	return providers;
}

/**
 * Call an LLM with automatic provider fallback on 429/503.
 * Returns null if all providers are exhausted or none are configured.
 */
export async function callLlm(
	opts: LlmCallOptions
): Promise<LlmCallResult | null> {
	const providers = buildProviders();
	if (providers.length === 0) {
		console.warn("[LlmProvider] No LLM API keys configured");
		return null;
	}

	for (const provider of providers) {
		try {
			console.log(`[LlmProvider] Trying ${provider.name}...`);
			const text = await provider.call(opts);
			console.log(
				`[LlmProvider] ${provider.name} succeeded (${text.length} chars)`
			);
			return { text, provider: provider.name, model: provider.model };
		} catch (err) {
			if (isRateLimitOrOverload(err)) {
				const retryMs = getRetryAfterMs(err);
				if (retryMs) {
					console.log(
						`[LlmProvider] ${provider.name} rate-limited, retrying after ${retryMs}ms...`
					);
					await sleep(retryMs);
					try {
						const text = await provider.call(opts);
						return { text, provider: provider.name, model: provider.model };
					} catch (retryErr) {
						console.warn(
							`[LlmProvider] ${provider.name} retry failed, falling through`,
							retryErr instanceof Error
								? retryErr.message
								: retryErr
						);
					}
				} else {
					console.warn(
						`[LlmProvider] ${provider.name} rate-limited (no viable Retry-After), falling through`
					);
				}
			} else {
				console.warn(
					`[LlmProvider] ${provider.name} failed:`,
					err instanceof Error ? err.message : err
				);
			}
		}
	}

	console.error("[LlmProvider] All providers exhausted");
	return null;
}
