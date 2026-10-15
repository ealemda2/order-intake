import { readFileSync } from "node:fs";

/** Bump whenever a prompt file in this directory changes; it is recorded in every result's `meta.promptVersion`. */
export const PROMPT_VERSION = "extract-v3";

export const EXTRACT_PROMPT = readFileSync(new URL("./extract.md", import.meta.url), "utf8");
