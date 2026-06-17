import { runBundlerTests } from "../helpers/runner";
import { buildWithWebpack } from "../helpers/bundlers";

runBundlerTests("webpack", buildWithWebpack);
