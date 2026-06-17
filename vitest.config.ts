import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globalSetup: ["./test/globalSetup.ts"],
		testTimeout: 120_000,
		fileParallelism: false,
		env: {
			PATH: `/nix/store/5kz6nyq2h8ng57pas6h1xr99x8jmpcnk-rustup-1.27.1/bin:${process.env.PATH}`,
		},
	},
});
