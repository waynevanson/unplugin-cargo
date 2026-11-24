import http from "node:http";
import sirv from "sirv";

export async function startServer(
	root: string,
): Promise<{ url: string; close: () => Promise<void> }> {
	const server = http.createServer(sirv(root));
	await new Promise<void>((resolve) => server.listen(0, resolve));
	const address = server.address();
	const port =
		typeof address === "object" && address !== null ? address.port : 0;
	const url = `http://localhost:${port}`;
	return {
		url,
		close: () =>
			new Promise((resolve, reject) =>
				server.close((err) => (err ? reject(err) : resolve())),
			),
	};
}
