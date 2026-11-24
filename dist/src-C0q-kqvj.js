import { createUnplugin } from "unplugin";
import { execFile } from "node:child_process";
import { access, copyFile, readFile, readdir, stat } from "node:fs/promises";
import path$1, * as path from "node:path";
import { promisify } from "node:util";
import pino from "pino";
import fs from "node:fs";
import { hasher } from "node-object-hash";
import * as v from "valibot";
import picomatch from "picomatch";
// src/internal/utils.ts
function isString(value) {
	return typeof value === "string";
}
function findOnlyOne(array, predicate) {
	let found;
	for (const item of array) {
		if (!predicate(item)) continue;
		if (found !== void 0) break;
		found = item;
	}
	return found;
}
const CACHE_DIR = "node_modules/.cache/unplugin-cargo";
function createLibraryDir(hash) {
	if (hash.length <= 2) throw Error(`Expected hash to be a string greater than two but received "${hash}"`);
	return path.resolve(CACHE_DIR, hash.slice(0, 2), hash.slice(2));
}
// src/internal/cargo-build.ts
const execFileAsync$2 = promisify(execFile);
async function cargoBuild(context) {
	let args = [
		"build",
		"--lib",
		`--target=${context.cargoBuildTarget}`,
		"--message-format=json",
		`--manifest-path=${context.projectFilePath}`,
		"--quiet",
		`--profile=${context.cargoBuildProfile}`
	].filter(isString);
	if (context.features.allFeatures) args.push("--all-features");
	else {
		if (context.features.noDefaultFeatures) args.push("--no-default-features");
		if (context.features.features && context.features.features.length > 0) args.push("--features", context.features.features.join(","));
	}
	context.log.debug({ args }, "cargo-build:raw-args");
	if (context.cargoBuildOverrides) {
		args = context.cargoBuildOverrides(args);
		context.log.debug({ args }, "cargo-build:overridden-args");
	} else context.log.debug("cargo-build:no-overriden-args");
	await execFileAsync$2("cargo", args, { encoding: "utf-8" });
}
// src/internal/find-project-file-path.ts
function findProjectFilePath(id, log) {
	let dir = path$1.dirname(id);
	const root = path$1.parse(dir).root;
	while (dir !== root) {
		const candidate = path$1.join(dir, "Cargo.toml");
		if (fs.existsSync(candidate)) {
			log.debug({ project: candidate }, "cargo-project");
			return candidate;
		}
		const parent = path$1.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
}
// src/internal/find-library-dependencies.ts
async function findLibraryDependencies(options) {
	const libraryDepsFilePath = await findFirstExisting([path$1.resolve(options.libraryDepsDir, `${options.libraryTargetName}.d`), path$1.resolve(options.libraryBuildDir, `${options.libraryTargetName}.d`)]);
	const graph = createGraphFromDependencies(await readFile(libraryDepsFilePath, { encoding: "utf8" }), options.workspaceRoot);
	const neighboursEntry = [path$1.resolve(options.libraryDepsDir, `${options.libraryTargetName}.wasm`), path$1.resolve(options.libraryBuildDir, `${options.libraryTargetName}.wasm`)].find((candidate) => graph.has(candidate));
	if (neighboursEntry === void 0) throw new Error(`Expect the wasm output to exist in the dependency graph`);
	return findAllDescendants(neighboursEntry, graph);
}
async function findFirstExisting(candidates) {
	for (const candidate of candidates) try {
		await access(candidate);
		return candidate;
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	throw new Error(`Expected one of the following files to exist: ${candidates.join(", ")}`);
}
function splitTargets(targets) {
	return targets.split(/(?<!\\)\s+/).map((target) => target.replace(/\\ /g, " "));
}
function createGraphFromDependencies(contents, baseDir) {
	return new Map(contents.split("\n").filter(Boolean).map((line) => {
		const separator = line.indexOf(": ");
		if (separator === -1) return null;
		const source = line.slice(0, separator);
		const targets = line.slice(separator + 2);
		return [path$1.resolve(baseDir, source), new Set(splitTargets(targets).map((target) => path$1.resolve(baseDir, target)))];
	}).filter((entry) => entry !== null));
}
function findAllDescendants(start, graph) {
	const collecteds = /* @__PURE__ */ new Set();
	const initials = graph.get(start);
	if (initials === void 0) throw new Error(`Expect the start value to exist in the dependency graph`);
	const queue = Array.from(initials);
	while (queue.length > 0) {
		const source = queue.shift();
		if (source === void 0 || collecteds.has(source)) continue;
		collecteds.add(source);
		const targets = graph.get(source) ?? /* @__PURE__ */ new Set();
		for (const target of targets) if (!collecteds.has(target)) queue.push(target);
	}
	return collecteds;
}
// src/internal/find-project-watch-files.ts
async function findProjectWatchFiles(options) {
	const watched = /* @__PURE__ */ new Set();
	watched.add(options.projectFilePath);
	const lockFile = path$1.resolve(options.workspaceRoot, "Cargo.lock");
	if (await fileExists(lockFile)) watched.add(lockFile);
	const buildRs = path$1.resolve(options.projectRoot, "build.rs");
	if (await fileExists(buildRs)) watched.add(buildRs);
	for await (const file of findRustSourceFiles(options.projectRoot)) watched.add(file);
	const libraryDeps = await findLibraryDependencies({
		workspaceRoot: options.workspaceRoot,
		libraryBuildDir: options.libraryBuildDir,
		libraryDepsDir: options.libraryDepsDir,
		libraryTargetName: options.libraryTargetName
	});
	for (const dep of libraryDeps) if (await fileExists(dep)) watched.add(dep);
	return watched;
}
async function fileExists(filePath) {
	try {
		return (await stat(filePath)).isFile();
	} catch {
		return false;
	}
}
async function* findRustSourceFiles(root) {
	const entries = await readdir(root, { withFileTypes: true });
	for (const entry of entries) {
		const entryPath = path$1.resolve(root, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "target") continue;
			yield* findRustSourceFiles(entryPath);
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".rs")) yield entryPath;
	}
}
// src/internal/hash-set.ts
var HashSet = class {
	#hasher;
	#map;
	constructor(values, hasherOptions) {
		this.#hasher = hasher(hasherOptions);
		const entries = Array.from(values ?? [], (value) => [this.#hasher.hash(value), value]);
		this.#map = new Map(entries);
	}
	hash(value) {
		return this.#hasher.hash(value);
	}
	findHashFromValue(predicate) {
		for (const [hash, value] of this.#map.entries()) if (predicate(value)) return hash;
	}
	has(value) {
		return this.#map.has(this.hash(value));
	}
	add(value) {
		const hash = this.hash(value);
		this.#map.set(hash, value);
		return hash;
	}
	delete(value) {
		const hash = this.hash(value);
		return this.#map.delete(hash);
	}
	values() {
		return this.#map.values();
	}
	entries() {
		return this.#map.entries();
	}
	hashes() {
		return this.#map.keys();
	}
	[Symbol.iterator]() {
		return this.values();
	}
};
// src/internal/metadata.ts
const execFileAsync$1 = promisify(execFile);
async function findProjectMetadata(projectFilename, log) {
	const args = [
		"metadata",
		"--no-deps",
		"--format-version=1",
		`--manifest-path=${projectFilename}`
	];
	log.debug({ args }, "cargo-metadata");
	const { stdout: metacontent } = await execFileAsync$1("cargo", args, { encoding: "utf-8" });
	const json = JSON.parse(metacontent.trim());
	log.debug({ json }, "metadata-raw");
	const parsed = v.parse(MetadataSchema, json);
	log.debug({ parsed }, "metadata-parsed");
	return parsed;
}
function findLibraryMetadata(options) {
	const package_ = findOnlyOne(options.projectMetadata.packages, (a) => a.manifest_path === options.projectFilePath);
	if (package_ === void 0) throw new Error(`Expected exactly 1 package to have the manifest_path of "${options.projectFilePath}"`);
	const target = findOnlyOne(package_.targets, (target) => target.src_path === options.libraryFilePath && target.crate_types.includes("cdylib"));
	if (target === void 0) throw new Error([`Expected exactly 1 target to match the src_path of "${options.libraryFilePath}" and be a "cdylib" target`, `Maybe the following is not an entry point "${options.libraryFilePath}"?`].join("\n"));
	return {
		id: package_.id,
		manifestPath: package_.manifest_path,
		name: package_.name,
		target
	};
}
const MetadataSchema = v.object({
	target_directory: v.string(),
	workspace_root: v.string(),
	packages: v.array(v.object({
		name: v.string(),
		id: v.string(),
		manifest_path: v.string(),
		dependencies: v.array(v.object({
			name: v.string(),
			source: v.nullable(v.string()),
			req: v.string(),
			kind: v.nullable(v.string())
		})),
		targets: v.array(v.object({
			kind: v.array(v.string()),
			crate_types: v.array(v.string()),
			name: v.string(),
			src_path: v.string()
		}))
	}))
});
// src/internal/options.ts
const logLevel = v.picklist([
	"silent",
	"fatal",
	"error",
	"warn",
	"info",
	"debug",
	"trace"
]);
const enable = v.optional(v.boolean(), false);
const PatternSchema = v.union([v.string(), v.instance(RegExp)]);
const MaybeArraySchema = (schema) => v.union([schema, v.array(schema)]);
const PatternFilterSchema = v.union([MaybeArraySchema(PatternSchema), v.object({
	include: v.optional(MaybeArraySchema(PatternSchema)),
	exclude: v.optional(MaybeArraySchema(PatternSchema))
})]);
const CargoBuildOverridesSchema = v.optional(v.pipe(v.function(), v.args(v.strictTuple([v.array(v.string())])), v.returns(v.array(v.string()))));
const CargoBuildProfileFn = v.pipe(v.function(), v.args(v.strictTuple([v.object({ production: v.boolean() })])), v.returns(v.string()));
const CargoBuildProfile = v.optional(v.pipe(v.union([v.pipe(v.string(), v.transform((profile) => (_) => profile)), CargoBuildProfileFn])), () => (args_0) => args_0.production ? "release" : "dev");
const BaseFieldsSchema = v.object({
	pattern: PatternFilterSchema,
	production: v.optional(v.boolean()),
	logLevel: v.optional(logLevel, "silent"),
	noTypescript: enable,
	browserOnly: enable,
	cargoBuildOverrides: CargoBuildOverridesSchema,
	cargoBuildProfile: CargoBuildProfile,
	cargoBuildTarget: v.optional(v.string(), "wasm32-unknown-unknown")
});
const UnpluginCargoOptionsSchema = v.pipe(v.union([v.object({
	...BaseFieldsSchema.entries,
	allFeatures: v.literal(true)
}), v.object({
	...BaseFieldsSchema.entries,
	features: v.optional(v.array(v.string())),
	noDefaultFeatures: enable
})]), v.transform((options) => ({
	production: options.production,
	typescript: !options.noTypescript,
	browserless: !options.browserOnly,
	pattern: options.pattern,
	cargoBuildOverrides: options.cargoBuildOverrides,
	logLevel: options.logLevel,
	cargoBuildProfile: options.cargoBuildProfile,
	cargoBuildTarget: options.cargoBuildTarget,
	features: "allFeatures" in options ? {
		allFeatures: true,
		features: void 0,
		noDefaultFeatures: false
	} : {
		allFeatures: false,
		features: options.features,
		noDefaultFeatures: options.noDefaultFeatures
	}
})));
const parsePluginOptions = (input) => v.parse(UnpluginCargoOptionsSchema, input);
// src/internal/pattern.ts
function normalizePatterns(patterns) {
	if (patterns === void 0) return [];
	return Array.isArray(patterns) ? patterns : [patterns];
}
function matchesSinglePattern(id, pattern) {
	if (typeof pattern === "string") return picomatch.isMatch(id, pattern, { dot: true });
	return pattern.test(id);
}
function matchesPattern(id, pattern) {
	if (typeof pattern === "string" || pattern instanceof RegExp) return matchesSinglePattern(id, pattern);
	if (Array.isArray(pattern)) return pattern.some((p) => matchesSinglePattern(id, p));
	const include = normalizePatterns(pattern.include);
	const exclude = normalizePatterns(pattern.exclude);
	const included = include.length === 0 || include.some((p) => matchesSinglePattern(id, p));
	const excluded = exclude.some((p) => matchesSinglePattern(id, p));
	return included && !excluded;
}
// src/internal/core.ts
const execFileAsync = promisify(execFile);
function resolveProduction(options) {
	if (options.production !== void 0) return options.production;
	return process.env.NODE_ENV === "production";
}
function unpluginFactory(pluginOptions_) {
	const { browserless, typescript, cargoBuildTarget, cargoBuildOverrides, ...context } = parsePluginOptions(pluginOptions_);
	const log = pino({ level: context.logLevel });
	const libraries = new HashSet();
	return {
		name: "unplugin-cargo",
		resolveId(source, importer) {
			if (path$1.isAbsolute(source)) return null;
			const hash = libraries.findHashFromValue((library) => library.libraryFilePath === importer);
			if (hash === void 0) return null;
			return path$1.resolve(createLibraryDir(hash), source);
		},
		watchChange(id, change) {
			log.debug({
				id,
				change
			}, "watchChange");
		},
		async transform(_code, libraryFilePath) {
			if (path$1.extname(libraryFilePath) !== ".rs") return null;
			const projectFilePath = findProjectFilePath(libraryFilePath, log);
			if (projectFilePath === void 0) return null;
			if (!matchesPattern(path$1.relative(path$1.dirname(projectFilePath), libraryFilePath).replace(/\\/g, "/"), context.pattern)) return null;
			if (typeof this.addWatchFile === "function") this.addWatchFile(projectFilePath);
			const production = resolveProduction(context);
			const cargoBuildProfile = context.cargoBuildProfile({ production });
			const projectMetadata = await findProjectMetadata(projectFilePath, log);
			const libraryMetadata = findLibraryMetadata({
				projectMetadata,
				libraryFilePath,
				projectFilePath
			});
			const cargoBuildTargetDir = projectMetadata.target_directory;
			const libraryTargetName = libraryMetadata.target.name;
			const cargoProfileDir = cargoBuildProfile === "dev" ? "debug" : cargoBuildProfile;
			const libraryBuildDir = path$1.resolve(cargoBuildTargetDir, cargoBuildTarget, cargoProfileDir);
			await cargoBuild({
				log,
				cargoBuildTarget,
				cargoBuildOverrides,
				cargoBuildProfile,
				projectFilePath,
				features: context.features
			});
			const wasmFilePath = path$1.resolve(libraryBuildDir, `${libraryTargetName}.wasm`);
			const libraryDepsDir = path$1.resolve(libraryBuildDir, "deps");
			const projectWatchFiles = await findProjectWatchFiles({
				projectRoot: path$1.dirname(projectFilePath),
				workspaceRoot: projectMetadata.workspace_root,
				projectFilePath,
				libraryBuildDir,
				libraryDepsDir,
				libraryTargetName
			});
			for (const watchFile of projectWatchFiles) if (typeof this.addWatchFile === "function") this.addWatchFile(watchFile);
			const wasmBindgenOutDir = createLibraryDir(libraries.add({
				projectFilePath,
				libraryFilePath,
				cargoBuildTarget,
				cargoBuildProfile,
				browserless,
				typescript,
				features: context.features
			}));
			await buildWasmBindgen({
				browserless,
				log,
				typescript,
				wasmBindgenOutDir,
				wasmFilePath
			});
			if (typescript) {
				await copyTypescriptDeclaration({
					wasmBindgenOutDir,
					libraryTargetName,
					libraryFilePath
				});
				if (typeof this.addWatchFile === "function") this.addWatchFile(`${libraryFilePath}.d.ts`);
			}
			return { code: await readJavascriptEntryPoint({
				libraryTargetName,
				wasmBindgenOutDir
			}) };
		}
	};
}
async function readJavascriptEntryPoint(library) {
	const entrypoint = path$1.resolve(library.wasmBindgenOutDir, `${library.libraryTargetName}.js`);
	let content = await readFile(entrypoint, { encoding: "utf8" });
	content = content.replace(/((?:import|export)\b[^"']*["'])(\.\/[^"']*)(["'])/g, (_match, prefix, relPath, suffix) => `${prefix}${path$1.resolve(library.wasmBindgenOutDir, relPath).replace(/\\/g, "/")}${suffix}`);
	return content;
}
async function copyTypescriptDeclaration(library) {
	const source = path$1.join(library.wasmBindgenOutDir, `${library.libraryTargetName}.d.ts`);
	const target = `${library.libraryFilePath}.d.ts`;
	await copyFile(source, target);
}
async function buildWasmBindgen(input) {
	const args = [
		input.browserless ? "--target=bundler" : "--browser",
		input.typescript || `--no-typescript`,
		`--out-dir=${input.wasmBindgenOutDir}`,
		input.wasmFilePath
	].filter(isString);
	input.log.debug({ args }, "wasm-bindgen");
	await execFileAsync("wasm-bindgen", args, { encoding: "utf-8" });
}
// src/index.ts
const cargo = createUnplugin(unpluginFactory);
export { cargo as t };

//# sourceMappingURL=src-C0q-kqvj.js.map