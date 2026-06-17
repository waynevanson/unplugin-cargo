import { execFileSync } from "node:child_process";
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import picomatch from "picomatch";
import pino from "pino";
import type { UnpluginOptions } from "unplugin";
import { cargoBuild } from "./cargo-build";
import { findLibraryDependencies } from "./find-library-dependencies";
import { findProjectFilePath } from "./find-project-file-path";
import { HashSet } from "./hash-set";
import { findLibraryMetadata, findProjectMetadata } from "./metadata";
import {
	parsePluginOptions,
	type UnpluginCargoOptions,
	type UnpluginCargoOptionsInternal,
} from "./options";
import { createLibraryDir, isString } from "./utils";

interface LibraryHashable {
	projectFilePath: string;
	libraryFilePath: string;
	cargoBuildTarget: string;
	cargoBuildProfile: string;
}

type Pattern =
	| string
	| RegExp
	| Array<string | RegExp>
	| {
			include?: string | RegExp | Array<string | RegExp>;
			exclude?: string | RegExp | Array<string | RegExp>;
	  };

function normalizePatterns(
	patterns: string | RegExp | Array<string | RegExp> | undefined,
): Array<string | RegExp> {
	if (patterns === undefined) return [];
	return Array.isArray(patterns) ? patterns : [patterns];
}

function matchesSinglePattern(id: string, pattern: string | RegExp): boolean {
	if (typeof pattern === "string") {
		return picomatch.isMatch(id, pattern);
	}
	return pattern.test(id);
}

function matchesPattern(id: string, pattern: Pattern): boolean {
	if (typeof pattern === "string" || pattern instanceof RegExp) {
		return matchesSinglePattern(id, pattern);
	}

	if (Array.isArray(pattern)) {
		return pattern.some((p) => matchesSinglePattern(id, p));
	}

	const include = normalizePatterns(pattern.include);
	const exclude = normalizePatterns(pattern.exclude);

	const included =
		include.length === 0 || include.some((p) => matchesSinglePattern(id, p));
	const excluded = exclude.some((p) => matchesSinglePattern(id, p));

	return included && !excluded;
}

function resolveProduction(options: UnpluginCargoOptionsInternal): boolean {
	if (options.production !== undefined) return options.production;
	return process.env.NODE_ENV === "production";
}

export function unpluginFactory(
	pluginOptions_: UnpluginCargoOptions,
): UnpluginOptions {
	const {
		browserless,
		typescript,
		cargoBuildTarget,
		cargoBuildOverrides,
		...context
	} = parsePluginOptions(pluginOptions_);

	const log = pino({ level: context.logLevel });
	const libraries = new HashSet<LibraryHashable>();

	return {
		name: "unplugin-cargo",
		resolveId(source, importer) {
			const hash = libraries.findHashFromValue(
				(library) => library.libraryFilePath === importer,
			);

			if (hash === undefined) {
				return null;
			}

			return path.resolve(createLibraryDir(hash), source);
		},
		watchChange(id, change) {
			// todo: instead of watching just dependencies,
			// we need to watch all files and trigger rebuild when the dependencies change.
			// todo: how to find watch files related to the project like build script .rs?
			// build.rs is technically the src_path
			log.debug({ id, change }, "watchChange");
		},
		async transform(_code, libraryFilePath) {
			if (!matchesPattern(libraryFilePath, context.pattern)) {
				return null;
			}

			const production = resolveProduction(context);
			const cargoBuildProfile = context.cargoBuildProfile({ production });

			const projectFilePath = findProjectFilePath(libraryFilePath, log);
			const projectMetadata = findProjectMetadata(projectFilePath, log);

			const libraryMetadata = findLibraryMetadata({
				projectMetadata,
				libraryFilePath,
				projectFilePath,
			});

			const cargoBuildTargetDir = projectMetadata.target_directory;
			const libraryTargetName = libraryMetadata.target.name;

			const libraryBuildDir = path.resolve(
				cargoBuildTargetDir,
				cargoBuildTarget,
				cargoBuildProfile,
			);

			cargoBuild({
				log,
				cargoBuildTarget,
				cargoBuildOverrides,
				cargoBuildProfile,
				projectFilePath,
			});

			const wasmFilePath: string = path.resolve(
				libraryBuildDir,
				`${libraryTargetName}.wasm`,
			);

			const libraryDepsDir = path.resolve(libraryBuildDir, "deps");

			const libraryFileDependencies = await findLibraryDependencies({
				libraryDepsDir,
				libraryTargetName,
			});

			for (const libraryDependency of libraryFileDependencies) {
				if (typeof this.addWatchFile === "function") {
					this.addWatchFile(libraryDependency);
				}
			}

			const hash = libraries.add({
				projectFilePath,
				libraryFilePath,
				cargoBuildTarget,
				cargoBuildProfile,
			});

			const wasmBindgenOutDir = createLibraryDir(hash);

			buildWasmBindgen({
				browserless,
				log,
				typescript,
				wasmBindgenOutDir,
				wasmFilePath,
			});

			if (typescript) {
				await copyTypescriptDeclaration({
					wasmBindgenOutDir,
					libraryTargetName,
					libraryFilePath,
				});

				if (typeof this.addWatchFile === "function") {
					this.addWatchFile(`${libraryFilePath}.d.ts`);
				}
			}

			const code = await readJavascriptEntryPoint({
				libraryTargetName,
				wasmBindgenOutDir,
			});

			return { code };
		},
	};
}

async function readJavascriptEntryPoint(library: {
	wasmBindgenOutDir: string;
	libraryTargetName: string;
}) {
	const entrypoint = path.resolve(
		library.wasmBindgenOutDir,
		`${library.libraryTargetName}.js`,
	);

	const content = await readFile(entrypoint, {
		encoding: "utf8",
	});

	return content;
}

// todo: add banner to this file so users don't try to use it.
async function copyTypescriptDeclaration(library: {
	wasmBindgenOutDir: string;
	libraryTargetName: string;
	libraryFilePath: string;
}) {
	const source = path.join(
		library.wasmBindgenOutDir,
		`${library.libraryTargetName}.d.ts`,
	);

	const target = `${library.libraryFilePath}.d.ts`;
	await copyFile(source, target);
}

// create `.js` from `.wasm`
//
// `.js` and `.wasm` files are created in outDir,
// and added to dependency graph from imports in the `.js` entrypoint.
export function buildWasmBindgen(input: {
	typescript: boolean;
	browserless: boolean;
	wasmBindgenOutDir: string;
	wasmFilePath: string;
	log: pino.Logger;
}) {
	const args = [
		"--target=bundler",
		input.typescript || `--no-typescript`,
		input.browserless || `--browser`,
		`--out-dir=${input.wasmBindgenOutDir}`,
		input.wasmFilePath,
	].filter(isString);

	input.log.debug({ args }, "wasm-bindgen");

	execFileSync("wasm-bindgen", args);
}
