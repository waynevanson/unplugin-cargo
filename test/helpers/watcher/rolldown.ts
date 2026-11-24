import fs from "node:fs/promises";
import path from "node:path";
import type { RollupWatcher, RollupWatcherEvent } from "rollup";
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

export async function watchWithRolldown(
	fixture: string,
	options: UnpluginCargoOptions,
	outDir = path.resolve(fixture, "dists", `dist-watch-rolldown-${Date.now()}`),
): Promise<WatchSession> {
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("rollup");
	const { watch } = await import("rolldown");
	const watcher = watch({
		input: path.resolve(fixture, "src/index.js"),
		output: { format: "esm", dir: outDir, entryFileNames: "index.js" },
		plugins: [cargo(options), rollupWasmBindgen()],
		checks: {
			pluginTimings: false,
		},
	}) as unknown as RollupWatcher;

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
