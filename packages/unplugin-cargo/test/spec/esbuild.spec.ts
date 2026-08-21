import { buildWithEsbuild } from "../helpers/bundler";
import { runBundlerTests } from "../helpers/runner";

runBundlerTests("esbuild", buildWithEsbuild);
