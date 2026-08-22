import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { UnpluginCargoOptions } from "../../../src/index";
import { createHtml } from "../create-html";
import { getFixture } from "../fixture";

const CARGO = path.resolve(import.meta.dirname, "../../../src");
const BUN_BUILD_SCRIPT = path.resolve(
	import.meta.dirname,
	"../../../fixtures/bun-build.ts",
);

export async function buildWithBun(
	options: UnpluginCargoOptions,
	fixture?: string,
): Promise<string> {
	const fixtureRoot = fixture ?? (await getFixture(options));
	const outDir = path.resolve(fixtureRoot, "dists", `dist-bun-${Date.now()}`);
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

	const scriptPath = path.resolve(outDir, "_bun-build.ts");
	await fs.copyFile(BUN_BUILD_SCRIPT, scriptPath);

	await new Promise<void>((resolve, reject) => {
		execFile(
			"bun",
			["run", scriptPath],
			{
				env: {
					...process.env,
					CARGO_ESBUILD_PATH: path.resolve(CARGO, "esbuild.ts"),
					OPTIONS_JSON: JSON.stringify(serialized),
					ENTRYPOINT: path.resolve(fixtureRoot, "src/index.js"),
					OUTDIR: outDir,
				},
			},
			(err, stdout, stderr) => {
				if (err) {
					return reject(new Error(stderr || stdout || err.message));
				}
				resolve();
			},
		);
	});

	await fs.unlink(scriptPath);
	await createHtml(outDir, "./index.js");
	return outDir;
}
