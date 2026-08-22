import path from "node:path";
import { createCompiler, NoopLogger, resolveConfig } from "@farmfe/core";
import type { UnpluginCargoOptions } from "../../../src/index";
import { getFixture } from "../fixture";
import { importCargo } from "../import-cargo";
import { farmWasmPlugin } from "./farm-wasm";

export async function buildWithFarm(
	options: UnpluginCargoOptions,
): Promise<string> {
	const fixture = await getFixture(options);
	const outDir = path.resolve(fixture, "dists", `dist-farm-${Date.now()}`);
	const cargo = await importCargo("farm");
	const resolvedConfig = await resolveConfig(
		{
			root: fixture,
			compilation: {
				input: {
					index: path.resolve(fixture, "index.html"),
				},
				output: {
					path: outDir,
				},
				presetEnv: false,
			},
			plugins: [cargo(options)],
			vitePlugins: [() => ({ vitePlugin: farmWasmPlugin(), filters: [".*"] })],
		},
		"production",
		new NoopLogger(),
		false,
	);
	const compiler = await createCompiler(resolvedConfig, new NoopLogger());
	await compiler.compile();
	await compiler.writeResourcesToDisk();
	return outDir;
}
