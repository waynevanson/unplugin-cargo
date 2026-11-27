import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			exclude: ["test/**"],
		},
		reporters: [
			"default",
			[
				"./test/reporter.ts",
				{
					outputFile: "./test-durations.jsonl",
					historyFile: "./test-durations.history.jsonl",
					strictNames: true,
					showDiff: true,
				},
			],
		],
		projects: [
			{
				test: {
					name: "src",
					include: ["src/**/*.test.ts"],
					testTimeout: 120_000,
				},
			},
			{
				test: {
					name: "test",
					include: ["test/**/*.spec.ts"],
					globalSetup: ["./test/globalSetup.ts"],
					testTimeout: 120_000,
					// These suites invoke Cargo and a browser. Running more than one
					// at a time oversubscribes the machine and causes timeouts.
					fileParallelism: false,
				},
			},
		],
	},
});
