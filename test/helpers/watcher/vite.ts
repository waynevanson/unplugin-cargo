import fs from "node:fs/promises";
import path from "node:path";
import type { RollupWatcher, RollupWatcherEvent } from "rollup";
import { build } from "vite";
import wasm from "vite-plugin-wasm";
import type { UnpluginCargoOptions } from "../../../src/index";
import { createHtml } from "../create-html";
import { importCargo } from "../import-cargo";
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

export async function watchWithVite(
	fixture: string,
	options: UnpluginCargoOptions,
	outDir = path.resolve(fixture, "dists", `dist-watch-vite-${Date.now()}`),
): Promise<WatchSession> {
	await fs.mkdir(outDir, { recursive: true });
	const cargo = await importCargo("vite");
	const watcher = (await build({
		root: fixture,
		logLevel: "silent",
		plugins: [cargo(options), wasm()],
		build: {
			outDir,
			emptyOutDir: false,
			watch: {},
			rollupOptions: {
				output: {
					entryFileNames: "index.js",
				},
			},
		},
	})) as RollupWatcher | undefined;

	if (!watcher) {
		throw new Error("Expected Vite build to return a watcher");
	}

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
