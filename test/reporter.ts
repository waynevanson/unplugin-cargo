import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import type {
	Reporter,
	TestCase,
	TestModule,
	TestSuite,
	Vitest,
} from "vitest/node";
import { experimental_getRunnerTask } from "vitest/node";

const execFileAsync = promisify(execFile);

export interface DurationsReporterOptions {
	outputFile?: string;
	historyFile?: string;
	strictNames?: boolean;
	showDiff?: boolean;
}

interface DurationEntry {
	timestamp: string;
	commit?: string;
	fullName: string;
	duration: number;
}

interface HistoryEntry {
	timestamp: string;
	commit?: string;
	durations: Record<string, number>;
}

export default class DurationsReporter implements Reporter {
	private readonly outputFile: string;
	private readonly historyFile: string;
	private readonly strictNames: boolean;
	private readonly showDiff: boolean;
	private previousDurations = new Map<string, number>();
	private logger?: Vitest["logger"];
	private vitest?: Vitest;
	private commit?: string;

	constructor(options: DurationsReporterOptions = {}) {
		this.outputFile = options.outputFile ?? "test-durations.jsonl";
		this.historyFile = options.historyFile ?? "test-durations.history.jsonl";
		this.strictNames = options.strictNames ?? true;
		this.showDiff = options.showDiff ?? false;
	}

	onInit(vitest: Vitest) {
		this.vitest = vitest;
		this.logger = vitest.logger;
	}

	async onTestRunStart() {
		this.commit = await this.resolveCommit();
		if (this.showDiff) {
			this.previousDurations = await this.loadLatestDurations();
		}
	}

	async onTestCaseResult(testCase: TestCase) {
		if (!this.showDiff) return;

		const diagnostic = testCase.diagnostic();
		if (!diagnostic) return;

		const previous = this.previousDurations.get(testCase.fullName);
		if (previous === undefined) return;

		const message = this.formatDiff(diagnostic.duration, previous);
		this.logger?.log(`  ${testCase.fullName}: ${message}`);

		const task = experimental_getRunnerTask(testCase);
		const annotation = {
			type: "duration-diff",
			message,
		};
		task.annotations.push(annotation);
		const vitest = this.vitest as unknown as {
			report?: (
				event: "onTestCaseAnnotate",
				testCase: TestCase,
				annotation: unknown,
			) => Promise<void> | void;
		};
		await vitest.report?.("onTestCaseAnnotate", testCase, annotation);
	}

	async onTestSuiteResult(testSuite: TestSuite) {
		if (!this.showDiff) return;

		let current = 0;
		let previous = 0;
		for (const test of testSuite.children.allTests()) {
			if (test.result().state === "skipped") continue;
			const diagnostic = test.diagnostic();
			if (!diagnostic) continue;
			const prev = this.previousDurations.get(test.fullName);
			if (prev === undefined) continue;
			current += diagnostic.duration;
			previous += prev;
		}

		if (previous === 0) return;

		const message = this.formatDiff(current, previous);
		this.logger?.log(`  ${testSuite.fullName}: ${message}`);

		const task = experimental_getRunnerTask(testSuite);
		task.meta = { ...task.meta, durationDiff: message } as typeof task.meta;
	}

	async onTestRunEnd(testModules: ReadonlyArray<TestModule>) {
		const timestamp = new Date().toISOString();
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
					commit: this.commit,
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
			await writeFile(this.outputFile, `${lines}\n`, "utf-8");
			await this.writeHistory({
				timestamp,
				commit: this.commit,
				durations: Object.fromEntries(
					entries.map((entry) => [entry.fullName, entry.duration]),
				),
			});
		}

		if (this.showDiff && entries.length > 0) {
			let current = 0;
			let previous = 0;
			for (const entry of entries) {
				const prev = this.previousDurations.get(entry.fullName);
				if (prev === undefined) continue;
				current += entry.duration;
				previous += prev;
			}
			if (previous > 0) {
				this.logger?.log(`  all tests: ${this.formatDiff(current, previous)}`);
			}
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
		if (latestTimestamp === undefined) return undefined;
		return byTimestamp.get(latestTimestamp);
	}

	private setsEqual(a: Set<string>, b: Set<string>) {
		if (a.size !== b.size) return false;
		for (const value of a) {
			if (!b.has(value)) return false;
		}
		return true;
	}

	private formatDiff(current: number, previous: number): string {
		const diff = current - previous;
		const pct = previous === 0 ? 0 : ((previous - current) / previous) * 100;

		const absPct = Math.abs(pct).toFixed(1);
		const absDiff = Math.abs(diff).toFixed(1);
		const direction = pct > 0 ? "faster" : pct < 0 ? "slower" : "same";
		const sign = diff <= 0 ? "-" : "+";

		return `${absPct}% ${direction} (${sign}${absDiff}ms vs last run)`;
	}

	private async loadLatestDurations(): Promise<Map<string, number>> {
		let content: string;
		try {
			content = await readFile(this.outputFile, "utf-8");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return new Map();
			}
			throw error;
		}

		const latest = new Map<string, { timestamp: string; duration: number }>();
		for (const line of content.split("\n")) {
			if (!line.trim()) continue;
			let entry: DurationEntry;
			try {
				entry = JSON.parse(line) as DurationEntry;
			} catch {
				continue;
			}
			const existing = latest.get(entry.fullName);
			if (!existing || entry.timestamp > existing.timestamp) {
				latest.set(entry.fullName, {
					timestamp: entry.timestamp,
					duration: entry.duration,
				});
			}
		}

		return new Map(
			[...latest.entries()].map(([fullName, { duration }]) => [
				fullName,
				duration,
			]),
		);
	}

	private async resolveCommit(): Promise<string | undefined> {
		const fromEnv =
			process.env.COMMIT_SHA ??
			process.env.GITHUB_SHA ??
			process.env.GIT_COMMIT;
		if (fromEnv) return fromEnv;

		try {
			const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
				encoding: "utf-8",
			});
			return stdout.trim() || undefined;
		} catch {
			return undefined;
		}
	}

	private async writeHistory(entry: HistoryEntry) {
		let content = "";
		try {
			content = await readFile(this.historyFile, "utf-8");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}

		const lines = content.split("\n").filter((line) => line.trim());
		if (entry.commit) {
			const index = lines.findIndex((line) => {
				let parsed: HistoryEntry | undefined;
				try {
					parsed = JSON.parse(line) as HistoryEntry;
				} catch {
					return false;
				}
				return parsed.commit === entry.commit;
			});
			if (index !== -1) {
				const existing = JSON.parse(lines[index]) as HistoryEntry;
				lines[index] = JSON.stringify({
					...entry,
					durations: { ...existing.durations, ...entry.durations },
				});
			} else {
				lines.push(JSON.stringify(entry));
			}
		} else {
			lines.push(JSON.stringify(entry));
		}

		await writeFile(
			this.historyFile,
			lines.length > 0 ? `${lines.join("\n")}\n` : "",
			"utf-8",
		);
	}
}
