import fs from "node:fs/promises";
import path from "node:path";
import wasm from "vite-plugin-wasm";
import type { UnpluginCargoOptions } from "../../../src/index";
import { getFixture } from "../fixture";
import { importCargo } from "../import-cargo";

export async function buildWithFarm(
	options: UnpluginCargoOptions,
): Promise<string> {
	const fixture = await getFixture(options);
	const outDir = path.resolve(fixture, "dists", `dist-farm-${Date.now()}`);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("vite"); // Farm is vite-compatible
	const { createCompiler } = await import("@farmfe/core");
	const compiler = await createCompiler({
		compilation: {
			input: {
				index: path.resolve(fixture, "index.html"),
			},
			output: {
				path: outDir,
			},
		},
		plugins: [
			// @ts-expect-error
			cargo(options),
			// @ts-expect-error
			wasm(),
		],
	});
	await compiler.compile();
	await compiler.writeResourcesToDisk();
	return outDir;
}
