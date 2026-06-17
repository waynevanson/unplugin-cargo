import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { build } from "vite";
import wasm from "vite-plugin-wasm";
import { rollup } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { rspack } from "@rspack/core";
// @ts-ignore
import RspackHtmlPlugin from "@rspack/plugin-html";
import * as esbuild from "esbuild";
import { type UnpluginCargoOptions } from "../../dist/index";

const FIXTURE = path.resolve(import.meta.dirname, "../../fixtures/lib");
const CARGO = path.resolve(import.meta.dirname, "../../dist");

async function importCargo(bundler: string) {
	const mod = await import(path.resolve(CARGO, `${bundler}.js`));
	return mod.cargo as (opts: UnpluginCargoOptions) => any;
}

function createHtml(outDir: string, scriptPath: string) {
	return fs.writeFile(
		path.join(outDir, "index.html"),
		`<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<div id="result"></div>
<script type="module" src="${scriptPath}"></script>
</body>
</html>`,
	);
}

// Custom Rollup plugin that synchronously instantiates wasm modules
// for wasm-bindgen's --target=bundler output.
function rollupWasmBindgen() {
	return {
		name: "wasm-bindgen",
		async resolveId(source: string, importer: string | undefined) {
			if (!source.endsWith(".wasm")) return null;
			if (!importer) return null;
			const resolved = path.resolve(path.dirname(importer), source);
			return { id: resolved, external: false };
		},
		async load(id: string) {
			if (!id.endsWith(".wasm")) return null;
			const buffer = await fs.readFile(id);
			const module = new WebAssembly.Module(buffer);
			const imports = WebAssembly.Module.imports(module);
			const exports = WebAssembly.Module.exports(module);

			// Build import map: module -> { name -> localName }
			const importMap = new Map<string, Map<string, string>>();
			for (const imp of imports) {
				if (!importMap.has(imp.module)) {
					importMap.set(imp.module, new Map());
				}
				importMap
					.get(imp.module)!
					.set(
						imp.name,
						`_${imp.module.replace(/[^a-zA-Z0-9]/g, "_")}_${imp.name}`,
					);
			}

			// Generate import statements
			const importLines: string[] = [];
			for (const [mod, names] of importMap) {
				const specifiers = Array.from(names.entries())
					.map(([name, local]) => `${name} as ${local}`)
					.join(", ");
				importLines.push(
					`import { ${specifiers} } from ${JSON.stringify(mod)};`,
				);
			}

			// Build imports object for instantiation
			const importObjLines: string[] = [];
			for (const [mod, names] of importMap) {
				const entries = Array.from(names.entries())
					.map(([name, local]) => `${JSON.stringify(name)}: ${local}`)
					.join(", ");
				importObjLines.push(
					`${JSON.stringify(mod)}: { ${entries} }`,
				);
			}

			// Build exports
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

			return { code, map: null };
		},
	};
}

export async function buildWithVite(
	options: UnpluginCargoOptions,
): Promise<string> {
	await clearCargoCache();
	const outDir = path.resolve(FIXTURE, `dist-vite-${Date.now()}`);
	const cargo = await importCargo("vite");
	await build({
		root: FIXTURE,
		logLevel: "silent",
		plugins: [cargo(options), wasm()],
		build: {
			outDir,
			emptyOutDir: true,
		},
	});
	return outDir;
}

export async function buildWithRollup(
	options: UnpluginCargoOptions,
): Promise<string> {
	await clearCargoCache();
	const outDir = path.resolve(FIXTURE, `dist-rollup-${Date.now()}`);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("rollup");
	const bundle = await rollup({
		input: path.resolve(FIXTURE, "src/index.js"),
		plugins: [
			// @ts-ignore
			cargo(options),
			rollupWasmBindgen(),
			nodeResolve(),
		],
	});
	await bundle.write({
		format: "es",
		dir: outDir,
	});
	await bundle.close();
	await createHtml(outDir, "./index.js");
	return outDir;
}

export async function buildWithWebpack(
	options: UnpluginCargoOptions,
): Promise<string> {
	await clearCargoCache();
	const outDir = path.resolve(FIXTURE, `dist-webpack-${Date.now()}`);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("webpack");
	await new Promise<void>((resolve, reject) => {
		webpack(
			{
				mode: "production",
				entry: path.resolve(FIXTURE, "src/index.js"),
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
										"webpack-wasm-loader.ts",
									),
								},
							],
						},
					],
				},
				plugins: [
					// @ts-ignore
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

async function clearCargoCache() {
	const cacheDir = path.resolve("node_modules", ".cache", "unplugin-cargo");
	try {
		await fs.rm(cacheDir, { recursive: true });
	} catch {}
}

async function findWasmInCache(name: string): Promise<string | null> {
	const cacheDir = path.resolve("node_modules", ".cache", "unplugin-cargo");
	try {
		const entries = await fs.readdir(cacheDir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const subdirs = await fs.readdir(path.join(cacheDir, entry.name));
			for (const subdir of subdirs) {
				const wasmPath = path.join(cacheDir, entry.name, subdir, name);
				try {
					await fs.access(wasmPath);
					return wasmPath;
				} catch {}
			}
		}
	} catch {}
	return null;
}

export async function buildWithEsbuild(
	options: UnpluginCargoOptions,
): Promise<string> {
	await clearCargoCache();
	const outDir = path.resolve(FIXTURE, `dist-esbuild-${Date.now()}`);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("esbuild");
	await esbuild.build({
		entryPoints: [path.resolve(FIXTURE, "src/index.js")],
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
						const wasmPath = await findWasmInCache(
							path.basename(realPath),
						);
						if (wasmPath) {
							return {
								path: wasmPath,
								namespace: "wasm",
							};
						}
						return null;
					});
					build.onLoad(
						{ filter: /.*/, namespace: "wasm" },
						async (args) => {
							const buffer = await fs.readFile(args.path);
							const module = new WebAssembly.Module(buffer);
							const imports = WebAssembly.Module.imports(module);
							const exports = WebAssembly.Module.exports(module);

							const importMap = new Map<
								string,
								Map<string, string>
							>();
							for (const imp of imports) {
								if (!importMap.has(imp.module)) {
									importMap.set(imp.module, new Map());
								}
								importMap
									.get(imp.module)!
									.set(
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
									.map(
										([name, local]) =>
											`${JSON.stringify(name)}: ${local}`,
									)
									.join(", ");
								importObjLines.push(
									`${JSON.stringify(mod)}: { ${entries} }`,
								);
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
						},
					);
				},
			},
			// @ts-ignore
			cargo(options),
		],
	});
	await createHtml(outDir, "./index.js");
	return outDir;
}

export async function buildWithRspack(
	options: UnpluginCargoOptions,
): Promise<string> {
	await clearCargoCache();
	const outDir = path.resolve(FIXTURE, `dist-rspack-${Date.now()}`);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("rspack");
	await new Promise<void>((resolve, reject) => {
		rspack(
			{
				mode: "production",
				entry: path.resolve(FIXTURE, "src/index.js"),
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
										"webpack-wasm-loader.ts",
									),
								},
							],
						},
					],
				},
				plugins: [
					// @ts-ignore
					cargo(options),
					// @ts-ignore
					new RspackHtmlPlugin({
						template: path.resolve(FIXTURE, "index.html"),
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

export async function buildWithRolldown(
	options: UnpluginCargoOptions,
): Promise<string> {
	await clearCargoCache();
	const outDir = path.resolve(FIXTURE, `dist-rolldown-${Date.now()}`);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("rollup"); // rolldown is rollup-compatible
	const { rolldown } = await import("rolldown");
	const bundle = await rolldown({
		input: path.resolve(FIXTURE, "src/index.js"),
		plugins: [
			// @ts-ignore
			cargo(options),
			// @ts-ignore
			rollupWasmBindgen(),
			nodeResolve(),
		],
	});
	await bundle.write({
		format: "esm",
		dir: outDir,
	});
	await createHtml(outDir, "./index.js");
	return outDir;
}

export async function buildWithFarm(
	options: UnpluginCargoOptions,
): Promise<string> {
	await clearCargoCache();
	const outDir = path.resolve(FIXTURE, `dist-farm-${Date.now()}`);
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("vite"); // Farm is vite-compatible
	const { createCompiler } = await import("@farmfe/core");
	const compiler = await createCompiler({
		compilation: {
			input: {
				index: path.resolve(FIXTURE, "index.html"),
			},
			output: {
				path: outDir,
			},
		},
		plugins: [
			// @ts-ignore
			cargo(options),
			// @ts-ignore
			wasm(),
		],
	});
	await compiler.compile();
	await compiler.writeResourcesToDisk();
	return outDir;
}

export async function buildWithBun(
	options: UnpluginCargoOptions,
): Promise<string> {
	await clearCargoCache();
	const outDir = path.resolve(FIXTURE, `dist-bun-${Date.now()}`);
	await fs.mkdir(outDir, { recursive: true });

	// Serialize options for the Bun subprocess.
	// Functions are converted to strings and revived via eval.
	const serialized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(options)) {
		if (typeof value === "function") {
			serialized[key] = value.toString();
		} else {
			serialized[key] = value;
		}
	}
	const optionsJson = JSON.stringify(serialized);

	const scriptContent = `
import { cargo } from ${JSON.stringify(path.resolve(CARGO, "esbuild.js"))};
import fs from "node:fs/promises";
import path from "node:path";

const options = JSON.parse(${JSON.stringify(optionsJson)});

// Revive any function strings back to real functions
for (const key of Object.keys(options)) {
	const value = options[key];
	if (typeof value === "string" && (value.startsWith("(") || value.startsWith("function"))) {
		try {
			options[key] = eval("(" + value + ")");
		} catch {}
	}
}

function bunWasmPlugin() {
	return {
		name: "wasm-bindgen",
		setup(build) {
			build.onResolve({ filter: /\\.wasm$/ }, async (args) => {
				const realPath = args.path.replace(/^unplugin-cargo:/, "");
				if (path.isAbsolute(realPath)) {
					return { path: realPath, namespace: "wasm" };
				}
				return null;
			});
			build.onLoad({ filter: /.*/, namespace: "wasm" }, async (args) => {
				const buffer = await fs.readFile(args.path);
				const module = new WebAssembly.Module(buffer);
				const imports = WebAssembly.Module.imports(module);
				const exports = WebAssembly.Module.exports(module);

				const importMap = new Map();
				for (const imp of imports) {
					if (!importMap.has(imp.module)) {
						importMap.set(imp.module, new Map());
					}
					importMap.get(imp.module).set(
						imp.name,
						"_" + imp.module.replace(/[^a-zA-Z0-9]/g, "_") + "_" + imp.name
					);
				}

				const importLines = [];
				for (const [mod, names] of importMap) {
					const specifiers = Array.from(names.entries())
						.map(([name, local]) => name + " as " + local)
						.join(", ");
					importLines.push(
						'import { ' + specifiers + ' } from ' + JSON.stringify(mod) + ';'
					);
				}

				const importObjLines = [];
				for (const [mod, names] of importMap) {
					const entries = Array.from(names.entries())
						.map(([name, local]) => JSON.stringify(name) + ": " + local)
						.join(", ");
					importObjLines.push(
						JSON.stringify(mod) + ": { " + entries + " }"
					);
				}

				const exportLines = exports
					.map((exp) => 'export const ' + exp.name + ' = instance.exports.' + exp.name + ';')
					.join("\\n");

				const bytes = Array.from(buffer).join(",");
				const code = [
					...importLines,
					'const module_ = new WebAssembly.Module(new Uint8Array([' + bytes + ']));',
					'const instance = new WebAssembly.Instance(module_, { ' + importObjLines.join(", ") + ' });',
					exportLines,
				].join("\\n");

				return {
					contents: code,
					loader: "js",
					resolveDir: path.dirname(args.path),
				};
			});
		},
	};
}

const result = await Bun.build({
	entrypoints: [${JSON.stringify(path.resolve(FIXTURE, "src/index.js"))}],
	outdir: ${JSON.stringify(outDir)},
	plugins: [cargo(options), bunWasmPlugin()],
});

if (!result.success) {
	console.error(result.logs.map(l => l.message).join("\\n"));
	process.exit(1);
}
`;

	const scriptPath = path.resolve(outDir, "_bun-build.ts");
	await fs.writeFile(scriptPath, scriptContent, "utf8");

	await new Promise<void>((resolve, reject) => {
		execFile("bun", ["run", scriptPath], (err, stdout, stderr) => {
			if (err) {
				return reject(new Error(stderr || stdout || err.message));
			}
			resolve();
		});
	});

	await fs.unlink(scriptPath);
	await createHtml(outDir, "./index.js");
	return outDir;
}
