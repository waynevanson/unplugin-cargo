import { runBundlerTests } from "../helpers/runner";
import { buildWithEsbuild } from "../helpers/bundlers";

runBundlerTests("esbuild", buildWithEsbuild);
