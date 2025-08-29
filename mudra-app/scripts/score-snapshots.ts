import fs from "node:fs/promises";
import path from "node:path";
import { toScrapeSnapshot } from "@/lib/analysis/technical/adapter";
import { validateScrapeSnapshot } from "@/lib/analysis/technical/validate";
import { computeTechnicalScore } from "@/lib/analysis/technical/score";

async function readJson(filePath: string): Promise<unknown> {
	const content = await fs.readFile(filePath, "utf8");
	try {
		return JSON.parse(content);
	} catch (err) {
		throw new Error(`Invalid JSON in ${filePath}: ${(err as Error).message}`);
	}
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length === 0) {
		console.error("Usage: tsx scripts/score-snapshots.ts <file1.json> <file2.json> ...");
		process.exit(1);
	}

	for (const p of args) {
		const filePath = path.resolve(process.cwd(), p);
		try {
			const raw = await readJson(filePath);
			const snapshot = toScrapeSnapshot(raw);
			const validation = validateScrapeSnapshot(snapshot);
			if (!validation.ok) {
				console.log(`\n❌ ${filePath}`);
				console.log("Validation errors:", validation.errors);
				continue;
			}
			const score = computeTechnicalScore(snapshot);
			console.log(`\n✅ ${filePath}`);
			console.log(`URL: ${snapshot.url}`);
			console.log(`Total Score: ${score.total}`);
			for (const c of score.components) {
				console.log(` - [${c.category}] ${c.label}: ${c.score}/${c.max}`);
			}
		} catch (err) {
			console.log(`\n❌ ${filePath}`);
			console.log((err as Error).message);
		}
	}
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();


