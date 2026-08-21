import fs from "node:fs/promises";
import path from "node:path";
import * as esbuild from "esbuild";
import type { UnpluginCargoOptions } from "../../../dist/index";
import { clearCargoCache } from "../clear-cargo-cache";
import { createHtml } from "../create-html";
import { findWasmInCache } from "../find-wasm-in-cache";
import { createFixture } from "../fixture";
import { importCargo } from "../import-cargo";

export async function buildWithEsbuild(
	options: UnpluginCargoOptions,
): Promise<string> {
	await clearCargoCache();
	const fixture = await createFixture();
	const outDir = path.resolve(fixture, "dists", `dist-esbuild-${Date.now()}`);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("esbuild");
	await esbuild.build({
		entryPoints: [path.resolve(fixture, "src/index.js")],
		bundle: true,
		format: "esm",
		outdir: outDir,
		plugins: [
			{
				name: "wasm-bindgen",
				setup(build) {
					build.onResolve({ filter: /\.wasm$/ }, async (args) => {
						const realPath = args.path.replace(/^unplugin-cargo:/, "");
						if (path.isAbsolute(realPath)) {
							return {
								path: realPath,
								namespace: "wasm",
							};
						}
						// Try to find the wasm file in the unplugin cache
						const wasmPath = await findWasmInCache(path.basename(realPath));
						if (wasmPath) {
							return {
								path: wasmPath,
								namespace: "wasm",
							};
						}
						return null;
					});
					build.onLoad({ filter: /.*/, namespace: "wasm" }, async (args) => {
						const buffer = await fs.readFile(args.path);
						const module = new WebAssembly.Module(buffer);
						const imports = WebAssembly.Module.imports(module);
						const exports = WebAssembly.Module.exports(module);

						const importMap = new Map<string, Map<string, string>>();
						for (const imp of imports) {
							if (!importMap.has(imp.module)) {
								importMap.set(imp.module, new Map());
							}
							importMap
								.get(imp.module)
								?.set(
									imp.name,
									`_${imp.module.replace(/[^a-zA-Z0-9]/g, "_")}_${imp.name}`,
								);
						}

						const importLines: string[] = [];
						for (const [mod, names] of importMap) {
							const specifiers = Array.from(names.entries())
								.map(([name, local]) => `${name} as ${local}`)
								.join(", ");
							importLines.push(
								`import { ${specifiers} } from ${JSON.stringify(mod)};`,
							);
						}

						const importObjLines: string[] = [];
						for (const [mod, names] of importMap) {
							const entries = Array.from(names.entries())
								.map(([name, local]) => `${JSON.stringify(name)}: ${local}`)
								.join(", ");
							importObjLines.push(`${JSON.stringify(mod)}: { ${entries} }`);
						}

						const exportLines = exports
							.map(
								(exp) =>
									`export const ${exp.name} = instance.exports.${exp.name};`,
							)
							.join("\n");

						const code = [
							...importLines,
							`const module_ = new WebAssembly.Module(new Uint8Array([${Array.from(buffer).join(",")}]));`,
							`const instance = new WebAssembly.Instance(module_, { ${importObjLines.join(", ")} });`,
							exportLines,
						].join("\n");

						return {
							contents: code,
							loader: "js" as const,
							resolveDir: path.dirname(args.path),
						};
					});
				},
			},
			// @ts-expect-error
			cargo(options),
		],
	});
	await createHtml(outDir, "./index.js");
	return outDir;
}
