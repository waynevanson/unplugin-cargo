import { execFileSync } from "node:child_process";
import path from "node:path";
import type pino from "pino";

export function findProjectFilePath(id: string, log: pino.Logger) {
	const args = ["locate-project", "--message-format=plain"];

	log.debug(args, "cargo-locate-project");

	const project = execFileSync("cargo", args, {
		stdio: ["ignore", "pipe", "ignore"],
		encoding: "utf-8",
		cwd: path.dirname(id),
	}).trim();

	log.debug({ project }, "cargo-project");

	return project;
}
