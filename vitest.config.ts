import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// todo: deleta all but this line
		globalSetup: ["./test/globalSetup.ts"],
		include: ["src/**/*.test.ts", "test/**/*.spec.ts"],
		testTimeout: 120_000,
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
	},
});
