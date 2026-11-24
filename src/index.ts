import { createUnplugin } from "unplugin";
import { unpluginFactory } from "./internal/core";

export const cargo = createUnplugin(unpluginFactory);
export default cargo;

export type { UnpluginCargoOptions } from "./options";
