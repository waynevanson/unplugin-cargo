import path from "node:path";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { rollup } from "rollup";
import { build } from "vite";
import wasm from "vite-plugin-wasm";
import { describe, expect, test } from "vitest";
import { cargo as cargoRollup } from "../src/rollup";
import { cargo as cargoVite } from "../src/vite";

const FIXTURE = path.resolve(import.meta.dirname, "../fixtures/lib");

describe("lib", () => {
	test(
		"should bundle rust to wasm with Vite",
		{ timeout: 60_000 },
		async () => {
			await expect(
				build({
					root: FIXTURE,
					logLevel: "silent",
					plugins: [
						cargoVite({
							pattern: "**/src/lib.rs",
							cargoBuildProfile: "jesus",
						}),
						wasm(),
					],
					build: {
						lib: {
							entry: "./src/lib.rs",
							formats: ["es"],
							fileName: "index",
						},
					},
				}),
			).resolves.not.toThrow();
		},
	);

	test(
		"should transform rust to wasm with Rollup",
		{ timeout: 60_000 },
		async () => {
			const bundle = await rollup({
				input: path.resolve(FIXTURE, "src/lib.rs"),
				plugins: [
					cargoRollup({
						pattern: "**/src/lib.rs",
						cargoBuildProfile: "jesus",
					}),
					nodeResolve(),
				],
				external: (id) => id.endsWith(".wasm"),
			});

			const { output } = await bundle.generate({ format: "es" });

			expect(output).toHaveLength(1);
			expect(output[0].code).toContain("wasm");

			await bundle.close();
		},
	);
});
