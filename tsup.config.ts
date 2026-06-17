import { builtinModules } from "node:module";
import { defineConfig } from "tsup";

const builtInNodeModules = [
	...builtinModules,
	...builtinModules.map((builtinModule) => `node:${builtinModule}`),
];

export default defineConfig({
	entry: {
		index: "src/index.ts",
		vite: "src/vite.ts",
		rollup: "src/rollup.ts",
		webpack: "src/webpack.ts",
		esbuild: "src/esbuild.ts",
		rspack: "src/rspack.ts",
	},
	format: ["esm"],
	dts: true,
	sourcemap: true,
	splitting: false,
	clean: true,
	external: [...builtInNodeModules, /^node_modules/],
});
