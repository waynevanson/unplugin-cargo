import type { UnpluginCargoOptions } from "../../../src/index";
import type { WatchSession } from "./types";

export async function watchWithBun(
	_fixture: string,
	_options: UnpluginCargoOptions,
	_outDir?: string,
): Promise<WatchSession> {
	throw new Error("Bun watch mode is not yet supported in tests");
}
