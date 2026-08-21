import fs from "node:fs/promises";
import path from "node:path";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { rollup } from "rollup";
import type { UnpluginCargoOptions } from "../../../src/index";
import { createHtml } from "../create-html";
import { getFixture } from "../fixture";
import { importCargo } from "../import-cargo";
import { rollupWasmBindgen } from "../rollup-wasm-bindgen";

export async function buildWithRollup(
	options: UnpluginCargoOptions,
): Promise<string> {
	const fixture = await getFixture(options);
	const outDir = path.resolve(fixture, "dists", `dist-rollup-${Date.now()}`);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("rollup");
	const bundle = await rollup({
		input: path.resolve(fixture, "src/index.js"),
		plugins: [
			// @ts-expect-error
			cargo(options),
			rollupWasmBindgen(),
			nodeResolve(),
		],
	});
	await bundle.write({
		format: "es",
		dir: outDir,
	});
	await bundle.close();
	await createHtml(outDir, "./index.js");
	return outDir;
}
