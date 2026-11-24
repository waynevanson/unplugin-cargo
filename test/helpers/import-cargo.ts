import path from "node:path";
import type * as unplugin from "unplugin";
import type { UnpluginCargoOptions } from "../../src/index";

const CARGO = path.resolve(import.meta.dirname, "../../src");

export async function importCargo(bundler: string) {
	const mod = await import(path.resolve(CARGO, `${bundler}.ts`));
	return mod.cargo as unplugin.UnpluginInstance<UnpluginCargoOptions, boolean>;
}
