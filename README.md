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

This package is not published to npm. Because the built `dist` output is committed, it can be installed directly from a git tag without a build step:

```bash
# pnpm
pnpm add --save-dev "git+https://github.com/waynevanson/unplugin-cargo.git#0.2.1"

# npm
npm install --save-dev "git+https://github.com/waynevanson/unplugin-cargo.git#0.2.1"

# yarn
yarn add --dev "git+https://github.com/waynevanson/unplugin-cargo.git#0.2.1"

# bun
bun add --dev "git+https://github.com/waynevanson/unplugin-cargo.git#0.2.1"
```

The `0.2.1` fragment is the release tag; replace it with another tag, branch, or commit to install a different version. Use the tag exactly as it was pushed — a `v`-prefixed tag needs the `v` in the URL. Your lockfile pins the resolved commit, so upgrades are explicit.

> npm's [git URL specifier](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#git-urls-as-dependencies) only accepts a `<commit-ish>` or `semver:<range>` after `#`. This route requires `git` at install time.

## Usage

### 1. Configure your bundler

Import the plugin from the subpath for your bundler and specify which files should be treated as Rust entrypoints using a glob pattern. Patterns are matched against paths relative to each crate's root (the directory containing `Cargo.toml`).

#### Vite

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import { cargo } from "@waynevanson/unplugin-cargo/vite";

export default defineConfig({
  plugins: [
    cargo({
      // Files to treat as Cargo entrypoints
      pattern: "src/lib.rs",
    }),
    wasm(),
  ],
});
```

#### Rollup

```typescript
// rollup.config.js
import { cargo } from "@waynevanson/unplugin-cargo/rollup";
import { unwasm } from "unwasm/plugin";

export default {
  plugins: [
    cargo({
      pattern: "src/lib.rs",
    }),
    unwasm({}),
  ],
};
```

#### Webpack

```javascript
// webpack.config.cjs
// Webpack needs a loader that synchronously instantiates wasm-bindgen's
// `--target=bundler` output. See test/helpers/webpack-wasm-loader.ts for a
// reference implementation.
const path = require("node:path");
const { cargo } = require("@waynevanson/unplugin-cargo/webpack");

module.exports = {
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: "javascript/auto",
        use: [
          {
            loader: path.resolve(__dirname, "wasm-loader.cjs"),
          },
        ],
      },
    ],
  },
  plugins: [
    cargo({
      pattern: "src/lib.rs",
    }),
  ],
};
```

#### esbuild

```typescript
// build.mjs
import { cargo } from "@waynevanson/unplugin-cargo/esbuild";
import { build } from "esbuild";
import { wasmLoader } from "esbuild-plugin-wasm";

build({
  plugins: [
    wasmLoader(),
    cargo({
      pattern: "src/lib.rs",
    }),
  ],
});
```

#### Rspack

```javascript
// rspack.config.mjs
import { cargo } from "@waynevanson/unplugin-cargo/rspack";
import { unwasmRspack } from "unwasm/plugin/rspack";

export default {
  plugins: [
    cargo({
      pattern: "src/lib.rs",
    }),
    unwasmRspack({}),
  ],
};
```

The WASM plugins shown above (`vite-plugin-wasm`, `unwasm`, and `esbuild-plugin-wasm`) are separate dependencies; install the one for your bundler alongside this package. Webpack needs a custom synchronous `.wasm` loader instead of a package; see [`test/helpers/webpack-wasm-loader.ts`](https://github.com/waynevanson/unplugin-cargo/blob/main/test/helpers/webpack-wasm-loader.ts) for a reference implementation.

### 2. Prepare your Rust code

Ensure your Rust crate is configured as a `cdylib`.

```toml
# Cargo.toml
[package]
name = "my-rust-lib"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
```

```rust
// src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

### 3. Import in JS/TS

```typescript
// index.ts
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
