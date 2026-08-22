import type { UnpluginCargoOptions } from "../../../src/index";

export interface WatchSession {
	outDir: string;
	waitForRebuild: () => Promise<void>;
	close: () => Promise<void>;
}

export type WatchWith = (
	fixture: string,
	options: UnpluginCargoOptions,
	outDir?: string,
) => Promise<WatchSession>;
