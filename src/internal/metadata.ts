import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type pino from "pino";
import * as v from "valibot";
import { findOnlyOne } from "./utils";

const execFileAsync = promisify(execFile);

export async function findProjectMetadata(
	projectFilename: string,
	log: pino.Logger,
) {
	const args = [
		"metadata",
		"--no-deps",
		"--format-version=1",
		`--manifest-path=${projectFilename}`,
	];

	log.debug({ args }, "cargo-metadata");

	const { stdout: metacontent } = await execFileAsync("cargo", args, {
		encoding: "utf-8",
	});

	const json = JSON.parse(metacontent.trim());
	log.debug({ json }, "metadata-raw");

	const parsed = v.parse(MetadataSchema, json);
	log.debug({ parsed }, "metadata-parsed");

	return parsed;
}

// todo: use the target found here to verify we have the correct target
export function findLibraryMetadata(options: {
	projectMetadata: v.InferOutput<typeof MetadataSchema>;
	libraryFilePath: string;
	projectFilePath: string;
}) {
	const package_ = findOnlyOne(
		options.projectMetadata.packages,
		(a) => a.manifest_path === options.projectFilePath,
	);

	if (package_ === undefined) {
		throw new Error(
			`Expected exactly 1 package to have the manifest_path of "${options.projectFilePath}"`,
		);
	}

	const target = findOnlyOne(
		package_.targets,
		(target) =>
			target.src_path === options.libraryFilePath &&
			target.crate_types.includes("cdylib"),
	);

	if (target === undefined) {
		throw new Error(
			[
				`Expected exactly 1 target to match the src_path of "${options.libraryFilePath}" and be a "cdylib" target`,
				`Maybe the following is not an entry point "${options.libraryFilePath}"?`,
			].join("\n"),
		);
	}

	return {
		id: package_.id,
		manifestPath: package_.manifest_path,
		name: package_.name,
		target,
	};
}

// There's more data but we're only going to validate what we need
export const MetadataSchema = v.object({
	target_directory: v.string(),
	workspace_root: v.string(),
	packages: v.array(
		v.object({
			name: v.string(),
			id: v.string(),
			manifest_path: v.string(),
			dependencies: v.array(
				v.object({
					name: v.string(),
					source: v.nullable(v.string()),
					req: v.string(),
					kind: v.nullable(v.string()),
				}),
			),
			targets: v.array(
				v.object({
					kind: v.array(v.string()),
					crate_types: v.array(v.string()),
					name: v.string(),
					src_path: v.string(),
				}),
			),
		}),
	),
});
