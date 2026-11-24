import { builtinModules } from "node:module";
import { defineConfig } from "tsdown";

const builtInNodeModules = [
	...builtinModules,
	...builtinModules.map((builtinModule) => `node:${builtinModule}`),
];

const dependencies = [
	"node-object-hash",
	"picomatch",
	"pino",
	"unplugin",
	"valibot",
];

export default defineConfig({
	entry: {
		index: "src/index.ts",
		vite: "src/vite.ts",
		farm: "src/farm.ts",
		rollup: "src/rollup.ts",
		webpack: "src/webpack.ts",
		esbuild: "src/esbuild.ts",
		rspack: "src/rspack.ts",
	},
	format: "esm",
	dts: true,
	sourcemap: true,
	clean: true,
	fixedExtension: false,
	deps: {
		neverBundle: [...builtInNodeModules, ...dependencies],
		dts: {
			neverBundle: true,
		},
	},
});
