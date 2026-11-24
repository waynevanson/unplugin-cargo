import { LevelWithSilent } from "pino";
import "valibot";
type Pattern = string | RegExp | Array<string | RegExp> | {
  include?: string | RegExp | Array<string | RegExp>;
  exclude?: string | RegExp | Array<string | RegExp>;
};
type UnpluginCargoOptions = {
  /**
   * @summary
   * Pattern of files that could be used as entrypoints.
   * Matched against paths relative to each crate's root
   * (the directory containing `Cargo.toml`).
   *
   * @example
   * `src/lib.rs`
   */
  pattern: Pattern;
  /**
   * @summary
   * Explicitly set production mode. When omitted, falls back to
   * `process.env.NODE_ENV === "production"`.
   * @default process.env.NODE_ENV === "production"
   */
  production?: boolean;
  /**
   * @summary
   * Log level for debugging this plugin
   * @default "silent"
   */
  logLevel?: LevelWithSilent;
  /**
   * @summary
   * Disable emitting typescript declaration (`.dts`) files in all contexts.
   * @default false
   */
  noTypescript?: boolean;
  /**
   * @summary
   * Hints to `wasm-bindgen` that compatible is narrowed to browsers,
   * and not other environments like Node.js.
   * @default false
   */
  browserOnly?: boolean;
  /**
   * @summary
   * An escape hatch to override the arguments for `cargo build`.
   * Useful for adding nightly flags.
   * @default (args) => args
   * @example
   * (args) => args.concat("Zsome-nightly-flag=true")
   */
  cargoBuildOverrides?: (args: Array<string>) => Array<string>;
  /**
   * @summary
   * Build profile provided to cargo build.
   * @default (context) => context.production ? "release" : "dev"
   * @example (context) => context.production ? "release" : "test"
   */
  cargoBuildProfile?: string | ((context: {
    production: boolean;
  }) => string);
  /**
   * @summary
   * Target triple passed to `cargo build`.
   * @default "wasm32-unknown-unknown"
   */
  cargoBuildTarget?: string;
} & ({
  /**
   * @summary
   * Enable all features of this library
   * @default false
   */
  allFeatures: true;
} | {
  /**
   * @summary
   * Disable all default features
   * @default false
   */
  noDefaultFeatures?: boolean;
  /**
   * @summary
   * Enable any features at build time.
   * @default []
   * @example
   * ["serde1"]
   */
  features?: Array<string>;
});
export { UnpluginCargoOptions as t };