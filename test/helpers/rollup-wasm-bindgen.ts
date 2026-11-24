import fs from "node:fs/promises";
import path from "node:path";

// Custom Rollup plugin that synchronously instantiates wasm modules
// for wasm-bindgen's --target=bundler output.
export function rollupWasmBindgen() {
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
					.get(imp.module)
					?.set(
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
				importObjLines.push(`${JSON.stringify(mod)}: { ${entries} }`);
			}

			// Build exports
			const exportLines = exports
				.map(
					(exp) => `export const ${exp.name} = instance.exports.${exp.name};`,
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
