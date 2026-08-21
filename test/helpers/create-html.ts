import fs from "node:fs/promises";
import path from "node:path";

export function createHtml(outDir: string, scriptPath: string) {
	return fs.writeFile(
		path.join(outDir, "index.html"),
		`<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<div id="result"></div>
<script type="module" src="${scriptPath}"></script>
</body>
</html>`,
	);
}
