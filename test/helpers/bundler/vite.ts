import path from "node:path";
import { build } from "vite";
import wasm from "vite-plugin-wasm";
import type { UnpluginCargoOptions } from "../../../src/index";
import { getFixture } from "../fixture";
import { importCargo } from "../import-cargo";

export async function buildWithVite(
	options: UnpluginCargoOptions,
	fixture?: string,
): Promise<string> {
	const fixtureRoot = fixture ?? (await getFixture(options));
	const outDir = path.resolve(fixtureRoot, "dists", `dist-vite-${Date.now()}`);
	const cargo = await importCargo("vite");
	await build({
		root: fixtureRoot,
		logLevel: "silent",
		plugins: [cargo(options), wasm()],
		build: {
			outDir,
			emptyOutDir: true,
		},
	});
	return outDir;
}
