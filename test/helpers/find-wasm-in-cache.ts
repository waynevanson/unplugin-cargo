import fs from "node:fs/promises";
import path from "node:path";

export async function findWasmInCache(name: string): Promise<string | null> {
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
