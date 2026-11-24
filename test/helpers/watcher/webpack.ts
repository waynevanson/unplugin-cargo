import fs from "node:fs/promises";
import path from "node:path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import webpack from "webpack";
import type { UnpluginCargoOptions } from "../../../src/index";
import { importCargo } from "../import-cargo";
import { WatchQueue } from "./queue";
import type { WatchSession } from "./types";

export async function watchWithWebpack(
	fixture: string,
	options: UnpluginCargoOptions,
	outDir = path.resolve(fixture, "dists", `dist-watch-webpack-${Date.now()}`),
): Promise<WatchSession> {
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("webpack");
	const queue = new WatchQueue();

	const compiler = webpack({
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
			new HtmlWebpackPlugin({
				templateContent: `<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<div id="result"></div>
</body>
</html>`,
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

	if (!watching) {
		throw new Error("Expected webpack to return a watcher");
	}

	await queue.wait();

	return {
		outDir,
		waitForRebuild: () => queue.wait(),
		close: () =>
			new Promise((resolve, reject) =>
				watching.close((err) => (err ? reject(err) : resolve())),
			),
	};
}
