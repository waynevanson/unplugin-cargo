import { execFileSync } from "node:child_process";
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import pino from "pino";
import type { UnpluginOptions } from "unplugin";
import { cargoBuild } from "./cargo-build";
import { findProjectFilePath } from "./find-project-file-path";
import { findProjectWatchFiles } from "./find-project-watch-files";
import { HashSet } from "./hash-set";
import { findLibraryMetadata, findProjectMetadata } from "./metadata";
import { matchesPattern } from "./pattern";
import { parsePluginOptions, type UnpluginCargoOptions } from "./options";
import { createLibraryDir, isString } from "./utils";

interface LibraryHashable {
	projectFilePath: string;
	libraryFilePath: string;
	cargoBuildTarget: string;
	cargoBuildProfile: string;
	browserless: boolean;
	typescript: boolean;
	features: {
		allFeatures: boolean;
		features?: Array<string>;
		noDefaultFeatures: boolean;
	};
}

export function resolveProduction(options: { production?: boolean }): boolean {
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
			if (path.isAbsolute(source)) {
				return null;
			}

			const hash = libraries.findHashFromValue(
				(library) => library.libraryFilePath === importer,
			);

			if (hash === undefined) {
				return null;
			}

			return path.resolve(createLibraryDir(hash), source);
		},
		watchChange(id, change) {
			log.debug({ id, change }, "watchChange");
		},
		async transform(_code, libraryFilePath) {
			if (path.extname(libraryFilePath) !== ".rs") {
				return null;
			}

			const projectFilePath = findProjectFilePath(libraryFilePath, log);

			if (projectFilePath === undefined) {
				return null;
			}

			const relativeLibraryFilePath = path
				.relative(path.dirname(projectFilePath), libraryFilePath)
				.replace(/\\/g, "/");

			if (!matchesPattern(relativeLibraryFilePath, context.pattern)) {
				return null;
			}

			if (typeof this.addWatchFile === "function") {
				this.addWatchFile(projectFilePath);
			}

			const production = resolveProduction(context);
			const cargoBuildProfile = context.cargoBuildProfile({ production });
			const projectMetadata = findProjectMetadata(projectFilePath, log);

			const libraryMetadata = findLibraryMetadata({
				projectMetadata,
				libraryFilePath,
				projectFilePath,
			});

			const cargoBuildTargetDir = projectMetadata.target_directory;
			const libraryTargetName = libraryMetadata.target.name;

			const cargoProfileDir =
				cargoBuildProfile === "dev" ? "debug" : cargoBuildProfile;

			const libraryBuildDir = path.resolve(
				cargoBuildTargetDir,
				cargoBuildTarget,
				cargoProfileDir,
			);

			cargoBuild({
				log,
				cargoBuildTarget,
				cargoBuildOverrides,
				cargoBuildProfile,
				projectFilePath,
				features: context.features,
			});

			const wasmFilePath: string = path.resolve(
				libraryBuildDir,
				`${libraryTargetName}.wasm`,
			);

			const libraryDepsDir = path.resolve(libraryBuildDir, "deps");

			const projectWatchFiles = await findProjectWatchFiles({
				projectRoot: path.dirname(projectFilePath),
				projectFilePath,
				libraryDepsDir,
				libraryTargetName,
			});

			for (const watchFile of projectWatchFiles) {
				if (typeof this.addWatchFile === "function") {
					this.addWatchFile(watchFile);
				}
			}

			const hash = libraries.add({
				projectFilePath,
				libraryFilePath,
				cargoBuildTarget,
				cargoBuildProfile,
				browserless,
				typescript,
				features: context.features,
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

	let content = await readFile(entrypoint, {
		encoding: "utf8",
	});

	// Rewrite relative imports to absolute imports to avoid resolution issues
	// across different bundlers and virtual module namespaces.
	content = content.replace(
		/((?:import|export)\b[^"']*["'])(\.\/[^"']*)(["'])/g,
		(_match, prefix, relPath, suffix) =>
			`${prefix}${path.resolve(library.wasmBindgenOutDir, relPath).replace(/\\/g, "/")}${suffix}`,
	);

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
		input.browserless ? "--target=bundler" : "--browser",
		input.typescript || `--no-typescript`,
		`--out-dir=${input.wasmBindgenOutDir}`,
		input.wasmFilePath,
	].filter(isString);

	input.log.debug({ args }, "wasm-bindgen");

	execFileSync("wasm-bindgen", args, {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}
