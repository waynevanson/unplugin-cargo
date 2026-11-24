import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type pino from "pino";
import type { CargoBuildOverrides } from "./options";
import { isString } from "./utils";

const execFileAsync = promisify(execFile);

export async function cargoBuild(context: {
	cargoBuildOverrides: CargoBuildOverrides;
	projectFilePath: string;
	log: pino.Logger;
	cargoBuildTarget: string;
	cargoBuildProfile: string;
	features: {
		allFeatures: boolean;
		features?: Array<string>;
		noDefaultFeatures: boolean;
	};
}) {
	// create `.wasm` from `.rs`
	let args = [
		"build",
		"--lib",
		`--target=${context.cargoBuildTarget}`,
		"--message-format=json",
		`--manifest-path=${context.projectFilePath}`,
		"--quiet",
		`--profile=${context.cargoBuildProfile}`,
	].filter(isString);

	if (context.features.allFeatures) {
		args.push("--all-features");
	} else {
		if (context.features.noDefaultFeatures) {
			args.push("--no-default-features");
		}
		if (context.features.features && context.features.features.length > 0) {
			args.push("--features", context.features.features.join(","));
		}
	}

	context.log.debug({ args }, "cargo-build:raw-args");

	if (context.cargoBuildOverrides) {
		args = context.cargoBuildOverrides(args);
		context.log.debug({ args }, "cargo-build:overridden-args");
	} else {
		context.log.debug("cargo-build:no-overriden-args");
	}

	await execFileAsync("cargo", args, {
		encoding: "utf-8",
	});
}
