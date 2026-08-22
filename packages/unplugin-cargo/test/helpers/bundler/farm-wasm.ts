import fs from "node:fs/promises";
import type { Plugin } from "vite";

async function generateWasmGlue(buffer: Buffer): Promise<string> {
	const base64 = buffer.toString("base64");
	const module = await WebAssembly.compile(buffer);
	const imports = WebAssembly.Module.imports(module);
	const exports = WebAssembly.Module.exports(module);

	const importModules = Array.from(new Set(imports.map((i) => i.module)));
	const importStatements = importModules.map(
		(mod, i) => `import * as __wasmImport${i} from ${JSON.stringify(mod)};`,
	);
	const importObjectEntries = importModules.map((mod, i) => {
		const names = imports
			.filter((imp) => imp.module === mod)
			.map(
				(imp) =>
					`${JSON.stringify(imp.name)}: __wasmImport${i}[${JSON.stringify(imp.name)}]`,
			)
			.join(", ");
		return `${JSON.stringify(mod)}: { ${names} }`;
	});

	const exportStatements = exports.map((exp) => {
		const name = exp.name;
		if (name === "default") return "export default __wasmExports.default;";
		return `export const ${name} = __wasmExports[${JSON.stringify(name)}];`;
	});

	return `
const __wasmBase64 = ${JSON.stringify(base64)};
const __wasmBinary = Uint8Array.from(atob(__wasmBase64), (c) => c.charCodeAt(0));
${importStatements.join("\n")}
const __wasmImports = { ${importObjectEntries.join(", ")} };
const __wasmResult = await WebAssembly.instantiate(__wasmBinary, __wasmImports);
const __wasmExports = __wasmResult.instance.exports;
${exportStatements.join("\n")}
export default __wasmExports;
`.trim();
}

export function farmWasmPlugin(): Plugin {
	return {
		name: "farm-wasm",
		enforce: "pre",
		async load(id: string) {
			if (!id.toLowerCase().endsWith(".wasm")) {
				return null;
			}
			const buffer = await fs.readFile(id);
			return {
				code: await generateWasmGlue(buffer),
				map: { mappings: "" },
			};
		},
	};
}
