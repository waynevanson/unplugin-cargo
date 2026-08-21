import path from "node:path";
import type * as unplugin from "unplugin";
import type { UnpluginCargoOptions } from "../../dist/index";

const CARGO = path.resolve(import.meta.dirname, "../../dist");

export async function importCargo(bundler: string) {
	const mod = await import(path.resolve(CARGO, `${bundler}.js`));
	return mod.cargo as unplugin.UnpluginInstance<UnpluginCargoOptions, boolean>;
}
