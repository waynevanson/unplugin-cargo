import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// todo: deleta all but this line
		globalSetup: ["./test/globalSetup.ts"],
		testTimeout: 15_000,
	},
});
