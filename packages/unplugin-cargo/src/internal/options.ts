import type { LevelWithSilent } from "pino";
import * as v from "valibot";

const logLevel = v.picklist([
	"silent",
	"fatal",
	"error",
	"warn",
	"info",
	"debug",
	"trace",
]);

const enable = v.optional(v.boolean(), false);

const PatternSchema = v.union([v.string(), v.instance(RegExp)]);
const MaybeArraySchema = <TSchema extends v.GenericSchema>(schema: TSchema) =>
	v.union([schema, v.array(schema)]);

const PatternFilterSchema = v.union([
	MaybeArraySchema(PatternSchema),
	v.object({
		include: v.optional(MaybeArraySchema(PatternSchema)),
		exclude: v.optional(MaybeArraySchema(PatternSchema)),
	}),
]);

const CargoBuildOverridesSchema = v.optional(
	v.pipe(
		v.function(),
		v.args(v.strictTuple([v.array(v.string())])),
		v.returns(v.array(v.string())),
	),
);

export type CargoBuildOverrides = v.InferOutput<
	typeof CargoBuildOverridesSchema
>;

const CargoBuildProfileFn = v.pipe(
	v.function(),
	v.args(v.strictTuple([v.object({ production: v.boolean() })])),
	v.returns(v.string()),
);

const CargoBuildProfile = v.optional(
	v.pipe(
		v.union([
			v.pipe(
				v.string(),
				v.transform((profile) => (_: { production: boolean }) => profile),
			),
			CargoBuildProfileFn,
		]),
	),
	() => (args_0: { production: boolean }) =>
		args_0.production ? "release" : "dev",
);

const BaseFieldsSchema = v.object({
	pattern: PatternFilterSchema,
	production: v.optional(v.boolean()),
	logLevel: v.optional(logLevel, "silent"),
	noTypescript: enable,
	browserOnly: enable,
	cargoBuildOverrides: CargoBuildOverridesSchema,
	cargoBuildProfile: CargoBuildProfile,
	cargoBuildTarget: v.optional(v.string(), "wasm32-unknown-unknown"),
});

const UnpluginCargoOptionsSchema = v.pipe(
	v.union([
		v.object({ ...BaseFieldsSchema.entries, allFeatures: v.literal(true) }),
		v.object({
			...BaseFieldsSchema.entries,
			features: v.optional(v.array(v.string())),
			noDefaultFeatures: enable,
		}),
	]),
	v.transform((options) => ({
		production: options.production,
		typescript: !options.noTypescript,
		browserless: !options.browserOnly,
		pattern: options.pattern,
		cargoBuildOverrides: options.cargoBuildOverrides,
		logLevel: options.logLevel,
		cargoBuildProfile: options.cargoBuildProfile,
		cargoBuildTarget: options.cargoBuildTarget,
		features:
			"allFeatures" in options
				? {
						allFeatures: true as const,
						features: undefined,
						noDefaultFeatures: false as const,
					}
				: {
						allFeatures: false as const,
						features: options.features,
						noDefaultFeatures: options.noDefaultFeatures,
					},
	})),
);

export type UnpluginCargoOptionsInternal = {
	production: boolean | undefined;
	typescript: boolean;
	browserless: boolean;
	pattern: UnpluginCargoOptions["pattern"];
	cargoBuildOverrides: CargoBuildOverrides;
	logLevel: LevelWithSilent;
	cargoBuildProfile: (context: { production: boolean }) => string;
	cargoBuildTarget: string;
	features: {
		allFeatures: boolean;
		features?: Array<string>;
		noDefaultFeatures: boolean;
	};
};

export const parsePluginOptions = (input: unknown) =>
	v.parse(UnpluginCargoOptionsSchema, input);

export type UnpluginCargoOptions = {
	/**
	 * @summary
	 * Pattern of files that could be used as entrypoints.
	 * Matched against paths relative to each crate's root
	 * (the directory containing `Cargo.toml`).
	 *
	 * @example
	 * `src/lib.rs`
	 */
	pattern:
		| string
		| RegExp
		| Array<string | RegExp>
		| {
				include?: string | RegExp | Array<string | RegExp>;
				exclude?: string | RegExp | Array<string | RegExp>;
		  };

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
	cargoBuildProfile?: string | ((context: { production: boolean }) => string);

	/**
	 * @summary
	 * Target triple passed to `cargo build`.
	 * @default "wasm32-unknown-unknown"
	 */
	cargoBuildTarget?: string;
} & (
	| {
			/**
			 * @summary
			 * Enable all features of this library
			 * @default false
			 */
			allFeatures: true;
	  }
	| {
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
	  }
);
