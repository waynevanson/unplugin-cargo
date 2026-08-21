import fs from "node:fs/promises";
import path from "node:path";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import type { UnpluginCargoOptions } from "../../../dist/index";
import { clearCargoCache } from "../clear-cargo-cache";
import { createHtml } from "../create-html";
import { createFixture } from "../fixture";
import { importCargo } from "../import-cargo";
import { rollupWasmBindgen } from "../rollup-wasm-bindgen";

export async function buildWithRolldown(
	options: UnpluginCargoOptions,
): Promise<string> {
	await clearCargoCache();
	const fixture = await createFixture();
	const outDir = path.resolve(fixture, "dists", `dist-rolldown-${Date.now()}`);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("rollup"); // rolldown is rollup-compatible
	const { rolldown } = await import("rolldown");
	const bundle = await rolldown({
		input: path.resolve(fixture, "src/index.js"),
		plugins: [
			// @ts-expect-error
			cargo(options),
			// @ts-expect-error
			rollupWasmBindgen(),
			nodeResolve(),
		],
	});
	await bundle.write({
		format: "esm",
		dir: outDir,
	});
	await createHtml(outDir, "./index.js");
	return outDir;
}
