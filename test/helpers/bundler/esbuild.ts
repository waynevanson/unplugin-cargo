import fs from "node:fs/promises";
import path from "node:path";
import * as esbuild from "esbuild";
import { wasmLoader } from "esbuild-plugin-wasm";
import type { UnpluginCargoOptions } from "../../../src/index";
import { createHtml } from "../create-html";
import { getFixture } from "../fixture";
import { importCargo } from "../import-cargo";

export async function buildWithEsbuild(
	options: UnpluginCargoOptions,
	fixture?: string,
): Promise<string> {
	const fixtureRoot = fixture ?? (await getFixture(options));
	const outDir = path.resolve(
		fixtureRoot,
		"dists",
		`dist-esbuild-${Date.now()}`,
	);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("esbuild");
	await esbuild.build({
		entryPoints: [path.resolve(fixtureRoot, "src/index.js")],
		bundle: true,
		format: "esm",
		outdir: outDir,
		loader: { ".rs": "js" },
		plugins: [wasmLoader(), cargo(options)],
	});
	await createHtml(outDir, "./index.js");
	return outDir;
}
