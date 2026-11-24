import path from "node:path";
import { createCompiler, NoopLogger, resolveConfig } from "@farmfe/core";
import type { UnpluginCargoOptions } from "../../../src/index";
import { getFixture } from "../fixture";
import { importCargo } from "../import-cargo";
import { farmWasmPlugin } from "./farm-wasm";

export async function buildWithFarm(
	options: UnpluginCargoOptions,
	fixture?: string,
): Promise<string> {
	const fixtureRoot = fixture ?? (await getFixture(options));
	const outDir = path.resolve(fixtureRoot, "dists", `dist-farm-${Date.now()}`);
	const cargo = await importCargo("farm");
	const resolvedConfig = await resolveConfig(
		{
			root: fixtureRoot,
			compilation: {
				input: {
					index: path.resolve(fixtureRoot, "index.html"),
				},
				output: {
					path: outDir,
				},
				presetEnv: false,
				persistentCache: false,
			},
			plugins: [cargo(options)],
			vitePlugins: [
				() => ({ vitePlugin: farmWasmPlugin(), filters: [".*"] }),
				() => ({ vitePlugin: farmRustFallbackPlugin(), filters: [".*"] }),
			],
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

function farmRustFallbackPlugin() {
	return {
		name: "farm-rust-fallback",
		enforce: "post" as const,
		load(id: string) {
			if (!id.toLowerCase().endsWith(".rs")) {
				return null;
			}

			return { code: "", map: null };
		},
	};
}
