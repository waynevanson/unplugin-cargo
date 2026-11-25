import path from "node:path";
import { createCompiler, NoopLogger, resolveConfig } from "@farmfe/core";
import pino from "pino";
import type { UnpluginCargoOptions } from "../../../src/index";
import { findProjectFilePath } from "../../../src/internal/find-project-file-path";
import { matchesPattern } from "../../../src/internal/pattern";
import { getFixture } from "../fixture";
import { importCargo } from "../import-cargo";
import { farmWasmPlugin } from "./farm-wasm";

const log = pino({ level: "silent" });

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
				() => ({
					vitePlugin: farmRustFallbackPlugin(options),
					filters: [".*"],
				}),
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

function farmRustFallbackPlugin(options: UnpluginCargoOptions) {
	return {
		name: "farm-rust-fallback",
		enforce: "post" as const,
		load(id: string) {
			if (!id.toLowerCase().endsWith(".rs")) {
				return null;
			}

			// Only ignore Rust files the cargo plugin intentionally skips.
			// A matching entrypoint that reaches this hook must fail loudly
			// instead of being replaced with an empty module.
			const projectFilePath = findProjectFilePath(id, log);
			if (projectFilePath === undefined) {
				return { code: "", map: null };
			}

			const relativeFilePath = path
				.relative(path.dirname(projectFilePath), id)
				.replace(/\\/g, "/");

			if (!matchesPattern(relativeFilePath, options.pattern)) {
				return { code: "", map: null };
			}

			return null;
		},
	};
}
