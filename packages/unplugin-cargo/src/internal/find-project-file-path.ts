import fs from "node:fs";
import path from "node:path";
import type pino from "pino";

export function findProjectFilePath(
	id: string,
	log: pino.Logger,
): string | undefined {
	let dir = path.dirname(id);
	const root = path.parse(dir).root;

	while (dir !== root) {
		const candidate = path.join(dir, "Cargo.toml");

		if (fs.existsSync(candidate)) {
			log.debug({ project: candidate }, "cargo-project");
			return candidate;
		}

		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	return undefined;
}
