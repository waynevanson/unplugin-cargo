// src/index.ts
import { createUnplugin } from "unplugin";

// src/internal/core.ts
import { execFile as execFile3 } from "child_process";
import { copyFile, readFile as readFile2 } from "fs/promises";
import { promisify as promisify3 } from "util";
import path5 from "path";
import pino from "pino";

// src/internal/cargo-build.ts
import { execFile } from "child_process";
import { promisify } from "util";

// src/internal/utils.ts
import * as path from "path";
function isString(value) {
  return typeof value === "string";
}
function findOnlyOne(array3, predicate) {
  let found;
  for (const item of array3) {
    if (!predicate(item)) {
      continue;
    }
    if (found !== void 0) {
      break;
    }
    found = item;
  }
  return found;
}
var CACHE_DIR = "node_modules/.cache/unplugin-cargo";
function createLibraryDir(hash) {
  if (hash.length <= 2) {
    throw Error(
      `Expected hash to be a string greater than two but received "${hash}"`
    );
  }
  return path.resolve(CACHE_DIR, hash.slice(0, 2), hash.slice(2));
}

// src/internal/cargo-build.ts
var execFileAsync = promisify(execFile);
async function cargoBuild(context) {
  let args2 = [
    "build",
    "--lib",
    `--target=${context.cargoBuildTarget}`,
    "--message-format=json",
    `--manifest-path=${context.projectFilePath}`,
    "--quiet",
    `--profile=${context.cargoBuildProfile}`
  ].filter(isString);
  if (context.features.allFeatures) {
    args2.push("--all-features");
  } else {
    if (context.features.noDefaultFeatures) {
      args2.push("--no-default-features");
    }
    if (context.features.features && context.features.features.length > 0) {
      args2.push("--features", context.features.features.join(","));
    }
  }
  context.log.debug({ args: args2 }, "cargo-build:raw-args");
  if (context.cargoBuildOverrides) {
    args2 = context.cargoBuildOverrides(args2);
    context.log.debug({ args: args2 }, "cargo-build:overridden-args");
  } else {
    context.log.debug("cargo-build:no-overriden-args");
  }
  await execFileAsync("cargo", args2, {
    encoding: "utf-8"
  });
}

// src/internal/find-project-file-path.ts
import fs from "fs";
import path2 from "path";
function findProjectFilePath(id, log) {
  let dir = path2.dirname(id);
  const root = path2.parse(dir).root;
  while (dir !== root) {
    const candidate = path2.join(dir, "Cargo.toml");
    if (fs.existsSync(candidate)) {
      log.debug({ project: candidate }, "cargo-project");
      return candidate;
    }
    const parent = path2.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return void 0;
}

// src/internal/find-project-watch-files.ts
import { readdir, stat } from "fs/promises";
import path4 from "path";

// src/internal/find-library-dependencies.ts
import { readFile } from "fs/promises";
import path3 from "path";
async function findLibraryDependencies(options) {
  const libraryDepsFilePath = path3.resolve(
    options.libraryDepsDir,
    `${options.libraryTargetName}.d`
  );
  const dependencies = await readFile(libraryDepsFilePath, {
    encoding: "utf8"
  });
  const graph = createGraphFromDependencies(
    dependencies,
    options.workspaceRoot
  );
  const neighboursEntry = path3.resolve(
    options.libraryDepsDir,
    `${options.libraryTargetName}.wasm`
  );
  const neighbours = findAllDescendants(neighboursEntry, graph);
  return neighbours;
}
function splitTargets(targets) {
  return targets.split(/(?<!\\)\s+/).map((target) => target.replace(/\\ /g, " "));
}
function createGraphFromDependencies(contents, baseDir) {
  return new Map(
    contents.split("\n").filter(Boolean).map((line) => {
      const separator = line.indexOf(": ");
      if (separator === -1) {
        return null;
      }
      const source = line.slice(0, separator);
      const targets = line.slice(separator + 2);
      return [
        path3.resolve(baseDir, source),
        new Set(
          splitTargets(targets).map(
            (target) => path3.resolve(baseDir, target)
          )
        )
      ];
    }).filter((entry) => entry !== null)
  );
}
function findAllDescendants(start, graph) {
  const collecteds = /* @__PURE__ */ new Set();
  const initials = graph.get(start);
  if (initials === void 0) {
    throw new Error(`Expect the start value to exist in the dependency graph`);
  }
  const queue = Array.from(initials);
  while (queue.length > 0) {
    const source = queue.shift();
    if (source === void 0 || collecteds.has(source)) {
      continue;
    }
    collecteds.add(source);
    const targets = graph.get(source) ?? /* @__PURE__ */ new Set();
    for (const target of targets) {
      if (!collecteds.has(target)) {
        queue.push(target);
      }
    }
  }
  return collecteds;
}

// src/internal/find-project-watch-files.ts
async function findProjectWatchFiles(options) {
  const watched = /* @__PURE__ */ new Set();
  watched.add(options.projectFilePath);
  const lockFile = path4.resolve(options.workspaceRoot, "Cargo.lock");
  if (await fileExists(lockFile)) {
    watched.add(lockFile);
  }
  const buildRs = path4.resolve(options.projectRoot, "build.rs");
  if (await fileExists(buildRs)) {
    watched.add(buildRs);
  }
  for await (const file of findRustSourceFiles(options.projectRoot)) {
    watched.add(file);
  }
  const libraryDeps = await findLibraryDependencies({
    workspaceRoot: options.workspaceRoot,
    libraryDepsDir: options.libraryDepsDir,
    libraryTargetName: options.libraryTargetName
  });
  for (const dep of libraryDeps) {
    if (await fileExists(dep)) {
      watched.add(dep);
    }
  }
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
    const entryPath = path4.resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "target") continue;
      yield* findRustSourceFiles(entryPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".rs")) {
      yield entryPath;
    }
  }
}

// src/internal/hash-set.ts
import { hasher } from "node-object-hash";
var HashSet = class {
  #hasher;
  #map;
  constructor(values, hasherOptions) {
    this.#hasher = hasher(hasherOptions);
    const entries = Array.from(
      values ?? [],
      (value) => [this.#hasher.hash(value), value]
    );
    this.#map = new Map(entries);
  }
  hash(value) {
    return this.#hasher.hash(value);
  }
  findHashFromValue(predicate) {
    for (const [hash, value] of this.#map.entries()) {
      if (predicate(value)) {
        return hash;
      }
    }
    return void 0;
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
import { execFile as execFile2 } from "child_process";
import { promisify as promisify2 } from "util";
import * as v from "valibot";
var execFileAsync2 = promisify2(execFile2);
async function findProjectMetadata(projectFilename, log) {
  const args2 = [
    "metadata",
    "--no-deps",
    "--format-version=1",
    `--manifest-path=${projectFilename}`
  ];
  log.debug({ args: args2 }, "cargo-metadata");
  const { stdout: metacontent } = await execFileAsync2("cargo", args2, {
    encoding: "utf-8"
  });
  const json = JSON.parse(metacontent.trim());
  log.debug({ json }, "metadata-raw");
  const parsed = v.parse(MetadataSchema, json);
  log.debug({ parsed }, "metadata-parsed");
  return parsed;
}
function findLibraryMetadata(options) {
  const package_ = findOnlyOne(
    options.projectMetadata.packages,
    (a) => a.manifest_path === options.projectFilePath
  );
  if (package_ === void 0) {
    throw new Error(
      `Expected exactly 1 package to have the manifest_path of "${options.projectFilePath}"`
    );
  }
  const target = findOnlyOne(
    package_.targets,
    (target2) => target2.src_path === options.libraryFilePath && target2.crate_types.includes("cdylib")
  );
  if (target === void 0) {
    throw new Error(
      [
        `Expected exactly 1 target to match the src_path of "${options.libraryFilePath}" and be a "cdylib" target`,
        `Maybe the following is not an entry point "${options.libraryFilePath}"?`
      ].join("\n")
    );
  }
  return {
    id: package_.id,
    manifestPath: package_.manifest_path,
    name: package_.name,
    target
  };
}
var MetadataSchema = v.object({
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
          kind: v.nullable(v.string())
        })
      ),
      targets: v.array(
        v.object({
          kind: v.array(v.string()),
          crate_types: v.array(v.string()),
          name: v.string(),
          src_path: v.string()
        })
      )
    })
  )
});

// src/internal/pattern.ts
import picomatch from "picomatch";
function normalizePatterns(patterns) {
  if (patterns === void 0) return [];
  return Array.isArray(patterns) ? patterns : [patterns];
}
function matchesSinglePattern(id, pattern) {
  if (typeof pattern === "string") {
    return picomatch.isMatch(id, pattern, { dot: true });
  }
  return pattern.test(id);
}
function matchesPattern(id, pattern) {
  if (typeof pattern === "string" || pattern instanceof RegExp) {
    return matchesSinglePattern(id, pattern);
  }
  if (Array.isArray(pattern)) {
    return pattern.some((p) => matchesSinglePattern(id, p));
  }
  const include = normalizePatterns(pattern.include);
  const exclude = normalizePatterns(pattern.exclude);
  const included = include.length === 0 || include.some((p) => matchesSinglePattern(id, p));
  const excluded = exclude.some((p) => matchesSinglePattern(id, p));
  return included && !excluded;
}

// src/internal/options.ts
import * as v2 from "valibot";
var logLevel = v2.picklist([
  "silent",
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace"
]);
var enable = v2.optional(v2.boolean(), false);
var PatternSchema = v2.union([v2.string(), v2.instance(RegExp)]);
var MaybeArraySchema = (schema) => v2.union([schema, v2.array(schema)]);
var PatternFilterSchema = v2.union([
  MaybeArraySchema(PatternSchema),
  v2.object({
    include: v2.optional(MaybeArraySchema(PatternSchema)),
    exclude: v2.optional(MaybeArraySchema(PatternSchema))
  })
]);
var CargoBuildOverridesSchema = v2.optional(
  v2.pipe(
    v2.function(),
    v2.args(v2.strictTuple([v2.array(v2.string())])),
    v2.returns(v2.array(v2.string()))
  )
);
var CargoBuildProfileFn = v2.pipe(
  v2.function(),
  v2.args(v2.strictTuple([v2.object({ production: v2.boolean() })])),
  v2.returns(v2.string())
);
var CargoBuildProfile = v2.optional(
  v2.pipe(
    v2.union([
      v2.pipe(
        v2.string(),
        v2.transform((profile) => (_) => profile)
      ),
      CargoBuildProfileFn
    ])
  ),
  () => (args_0) => args_0.production ? "release" : "dev"
);
var BaseFieldsSchema = v2.object({
  pattern: PatternFilterSchema,
  production: v2.optional(v2.boolean()),
  logLevel: v2.optional(logLevel, "silent"),
  noTypescript: enable,
  browserOnly: enable,
  cargoBuildOverrides: CargoBuildOverridesSchema,
  cargoBuildProfile: CargoBuildProfile,
  cargoBuildTarget: v2.optional(v2.string(), "wasm32-unknown-unknown")
});
var UnpluginCargoOptionsSchema = v2.pipe(
  v2.union([
    v2.object({ ...BaseFieldsSchema.entries, allFeatures: v2.literal(true) }),
    v2.object({
      ...BaseFieldsSchema.entries,
      features: v2.optional(v2.array(v2.string())),
      noDefaultFeatures: enable
    })
  ]),
  v2.transform((options) => ({
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
  }))
);
var parsePluginOptions = (input) => v2.parse(UnpluginCargoOptionsSchema, input);

// src/internal/core.ts
var execFileAsync3 = promisify3(execFile3);
function resolveProduction(options) {
  if (options.production !== void 0) return options.production;
  return process.env.NODE_ENV === "production";
}
function unpluginFactory(pluginOptions_) {
  const {
    browserless,
    typescript,
    cargoBuildTarget,
    cargoBuildOverrides,
    ...context
  } = parsePluginOptions(pluginOptions_);
  const log = pino({ level: context.logLevel });
  const libraries = new HashSet();
  return {
    name: "unplugin-cargo",
    resolveId(source, importer) {
      if (path5.isAbsolute(source)) {
        return null;
      }
      const hash = libraries.findHashFromValue(
        (library) => library.libraryFilePath === importer
      );
      if (hash === void 0) {
        return null;
      }
      return path5.resolve(createLibraryDir(hash), source);
    },
    watchChange(id, change) {
      log.debug({ id, change }, "watchChange");
    },
    async transform(_code, libraryFilePath) {
      if (path5.extname(libraryFilePath) !== ".rs") {
        return null;
      }
      const projectFilePath = findProjectFilePath(libraryFilePath, log);
      if (projectFilePath === void 0) {
        return null;
      }
      const relativeLibraryFilePath = path5.relative(path5.dirname(projectFilePath), libraryFilePath).replace(/\\/g, "/");
      if (!matchesPattern(relativeLibraryFilePath, context.pattern)) {
        return null;
      }
      if (typeof this.addWatchFile === "function") {
        this.addWatchFile(projectFilePath);
      }
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
      const libraryBuildDir = path5.resolve(
        cargoBuildTargetDir,
        cargoBuildTarget,
        cargoProfileDir
      );
      await cargoBuild({
        log,
        cargoBuildTarget,
        cargoBuildOverrides,
        cargoBuildProfile,
        projectFilePath,
        features: context.features
      });
      const wasmFilePath = path5.resolve(
        libraryBuildDir,
        `${libraryTargetName}.wasm`
      );
      const libraryDepsDir = path5.resolve(libraryBuildDir, "deps");
      const projectWatchFiles = await findProjectWatchFiles({
        projectRoot: path5.dirname(projectFilePath),
        workspaceRoot: projectMetadata.workspace_root,
        projectFilePath,
        libraryDepsDir,
        libraryTargetName
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
        features: context.features
      });
      const wasmBindgenOutDir = createLibraryDir(hash);
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
        if (typeof this.addWatchFile === "function") {
          this.addWatchFile(`${libraryFilePath}.d.ts`);
        }
      }
      const code = await readJavascriptEntryPoint({
        libraryTargetName,
        wasmBindgenOutDir
      });
      return { code };
    }
  };
}
async function readJavascriptEntryPoint(library) {
  const entrypoint = path5.resolve(
    library.wasmBindgenOutDir,
    `${library.libraryTargetName}.js`
  );
  let content = await readFile2(entrypoint, {
    encoding: "utf8"
  });
  content = content.replace(
    /((?:import|export)\b[^"']*["'])(\.\/[^"']*)(["'])/g,
    (_match, prefix, relPath, suffix) => `${prefix}${path5.resolve(library.wasmBindgenOutDir, relPath).replace(/\\/g, "/")}${suffix}`
  );
  return content;
}
async function copyTypescriptDeclaration(library) {
  const source = path5.join(
    library.wasmBindgenOutDir,
    `${library.libraryTargetName}.d.ts`
  );
  const target = `${library.libraryFilePath}.d.ts`;
  await copyFile(source, target);
}
async function buildWasmBindgen(input) {
  const args2 = [
    input.browserless ? "--target=bundler" : "--browser",
    input.typescript || `--no-typescript`,
    `--out-dir=${input.wasmBindgenOutDir}`,
    input.wasmFilePath
  ].filter(isString);
  input.log.debug({ args: args2 }, "wasm-bindgen");
  await execFileAsync3("wasm-bindgen", args2, {
    encoding: "utf-8"
  });
}

// src/index.ts
var cargo = createUnplugin(unpluginFactory);

// src/rspack.ts
var cargo2 = cargo.rspack;
var rspack_default = cargo2;
export {
  cargo2 as cargo,
  rspack_default as default
};
//# sourceMappingURL=rspack.js.map