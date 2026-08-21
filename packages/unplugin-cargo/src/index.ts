import { createUnplugin } from "unplugin";
import { unpluginFactory } from "./core";

export const cargo = createUnplugin(unpluginFactory);
export default cargo;

export type {
	UnpluginCargoOptions,
	UnpluginCargoOptionsInternal,
} from "./options";
