import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { UnpluginCargoOptions } from "../../../dist/index";
import { createHtml } from "../create-html";
import { getFixture } from "../fixture";

const CARGO = path.resolve(import.meta.dirname, "../../../dist");

export async function buildWithBun(
	options: UnpluginCargoOptions,
): Promise<string> {
	const fixture = await getFixture(options);
	const outDir = path.resolve(fixture, "dists", `dist-bun-${Date.now()}`);
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
	entrypoints: [${JSON.stringify(path.resolve(fixture, "src/index.js"))}],
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
