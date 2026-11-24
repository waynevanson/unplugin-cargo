import fs from "node:fs/promises";
import path from "node:path";
import type { UnpluginCargoOptions } from "../../../src/index";
import { createHtml } from "../create-html";
import { getFixture } from "../fixture";
import { importCargo } from "../import-cargo";
import { rollupWasmBindgen } from "../rollup-wasm-bindgen";

export async function buildWithRolldown(
	options: UnpluginCargoOptions,
	fixture?: string,
): Promise<string> {
	const fixtureRoot = fixture ?? (await getFixture(options));
	const outDir = path.resolve(
		fixtureRoot,
		"dists",
		`dist-rolldown-${Date.now()}`,
	);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("rollup"); // rolldown is rollup-compatible
	const { rolldown } = await import("rolldown");
	const bundle = await rolldown({
		input: path.resolve(fixtureRoot, "src/index.js"),
		plugins: [
			// @ts-expect-error
			cargo(options),
			// @ts-expect-error
			rollupWasmBindgen(),
		],
		// @ts-expect-error rolldown supports `checks` but types lag behind
		checks: {
			pluginTimings: false,
		},
	});
	await bundle.write({
		format: "esm",
		dir: outDir,
	});
	await createHtml(outDir, "./index.js");
	return outDir;
}
