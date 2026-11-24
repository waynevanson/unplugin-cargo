import fs from "node:fs/promises";
import path from "node:path";
import { rspack } from "@rspack/core";
import RspackHtmlPlugin from "@rspack/plugin-html";
import type { UnpluginCargoOptions } from "../../../src/index";
import { importCargo } from "../import-cargo";
import { WatchQueue } from "./queue";
import type { WatchSession } from "./types";

export async function watchWithRspack(
	fixture: string,
	options: UnpluginCargoOptions,
	outDir = path.resolve(fixture, "dists", `dist-watch-rspack-${Date.now()}`),
): Promise<WatchSession> {
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("rspack");
	const queue = new WatchQueue();

	const compiler = rspack({
		mode: "production",
		entry: path.resolve(fixture, "src/index.js"),
		output: {
			path: outDir,
			filename: "index.js",
		},
		module: {
			rules: [
				{
					test: /\.wasm$/,
					type: "javascript/auto",
					use: [
						{
							loader: path.resolve(
								import.meta.dirname,
								"../webpack-wasm-loader.ts",
							),
						},
					],
				},
			],
		},
		plugins: [
			cargo(options),
			new RspackHtmlPlugin({
				template: path.resolve(fixture, "index.html"),
			}),
		],
	});

	const watching = compiler.watch({}, (err, stats) => {
		if (err) {
			queue.reject(err);
		} else if (stats?.hasErrors()) {
			queue.reject(new Error(stats.toString()));
		} else {
			queue.resolve();
		}
	});

	await queue.wait();

	return {
		outDir,
		waitForRebuild: () => queue.wait(),
		close: () =>
			new Promise((resolve, reject) => {
				try {
					watching.close(() => resolve());
				} catch (error) {
					reject(error);
				}
			}),
	};
}
