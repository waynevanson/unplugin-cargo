import fs from "node:fs/promises";
import path from "node:path";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import type { RollupWatcher, RollupWatcherEvent } from "rollup";
import { watch as rollupWatch } from "rollup";
import type { UnpluginCargoOptions } from "../../../src/index";
import { createHtml } from "../create-html";
import { importCargo } from "../import-cargo";
import { rollupWasmBindgen } from "../rollup-wasm-bindgen";
import { WatchQueue } from "./queue";
import type { WatchSession } from "./types";

function waitForEnd(watcher: RollupWatcher, queue: WatchQueue): () => void {
	function onEvent(event: RollupWatcherEvent) {
		if (event.code === "END") {
			queue.resolve();
		} else if (event.code === "ERROR") {
			queue.reject(event.error);
		}
	}
	watcher.on("event", onEvent);
	return () => watcher.off("event", onEvent);
}

export async function watchWithRollup(
	fixture: string,
	options: UnpluginCargoOptions,
	outDir = path.resolve(fixture, "dists", `dist-watch-rollup-${Date.now()}`),
): Promise<WatchSession> {
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("rollup");
	const watcher = rollupWatch({
		input: path.resolve(fixture, "src/index.js"),
		output: { format: "es", dir: outDir },
		plugins: [
			// @ts-expect-error
			cargo(options),
			rollupWasmBindgen(),
			nodeResolve(),
		],
	});

	const queue = new WatchQueue();
	const unsubscribe = waitForEnd(watcher, queue);
	await queue.wait();
	unsubscribe();
	await createHtml(outDir, "./index.js");

	return {
		outDir,
		waitForRebuild: () => {
			const next = new WatchQueue();
			const off = waitForEnd(watcher, next);
			return next.wait().finally(off);
		},
		close: () => watcher.close(),
	};
}
