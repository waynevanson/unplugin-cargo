import type { UnpluginCargoOptions } from "../../../src/index";
import type { WatchSession } from "./types";

export async function watchWithFarm(
	_fixture: string,
	_options: UnpluginCargoOptions,
	_outDir?: string,
): Promise<WatchSession> {
	throw new Error("Farm watch mode is not yet supported in tests");
}
