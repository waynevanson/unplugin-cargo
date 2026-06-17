# Refactor vite-plugin-cargo to unplugin

Created: 2026-06-16T23:38:35Z

## Goal

Convert `@waynevanson/vite-plugin-cargo` from a Vite-only plugin into a universal `@waynevanson/unplugin-cargo` that works across Vite, Rollup, Webpack, esbuild, and Rspack using `unplugin`.

## Context

The current implementation is tightly coupled to Vite/Rollup APIs:

- Imports `Plugin` and `TransformPluginContext` from `vite` / `rollup`.
- Detects production via Vite's `configResolved` hook (`config.command === "build"`).
- Uses `this.fs.readFile` / `this.fs.copyFile` from the Rollup plugin context.
- Uses Vite's transform `filter` object syntax.
- Declares `vite` as a required peer dependency.
- Builds a single ESM entrypoint with Vite.

The core Rust/cargo pipeline (cargo metadata, cargo build, depfile parsing, wasm-bindgen, caching) is engine-agnostic and can be reused inside an `unplugin` factory.

Decisions already agreed with the user:

- Rename package to `@waynevanson/unplugin-cargo`.
- Expose subpath entrypoints for all unplugin engines (`/vite`, `/rollup`, `/webpack`, `/esbuild`, `/rspack`).
- Detect production with `process.env.NODE_ENV === "production"`, overridable by a new `production?: boolean` option.
- Clean break: rename `VitePluginCargoOptions` to `UnpluginCargoOptions`; no backwards-compat aliases.
- Watch / `.d.ts` emission: best-effort universal (use `this.addWatchFile` when the unplugin context provides it; otherwise skip watching but still copy declarations).
- Test Vite only initially; other engines best-effort.
- ESM-only output; no CommonJS build.
- Only publish under the new name; do not publish during this refactor.
- Keep `wasm-bindgen --target=bundler` hardcoded.

## Tasks

- [ ] **Task 1: Update package metadata and dependencies**
  - Rename package from `@waynevanson/vite-plugin-cargo` to `@waynevanson/unplugin-cargo` in `package.json`.
  - Update description and `keywords` to include `unplugin`, `rollup`, `webpack`, `esbuild`, `rspack`, `wasm`, `rust`, `cargo`.
  - Remove `vite` from `peerDependencies` and `peerDependenciesMeta`.
  - Add `unplugin` to `dependencies`.
  - Add `tsup` to `devDependencies` (replace Vite as the build tool).
  - Remove unused `@types/debug` and `@microsoft/api-extractor` from `devDependencies` if still present.
  - Update `scripts.build` and `scripts.prepublishOnly` to use `tsup`.
  - Update `files` if necessary (keep `dist`).

- [ ] **Task 2: Replace Vite build config with tsup multi-entrypoint config**
  - Delete `vite.config.ts`.
  - Create `tsup.config.ts` with entries: `index`, `vite`, `rollup`, `webpack`, `esbuild`, `rspack`.
  - Configure ESM-only output, sourcemaps, `dts: true`, and externalize Node built-ins and `node_modules`.
  - Update `package.json` `exports` map to expose each subpath with correct `types` and `default` conditions, e.g.:
    ```json
    "exports": {
      ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "./vite": { "types": "./dist/vite.d.ts", "default": "./dist/vite.js" },
      "./rollup": { "types": "./dist/rollup.d.ts", "default": "./dist/rollup.js" },
      "./webpack": { "types": "./dist/webpack.d.ts", "default": "./dist/webpack.js" },
      "./esbuild": { "types": "./dist/esbuild.d.ts", "default": "./dist/esbuild.js" },
      "./rspack": { "types": "./dist/rspack.d.ts", "default": "./dist/rspack.js" }
    }
    ```
  - Update `main` and `types` to `./dist/index.js` and `./dist/index.d.ts`.

- [ ] **Task 3: Refactor options schema**
  - In `src/plugin-options.ts`:
    - Rename file to `src/options.ts` (optional but recommended).
    - Remove the `StringFilter` import from `rollup`.
    - Define a portable pattern type (`string | RegExp | Array<string | RegExp> | { include?, exclude? }`).
    - Rename `VitePluginCargoOptions` to `UnpluginCargoOptions`.
    - Rename `VitePluginCargoOptionsInternal` to `UnpluginCargoOptionsInternal`.
    - Add `production?: boolean` option to the schema with JSDoc.
    - Update the default `cargoBuildProfile` function to use the resolved production flag.
    - Keep all other existing options (`pattern`, `logLevel`, `noTypescript`, `browserOnly`, `cargoBuildOverrides`, `cargoBuildProfile`, `cargoBuildTarget`, feature flags).

- [ ] **Task 4: Refactor core plugin to unplugin factory**
  - Create `src/core.ts` containing the unplugin factory function:
    - Import `createUnplugin` from `unplugin` and return `UnpluginOptions`.
    - Resolve `production` from `options.production` falling back to `process.env.NODE_ENV === "production"`.
    - Remove the Vite-specific `configResolved` hook.
    - Replace `transform: { filter, handler }` with unplugin's `transform(code, id)` hook and implement manual pattern matching at the start of the handler (reuse the resolved `pattern`).
    - Keep `resolveId` logic; it works across unplugin-supported engines.
    - Keep `watchChange` as a no-op hook for now (it is currently a TODO); unplugin exposes it where supported.
    - Update `addWatchFile` calls to be guarded (`if (typeof this.addWatchFile === "function")`).
  - Update `src/index.ts` to export the unplugin instance:
    ```ts
    import { createUnplugin } from "unplugin";
    import { unpluginFactory } from "./core";
    export const cargo = createUnplugin(unpluginFactory);
    export default cargo;
    export type { UnpluginCargoOptions } from "./options";
    ```

- [ ] **Task 5: Replace Rollup/Vite plugin context fs calls with Node fs/promises**
  - In `src/core.ts`:
    - Import `readFile` and `copyFile` from `node:fs/promises`.
    - Replace `this.fs.readFile(...)` and `this.fs.copyFile(...)` with direct `fs` calls.
    - Remove `TransformPluginContext` type annotations from helper functions.
  - In `src/find-library-dependencies.ts`:
    - Remove the `this: TransformPluginContext` parameter.
    - Accept `libraryDepsFilePath` and read it with `fs/promises` directly (or have the caller pass the depfile contents).
    - Update the caller in `src/core.ts` accordingly.

- [ ] **Task 6: Add per-bundler entrypoints**
  - Create `src/vite.ts`:
    ```ts
    import { cargo as cargoUnplugin } from "./index";
    export const cargo = cargoUnplugin.vite;
    export default cargo;
    ```
  - Create `src/rollup.ts`, `src/webpack.ts`, `src/esbuild.ts`, `src/rspack.ts` with the same pattern using `cargoUnplugin.rollup`, `.webpack`, `.esbuild`, `.rspack`.
  - Ensure each entrypoint compiles independently and exposes the plugin function as the default and as a named `cargo` export.

- [ ] **Task 7: Update cache directory and utility cleanup**
  - In `src/utils.ts`:
    - Rename `CACHE_DIR` from `node_modules/.cache/vitest-plugin-cargo` to `node_modules/.cache/unplugin-cargo`.
  - Consider making `CACHE_DIR` configurable via a `cacheDir` option in the future; for now just fix the typo/name.

- [ ] **Task 8: Update tests and add Rollup smoke test**
  - In `test/lib.spec.ts`:
    - Update the import from `../src/index` to `../src/vite`.
    - Keep the existing Vite integration test as-is.
  - Add a minimal Rollup integration test (optional but recommended) using `rollup` and `@rollup/plugin-node-resolve` to verify the `/rollup` entrypoint resolves and transforms `fixtures/lib/src/lib.rs` without throwing.
  - Ensure both tests still require the external Rust toolchain (`cargo`, `wasm-bindgen-cli`, `wasm32-unknown-unknown`).

- [ ] **Task 9: Update README and documentation**
  - Rewrite the README title and intro for `unplugin-cargo`.
  - Update installation command to `npm install @waynevanson/unplugin-cargo --save-dev`.
  - Add usage examples for Vite, Rollup, Webpack, esbuild, and Rspack using the new subpath imports.
  - Fix the `includes` vs `pattern` documentation discrepancy: document the correct option name `pattern`.
  - Document the new `production?: boolean` option.
  - Update the "How it works" section to mention all supported bundlers.
  - Add a migration note for users coming from `@waynevanson/vite-plugin-cargo`.
  - Update repository URL if it changes (e.g., to `https://github.com/waynevanson/unplugin-cargo`).

- [ ] **Task 10: Build and test verification**
  - Run `pnpm install` to update the lockfile.
  - Run `pnpm build` and verify `dist/` contains `index.js`, `vite.js`, `rollup.js`, `webpack.js`, `esbuild.js`, `rspack.js`, plus corresponding `.d.ts` files.
  - Run `pnpm test` and confirm the Vite integration test passes.
  - Manually inspect generated `.d.ts` files to ensure `UnpluginCargoOptions` is exported and subpath types are correct.
  - Run the Biome linter/formatter if configured.

## Pending Questions

- Should we implement actual watch-mode rebuild logic now that `watchChange` is exposed by unplugin, or leave it as the existing TODO?
