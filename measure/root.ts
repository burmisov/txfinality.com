// The repository root, found from this file rather than from the working directory, so the
// runner reads `chains/` and writes `runs/` in its own checkout wherever it is started from.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const root: string = dirname(dirname(fileURLToPath(import.meta.url)));
