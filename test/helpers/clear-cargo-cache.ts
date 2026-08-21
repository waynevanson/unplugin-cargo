import fs from "node:fs/promises";
import path from "node:path";

export async function clearCargoCache() {
	const cacheDir = path.resolve("node_modules", ".cache", "unplugin-cargo");
	try {
		await fs.rm(cacheDir, { recursive: true });
	} catch {}
}
