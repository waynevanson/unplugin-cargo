# Cross-Bundler E2E Test Suite

Created: 2026-06-17T00:27:40Z

## Goal

Add a comprehensive end-to-end test suite that builds `@waynevanson/unplugin-cargo` via `tsup`, then exercises the built plugin against **all 8 supported bundlers** (Vite, Rollup, webpack, esbuild, Rspack, Rolldown, Farm, Bun). Each test must produce a runnable bundle, serve it in a headless browser via Playwright, and assert that the compiled WASM executes correctly. The suite must also cover all major plugin configuration options.

## Context

- The plugin is powered by `unplugin` and exports bundler-specific entry points (`dist/vite.js`, `dist/rollup.js`, etc.).
- The existing test (`test/lib.spec.ts`) only verifies that Vite and Rollup builds do not throw; it does not run the generated WASM.
- The fixture `fixtures/lib/` contains a minimal Rust library compiled via `wasm-bindgen`.
- The user wants the tests to import from `dist/` (the built output) exactly as a user would.
- The user does not care about test speed, only coverage.
- No top-level await is allowed in fixture files.
- The Cargo fixture must define three profiles: `dev`, `release`, and `custom-profile`.

## Tasks

### Phase 1: Fixture & Build Setup

- [ ] **Task 1.1**: Update `fixtures/lib/Cargo.toml` to add `[profile.custom-profile]` and a `[features]` section with a `multiply` feature.
- [ ] **Task 1.2**: Update `fixtures/lib/src/lib.rs` to export an `add` function (always available) and a `multiply` function gated behind `#[cfg(feature = "multiply")]`.
- [ ] **Task 1.3**: Create `fixtures/lib/src/index.js` (browser entry). It must use `import('./lib.rs').then(...)` (no top-level await) to load the module, execute its exports, and write a JSON string into a DOM element (e.g. `document.getElementById('result').textContent = JSON.stringify({ add: ..., multiplyAvailable: ... })`).
- [ ] **Task 1.4**: Create `fixtures/lib/index.html` as a minimal static HTML shell containing a `<div id="result"></div>` and a script tag that loads `src/index.js`.
- [ ] **Task 1.5**: Add `vitest.config.ts` with a `globalSetup` script that runs `tsup` before any tests start.

### Phase 2: Test Infrastructure

- [ ] **Task 2.1**: Add dev dependencies: `@playwright/test`, `sirv`, `webpack`, `webpack-cli`, `html-webpack-plugin`, `@rspack/core`, `@rspack/cli`, `@rspack/plugin-html`, `@farmfe/core`, `rolldown`, `esbuild`, `@rollup/plugin-wasm`, `rollup`, `vite`.
- [ ] **Task 2.2**: Create `test/helpers/server.ts` to start/stop a `sirv` static server on a random port.
- [ ] **Task 2.3**: Create `test/helpers/browser.ts` using Playwright to launch Chromium, navigate to the served URL, wait for the `#result` DOM element to contain non-empty text, parse its `textContent` as JSON, and return the object.
- [ ] **Task 2.4**: Create `test/helpers/bundlers.ts` with one async build function per bundler. Each function must:
  - Accept `UnpluginCargoOptions`.
  - Use the **built** plugin from `dist/<bundler>.js`.
  - Handle bundler-specific WASM loading quirks (e.g. `experiments.asyncWebAssembly` for webpack/Rspack, `@rollup/plugin-wasm` for Rollup, `vite-plugin-wasm` for Vite, etc.).
  - For **Rolldown** and **Farm**, if a native WASM plugin is unavailable, inline the `.wasm` file as a base64 data URL within the bundle.
  - For **Bun**, use `Bun.build()` to produce the bundle, then treat the output directory like any other bundler for Playwright serving.
  - Return the absolute path to the output directory that can be passed to `sirv`.
  - Copy `fixtures/lib/index.html` into the output directory if the bundler does not emit its own HTML.

### Phase 3: Core Smoke Tests (All Bundlers)

For **each** bundler, add a dedicated spec file (e.g. `test/spec/vite.spec.ts`) that runs the following cases:

- [ ] **Task 3.1**: `default options` — builds and executes `add(2, 2)`, asserts result is `4`.
- [ ] **Task 3.2**: `features: ['multiply']` — asserts `multiply(3, 4)` is `12`.
- [ ] **Task 3.3**: `allFeatures: true` — asserts `multiply` is available.
- [ ] **Task 3.4**: `noDefaultFeatures: true` — asserts only default features are active.
- [ ] **Task 3.5**: `production: true` — asserts build succeeds with release defaults.
- [ ] **Task 3.6**: `cargoBuildProfile: 'custom-profile'` — asserts build succeeds using the custom profile.
- [ ] **Task 3.7**: `browserOnly: true` — asserts build succeeds with `--browser` passed to wasm-bindgen.
- [ ] **Task 3.8**: `noTypescript: true` — asserts build succeeds and no `.d.ts` file is emitted.
- [ ] **Task 3.9**: `cargoBuildOverrides` — asserts custom args reach `cargo build`.

### Phase 4: Integration & Verification

- [ ] **Task 4.1**: Ensure `pnpm test` runs the full suite via `vitest run`.
- [ ] **Task 4.2**: Verify Playwright browsers are installed (document `pnpm exec playwright install` if needed).
- [ ] **Task 4.3**: Add a CI-ready script entry: `"test:e2e": "vitest run test/spec"`.

## Decisions

- **Rolldown / Farm WASM plugins**: If a native WASM plugin is unavailable, inline `.wasm` as a base64 data URL within the bundle.
- **Bun `Bun.build()` WASM support**: Bundle with `Bun.build()` and serve the output via Playwright like the other bundlers.
- **Matrix size**: 72 tests (8 bundlers × 9 cases) is acceptable. Each unique `(bundler, profile, features)` combination may trigger a separate `cargo build`; speed is not a concern.
