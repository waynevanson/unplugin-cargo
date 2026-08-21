# unplugin-cargo

A universal plugin that seamlessly integrates Rust crates into your frontend project by compiling them to WebAssembly via `cargo` and `wasm-bindgen`. Powered by [unplugin](https://github.com/unjs/unplugin), it works with Vite, Rollup, Webpack, esbuild, and Rspack.

## Features

- **Zero-Config Compiling**: Automatically detects the closest `Cargo.toml`.
- **Universal**: Works across Vite, Rollup, Webpack, esbuild, and Rspack.
- **Watch mode**: Watches dependencies related to the entrypoint (where the bundler supports it).
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

```bash
npm install @waynevanson/unplugin-cargo --save-dev
```

## Usage

### 1. Configure your bundler

Import the plugin from the subpath for your bundler and specify which files should be treated as Rust entrypoints using a glob pattern.

#### Vite

```typescript
import { defineConfig } from "vite";
import { cargo } from "@waynevanson/unplugin-cargo/vite";

export default defineConfig({
  plugins: [
    cargo({
      // Files to treat as Cargo entrypoints
      pattern: "**/src/lib.rs",
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
      pattern: "**/src/lib.rs",
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
      pattern: "**/src/lib.rs",
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
      pattern: "**/src/lib.rs",
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
      pattern: "**/src/lib.rs",
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
| `pattern`             | `string \| RegExp \| Array<string \| RegExp> \| { include?, exclude? }`                       | Pattern of files to treat as Cargo entrypoints. Strings are interpreted as glob patterns.    |
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
