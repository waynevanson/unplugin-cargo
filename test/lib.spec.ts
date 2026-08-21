import path from "node:path";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { rollup } from "rollup";
import { build } from "vite";
import wasm from "vite-plugin-wasm";
import { afterAll, describe, expect, test } from "vitest";
import { cargo as cargoRollup } from "../src/rollup";
import { cargo as cargoVite } from "../src/vite";
import { cleanupFixture, createFixture } from "./helpers/fixture";

describe("lib", () => {
	const fixtureRoots = new Set<string>();

	afterAll(async () => {
		for (const root of fixtureRoots) {
			await cleanupFixture(path.join(root, "dists", "placeholder"));
		}
	});

	test(
		"should bundle rust to wasm with Vite",
		{ timeout: 60_000 },
		async () => {
			const fixture = await createFixture();
			fixtureRoots.add(fixture);
			await expect(
				build({
					root: fixture,
					logLevel: "silent",
					plugins: [
						cargoVite({
							pattern: "**/src/lib.rs",
							cargoBuildProfile: "jesus",
						}),
						wasm(),
					],
					build: {
						outDir: path.resolve(fixture, "dists", "dist-lib"),
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
			const fixture = await createFixture();
			fixtureRoots.add(fixture);
			const bundle = await rollup({
				input: path.resolve(fixture, "src/lib.rs"),
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
