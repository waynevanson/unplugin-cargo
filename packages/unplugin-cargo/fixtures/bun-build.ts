import fs from "node:fs/promises";
import path from "node:path";

const cargoPath = process.env.CARGO_ESBUILD_PATH;
const optionsJson = process.env.OPTIONS_JSON;
const entrypoint = process.env.ENTRYPOINT;
const outdir = process.env.OUTDIR;

if (!cargoPath || !optionsJson || !entrypoint || !outdir) {
	throw new Error("Missing required environment variables");
}

const { cargo } = await import(cargoPath);

const options = JSON.parse(optionsJson);

// Revive any function strings back to real functions
for (const key of Object.keys(options)) {
	const value = options[key];
	if (
		typeof value === "string" &&
		(value.startsWith("(") || value.startsWith("function"))
	) {
		try {
			options[key] = eval("(" + value + ")");
		} catch {}
	}
}

function bunWasmPlugin() {
	return {
		name: "wasm-bindgen",
		setup(build) {
			build.onResolve({ filter: /\.wasm$/ }, async (args) => {
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
					importMap
						.get(imp.module)
						.set(
							imp.name,
							"_" + imp.module.replace(/[^a-zA-Z0-9]/g, "_") + "_" + imp.name,
						);
				}

				const importLines = [];
				for (const [mod, names] of importMap) {
					const specifiers = Array.from(names.entries())
						.map(([name, local]) => name + " as " + local)
						.join(", ");
					importLines.push(
						"import { " + specifiers + " } from " + JSON.stringify(mod) + ";",
					);
				}

				const importObjLines = [];
				for (const [mod, names] of importMap) {
					const entries = Array.from(names.entries())
						.map(([name, local]) => JSON.stringify(name) + ": " + local)
						.join(", ");
					importObjLines.push(JSON.stringify(mod) + ": { " + entries + " }");
				}

				const exportLines = exports
					.map(
						(exp) =>
							"export const " +
							exp.name +
							" = instance.exports." +
							exp.name +
							";",
					)
					.join("\n");

				const bytes = Array.from(buffer).join(",");
				const code = [
					...importLines,
					"const module_ = new WebAssembly.Module(new Uint8Array([" +
						bytes +
						"]));",
					"const instance = new WebAssembly.Instance(module_, { " +
						importObjLines.join(", ") +
						" });",
					exportLines,
				].join("\n");

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
	entrypoints: [entrypoint],
	outdir,
	plugins: [cargo(options), bunWasmPlugin()],
});

if (!result.success) {
	console.error(result.logs.map((l) => l.message).join("\n"));
	process.exit(1);
}
