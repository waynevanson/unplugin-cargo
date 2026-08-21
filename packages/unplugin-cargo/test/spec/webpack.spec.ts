import { buildWithWebpack } from "../helpers/bundler";
import { runBundlerTests } from "../helpers/runner";

runBundlerTests("webpack", buildWithWebpack);
