import { runBundlerTests } from "../helpers/runner";
import { buildWithVite } from "../helpers/bundlers";

runBundlerTests("Vite", buildWithVite);
