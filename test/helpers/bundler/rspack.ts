import fs from "node:fs/promises";
import path from "node:path";
import { rspack } from "@rspack/core";
// @ts-expect-error
import RspackHtmlPlugin from "@rspack/plugin-html";
import type { UnpluginCargoOptions } from "../../../src/index";
import { getFixture } from "../fixture";
import { importCargo } from "../import-cargo";

export async function buildWithRspack(
	options: UnpluginCargoOptions,
	fixture?: string,
): Promise<string> {
	const fixtureRoot = fixture ?? (await getFixture(options));
	const outDir = path.resolve(
		fixtureRoot,
		"dists",
		`dist-rspack-${Date.now()}`,
	);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("rspack");
	await new Promise<void>((resolve, reject) => {
		rspack(
			{
				mode: "production",
				entry: path.resolve(fixtureRoot, "src/index.js"),
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
					// @ts-expect-error
					new RspackHtmlPlugin({
						template: path.resolve(fixtureRoot, "index.html"),
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
