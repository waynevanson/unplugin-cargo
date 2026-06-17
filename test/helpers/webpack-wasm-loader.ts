import { readFile } from "node:fs/promises";
import path from "node:path";

export default async function wasmLoader(this: any, source: Buffer) {
	const callback = this.async();
	const wasmPath = this.resourcePath;
	const depsDir = path.dirname(wasmPath);

	try {
		const buffer = await readFile(wasmPath);
		const module = new WebAssembly.Module(buffer);
		const imports = WebAssembly.Module.imports(module);
		const exports = WebAssembly.Module.exports(module);

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

		callback(null, code);
	} catch (err) {
		callback(err);
	}
}
