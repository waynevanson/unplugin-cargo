import { cargo as cargoEsbuild } from "../../src/esbuild";
import { cargo as cargoFarm } from "../../src/farm";
import { cargo as cargoRollup } from "../../src/rollup";
import { cargo as cargoRspack } from "../../src/rspack";
import { cargo as cargoVite } from "../../src/vite";
import { cargo as cargoWebpack } from "../../src/webpack";

const cargos = {
	esbuild: cargoEsbuild,
	farm: cargoFarm,
	rollup: cargoRollup,
	rspack: cargoRspack,
	vite: cargoVite,
	webpack: cargoWebpack,
} as const;

type Bundler = keyof typeof cargos;

export async function importCargo<B extends Bundler>(bundler: B) {
	return cargos[bundler];
}
