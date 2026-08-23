import { appendFile, readFile } from "node:fs/promises";
import type { Reporter, TestModule } from "vitest";

export interface DurationsReporterOptions {
	outputFile?: string;
	strictNames?: boolean;
}

interface DurationEntry {
	timestamp: string;
	commit?: string;
	fullName: string;
	duration: number;
}

export default class DurationsReporter implements Reporter {
	private readonly outputFile: string;
	private readonly strictNames: boolean;

	constructor(options: DurationsReporterOptions = {}) {
		this.outputFile = options.outputFile ?? "test-durations.jsonl";
		this.strictNames = options.strictNames ?? true;
	}

	async onTestRunEnd(testModules: ReadonlyArray<TestModule>) {
		const timestamp = new Date().toISOString();
		const commit = process.env.COMMIT_SHA ?? process.env.GITHUB_SHA;
		const entries: DurationEntry[] = [];
		const names = new Set<string>();

		for (const testModule of testModules) {
			for (const test of testModule.children.allTests()) {
				if (test.result().state === "skipped") continue;

				const diagnostic = test.diagnostic();
				if (!diagnostic) continue;

				const fullName = test.fullName;
				if (names.has(fullName)) {
					throw new Error(`Duplicate full test name: ${fullName}`);
				}
				names.add(fullName);

				entries.push({
					timestamp,
					commit,
					fullName,
					duration: diagnostic.duration,
				});
			}
		}

		if (this.strictNames) {
			await this.assertSameNames(names);
		}

		if (entries.length > 0) {
			const lines = entries.map((entry) => JSON.stringify(entry)).join("\n");
			await appendFile(this.outputFile, `${lines}\n`, "utf-8");
		}
	}

	private async assertSameNames(currentNames: Set<string>) {
		const previousNames = await this.loadLatestNames();
		if (!previousNames) return;

		if (!this.setsEqual(currentNames, previousNames)) {
			throw new Error(
				[
					"Full test names changed since last run.",
					`Previous (${previousNames.size}): ${[...previousNames].sort().join(", ")}`,
					`Current  (${currentNames.size}): ${[...currentNames].sort().join(", ")}`,
				].join("\n"),
			);
		}
	}

	private async loadLatestNames(): Promise<Set<string> | undefined> {
		let content: string;
		try {
			content = await readFile(this.outputFile, "utf-8");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
			throw error;
		}

		const byTimestamp = new Map<string, Set<string>>();
		for (const line of content.split("\n")) {
			if (!line.trim()) continue;
			let entry: DurationEntry;
			try {
				entry = JSON.parse(line) as DurationEntry;
			} catch {
				continue;
			}
			const set = byTimestamp.get(entry.timestamp) ?? new Set<string>();
			set.add(entry.fullName);
			byTimestamp.set(entry.timestamp, set);
		}

		if (byTimestamp.size === 0) return undefined;

		const latestTimestamp = [...byTimestamp.keys()].sort().pop();
		return byTimestamp.get(latestTimestamp);
	}

	private setsEqual(a: Set<string>, b: Set<string>) {
		if (a.size !== b.size) return false;
		for (const value of a) {
			if (!b.has(value)) return false;
		}
		return true;
	}
}
