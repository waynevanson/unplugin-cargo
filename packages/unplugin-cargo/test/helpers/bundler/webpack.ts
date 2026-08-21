import path from "node:path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import webpack from "webpack";
import type { UnpluginCargoOptions } from "../../../src/index";
import { getFixture } from "../fixture";
import { importCargo } from "../import-cargo";

export async function buildWithWebpack(
	options: UnpluginCargoOptions,
): Promise<string> {
	const fixture = await getFixture(options);
	const outDir = path.resolve(fixture, "dists", `dist-webpack-${Date.now()}`);
	const cargo = await importCargo("webpack");
	await new Promise<void>((resolve, reject) => {
		webpack(
			{
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
					// @ts-expect-error
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
			},
			(err, stats) => {
				if (err) return reject(err);
				if (stats?.hasErrors()) return reject(new Error(stats.toString()));
				resolve();
			},
		);
	});
	return outDir;
}
