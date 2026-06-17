import { expect, test } from "vitest";
import type { UnpluginCargoOptions } from "../../dist/index";
import { runInBrowser } from "./browser";
import { startServer } from "./server";

export function runBundlerTests(
	name: string,
	buildFn: (options: UnpluginCargoOptions) => Promise<string>,
) {
	test(`${name}: default options`, async () => {
		const outDir = await buildFn({ pattern: "**/src/lib.rs" });
		const { url, close } = await startServer(outDir);
		try {
			const result = await runInBrowser(url);
			expect(result.add).toBe(4);
			expect(result.multiplyAvailable).toBe(false);
		} finally {
			await close();
		}
	});

	test(`${name}: features: ['multiply']`, async () => {
		const outDir = await buildFn({
			pattern: "**/src/lib.rs",
			features: ["multiply"],
		});
		const { url, close } = await startServer(outDir);
		try {
			const result = await runInBrowser(url);
			expect(result.add).toBe(4);
			expect(result.multiplyAvailable).toBe(true);
			expect(result.multiply).toBe(12);
		} finally {
			await close();
		}
	});

	test(`${name}: allFeatures: true`, async () => {
		const outDir = await buildFn({
			pattern: "**/src/lib.rs",
			allFeatures: true,
		});
		const { url, close } = await startServer(outDir);
		try {
			const result = await runInBrowser(url);
			expect(result.add).toBe(4);
			expect(result.multiplyAvailable).toBe(true);
			expect(result.multiply).toBe(12);
		} finally {
			await close();
		}
	});

	test(`${name}: noDefaultFeatures: true`, async () => {
		const outDir = await buildFn({
			pattern: "**/src/lib.rs",
			noDefaultFeatures: true,
		});
		const { url, close } = await startServer(outDir);
		try {
			const result = await runInBrowser(url);
			expect(result.add).toBe(4);
			expect(result.multiplyAvailable).toBe(false);
		} finally {
			await close();
		}
	});

	test(`${name}: production: true`, async () => {
		const outDir = await buildFn({
			pattern: "**/src/lib.rs",
			production: true,
		});
		const { url, close } = await startServer(outDir);
		try {
			const result = await runInBrowser(url);
			expect(result.add).toBe(4);
		} finally {
			await close();
		}
	});

	test(`${name}: cargoBuildProfile: 'custom-profile'`, async () => {
		const outDir = await buildFn({
			pattern: "**/src/lib.rs",
			cargoBuildProfile: "custom-profile",
		});
		const { url, close } = await startServer(outDir);
		try {
			const result = await runInBrowser(url);
			expect(result.add).toBe(4);
		} finally {
			await close();
		}
	});

	test(`${name}: browserOnly: true`, async () => {
		const outDir = await buildFn({
			pattern: "**/src/lib.rs",
			browserOnly: true,
		});
		const { url, close } = await startServer(outDir);
		try {
			const result = await runInBrowser(url);
			expect(result.add).toBe(4);
		} finally {
			await close();
		}
	});

	test(`${name}: noTypescript: true`, async () => {
		const outDir = await buildFn({
			pattern: "**/src/lib.rs",
			noTypescript: true,
		});
		const { url, close } = await startServer(outDir);
		try {
			const result = await runInBrowser(url);
			expect(result.add).toBe(4);
		} finally {
			await close();
		}
	});

	test(`${name}: cargoBuildOverrides`, async () => {
		const outDir = await buildFn({
			pattern: "**/src/lib.rs",
			cargoBuildOverrides: (args) =>
				args.filter((a) => a !== "--quiet").concat("--verbose"),
		});
		const { url, close } = await startServer(outDir);
		try {
			const result = await runInBrowser(url);
			expect(result.add).toBe(4);
		} finally {
			await close();
		}
	});
}
