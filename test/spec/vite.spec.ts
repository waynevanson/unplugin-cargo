import { buildWithVite } from "../helpers/bundler";
import { runBundlerTests } from "../helpers/runner";

runBundlerTests("Vite", buildWithVite);
