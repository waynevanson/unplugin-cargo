# unplugin-cargo

A universal plugin that seamlessly integrates Rust crates into your frontend project by compiling them to WebAssembly via `cargo` and `wasm-bindgen`. Powered by [unplugin](https://github.com/unjs/unplugin), it works with Vite, Rollup, Webpack, esbuild, and Rspack.

## Features

- **Universal**: Works across Vite, Rollup, Webpack, esbuild, and Rspack.
- **Watch mode**: Watches `Cargo.toml`, the workspace `Cargo.lock`, `build.rs`, and every `.rs` file in the project so edits trigger a rebuild (where the bundler supports it).
- **Cargo workspaces**: dep-info paths resolve against the workspace root, so crates in `crates/*` work as entrypoints.
- **WASM-Bindgen Integration**: Generates the necessary JS glue code automatically.
- **TypeScript Support**: Automatically generates and syncs `.d.ts` files for your Rust exports.
- **HMR Support**: Works with Vite's dev server.
- **Release Optimization**: Automatically uses release builds when `NODE_ENV` is `production`.

## Prerequisites

You must have the following installed on your system:

1. [Rust and Cargo](https://rustup.rs/)
2. `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`
3. [`wasm-bindgen-cli`](https://github.com/rustwasm/wasm-bindgen): `cargo install -f wasm-bindgen-cli`

## Installation

This package is not published to npm. Every release attaches a prebuilt tarball to the [GitHub Releases](https://github.com/waynevanson/unplugin-cargo/releases) page, which any package manager can install straight from its URL — no registry, no token, and no build step:

```bash
# npm, pnpm, yarn, bun all accept a tarball URL
pnpm add --save-dev https://github.com/waynevanson/unplugin-cargo/releases/download/0.2.1/waynevanson-unplugin-cargo-0.2.1.tgz
```

The version appears twice in that URL, in the tag and in the filename. Swap both occurrences to move to another release; your lockfile pins the tarball's `resolved` URL and `integrity` hash, so upgrades are explicit. Use the tag exactly as it was pushed — a `v`-prefixed tag needs the `v` in the URL's tag segment, though never in the filename.

### From the repository

The built `dist` output is committed as well, so the package can also be installed from a git ref without a build step. This repository is a monorepo, so point the package manager at the package directory:

```bash
pnpm add --save-dev "github:waynevanson/unplugin-cargo#path:/packages/unplugin-cargo&0.2.0"
```

> npm's [git URL specifier](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#git-urls-as-dependencies) only accepts a `<commit-ish>` or `semver:<range>` after `#`, and its `<path>` segment refers to the repository path on the host, not a directory inside the repo. `#path:` is a pnpm extension, so use pnpm for a direct GitHub install, or prefer the tarball URL above. The `&0.2.0` fragment pins the install to the `0.2.0` tag; replace it with another tag or commit to install a different version. Unlike the tarball, this route requires `git` at install time.

## Usage

### 1. Configure your bundler

Import the plugin from the subpath for your bundler and specify which files should be treated as Rust entrypoints using a glob pattern. Patterns are matched against paths relative to each crate's root (the directory containing `Cargo.toml`).

#### Vite

```typescript
import { defineConfig } from "vite";
import { cargo } from "@waynevanson/unplugin-cargo/vite";

export default defineConfig({
  plugins: [
    cargo({
      // Files to treat as Cargo entrypoints
      pattern: "src/lib.rs",
    }),
  ],
});
```

#### Rollup

```typescript
import { cargo } from "@waynevanson/unplugin-cargo/rollup";

export default {
  plugins: [
    cargo({
      pattern: "src/lib.rs",
    }),
  ],
};
```

#### Webpack

```typescript
const { cargo } = require("@waynevanson/unplugin-cargo/webpack");

module.exports = {
  plugins: [
    cargo({
      pattern: "src/lib.rs",
    }),
  ],
};
```

#### esbuild

```typescript
import { cargo } from "@waynevanson/unplugin-cargo/esbuild";
import { build } from "esbuild";

build({
  plugins: [
    cargo({
      pattern: "src/lib.rs",
    }),
  ],
});
```

#### Rspack

```typescript
const { cargo } = require("@waynevanson/unplugin-cargo/rspack");

module.exports = {
  plugins: [
    cargo({
      pattern: "src/lib.rs",
    }),
  ],
};
```

### 2. Prepare your Rust code

Ensure your Rust crate is configured as a `cdylib`.

**Cargo.toml**

```toml
[package]
name = "my-rust-lib"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
```

**src/lib.rs**

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

### 3. Import in JS/TS

```typescript
import { greet } from "./src/lib.rs";

console.log(greet("Vite"));
```

## Configuration Options

### Base Configuration

| Option                | Type                                                                                         | Description                                                                                  |
| :-------------------- | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| `pattern`             | `string \| RegExp \| Array<string \| RegExp> \| { include?, exclude? }`                       | Pattern of files to treat as Cargo entrypoints. Strings are interpreted as glob patterns matched relative to each crate's root (the directory containing `Cargo.toml`). |
| `production`          | `boolean`                                                                                    | Explicitly set production mode. Defaults to `process.env.NODE_ENV === "production"`.         |
| `browserOnly`         | `boolean`                                                                                    | (Optional) Passes `--browser` to `wasm-bindgen`.                                             |
| `noTypescript`        | `boolean`                                                                                    | (Optional) Disables `.d.ts` generation.                                                      |
| `cargoBuildOverrides` | `(args: Array<string>) => Array<string>`                                                     | (Optional) Override args to `cargo build`.                                                   |
| `cargoBuildProfile`   | `string \| ((context: { production: boolean }) => string)`                                    | (Optional) Cargo build profile. Defaults to `release` in production, `dev` otherwise.        |
| `cargoBuildTarget`    | `string`                                                                                     | (Optional) Target triple passed to `cargo build`. Defaults to `wasm32-unknown-unknown`.      |
| `logLevel`            | `silent \| fatal \| error \| warn \| info \| debug \| trace`                                  | (Optional) Log level for debugging the plugin. Defaults to `silent`.                         |

### Rust Features

Additionally, one of the following configurations can be used with the base.

| Option              | Type       | Description                                  |
| :------------------ | :--------- | :------------------------------------------- |
| `features`          | `string[]` | (Optional) List of Cargo features to enable. |
| `noDefaultFeatures` | `boolean`  | (Optional) Disable default Cargo features.   |

| Option        | Type      | Description                           |
| :------------ | :-------- | :------------------------------------ |
| `allFeatures` | `boolean` | (Optional) Enable all Cargo features. |

## How it works

Transformation pipeline:

```js
`.rs` -> `.wasm` + `.js` + `.d.ts`
```

1. **Detection**: The plugin matches files via the `pattern` glob/regex.
2. **Metadata**: It runs `cargo metadata` to find the correct `cdylib` target.
3. **Compilation**: Runs `cargo build --target wasm32-unknown-unknown`.
4. **Binding**: Runs `wasm-bindgen --target=bundler` on the resulting `.wasm` file to a local cache in `node_modules/.cache/unplugin-cargo`.
5. **Resolution**: Injects the generated JavaScript glue code into your bundle.

## Migration from `@waynevanson/vite-plugin-cargo`

- Install `@waynevanson/unplugin-cargo` instead.
- Import from the bundler-specific subpath, e.g. `@waynevanson/unplugin-cargo/vite`.
- Rename the `includes` option to `pattern`.
- The package is now ESM-only.
- The TypeScript option type `VitePluginCargoOptions` has been renamed to `UnpluginCargoOptions`.

## Releasing

Releases are cut only in CI, through `.github/workflows/release.yml`, which builds the package, runs `pnpm pack`, and attaches the tarball to a GitHub Release. Bump `packages/unplugin-cargo/package.json` and push a matching tag (with or without a `v` prefix) — the workflow refuses to release when the tag and the package version disagree:

```bash
git tag 0.2.1 && git push origin 0.2.1
```

You can also release an untagged commit by running the `release` workflow manually from the Actions tab (`workflow_dispatch`) and picking a branch, tag, or commit SHA; in that case the tag is created from the package version. The tag check only applies when HEAD is tagged, so bump the version before re-dispatching.

Re-running a release re-uploads the tarball for that tag with `--clobber`, so published versions are effectively immutable — bump the version rather than replacing a release's assets.
