import type { UnpluginInstance } from "unplugin";
import { cargo as cargoUnplugin } from "./index";
import type { UnpluginCargoOptions } from "./options";

export const cargo: UnpluginInstance<UnpluginCargoOptions, boolean>["farm"] =
	cargoUnplugin.farm;
export default cargo;
