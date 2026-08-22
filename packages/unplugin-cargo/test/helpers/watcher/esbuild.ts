import fs from "node:fs/promises";
import path from "node:path";
import * as esbuild from "esbuild";
import { wasmLoader } from "esbuild-plugin-wasm";
import type { UnpluginCargoOptions } from "../../../src/index";
import { createHtml } from "../create-html";
import { importCargo } from "../import-cargo";
import { WatchQueue } from "./queue";
import type { WatchSession } from "./types";

export async function watchWithEsbuild(
	fixture: string,
	options: UnpluginCargoOptions,
	outDir = path.resolve(fixture, "dists", `dist-watch-esbuild-${Date.now()}`),
): Promise<WatchSession> {
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("esbuild");
	const queue = new WatchQueue();

	const context = await esbuild.context({
		entryPoints: [path.resolve(fixture, "src/index.js")],
		bundle: true,
		format: "esm",
		outdir: outDir,
		plugins: [
			{
				name: "watch-tracker",
				setup(build) {
					build.onEnd((result) => {
						if (result.errors.length > 0) {
							queue.reject(new Error(JSON.stringify(result.errors)));
						} else {
							queue.resolve();
						}
					});
				},
			},
			// @ts-expect-error
			wasmLoader(),
			// @ts-expect-error
			cargo(options),
		],
	});

	await context.watch();
	await queue.wait();
	await createHtml(outDir, "./index.js");

	return {
		outDir,
		waitForRebuild: () => queue.wait(),
		close: () => context.dispose(),
	};
}
