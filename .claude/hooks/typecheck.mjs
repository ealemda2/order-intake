#!/usr/bin/env node
// PostToolUse on Edit/Write: typecheck the package that owns the edited file.
// Exit 2 feeds the errors straight back to Claude so it fixes them before moving on.
import { spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || "{}");
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const p = input.tool_input?.file_path;
if (!p || !/\.(ts|tsx)$/.test(p)) process.exit(0);

const rel = relative(root, resolve(root, p)).split("\\").join("/");
const args = rel.startsWith("web/") ? ["-C", "web", "exec", "tsc", "--noEmit"] : ["exec", "tsc", "--noEmit"];
const r = spawnSync("pnpm", args, { cwd: root, encoding: "utf8", timeout: 80_000 });
if (r.status === 0) process.exit(0);

const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(0, 30).join("\n");
process.stderr.write(`Typecheck failed after editing ${rel}:\n${out}\n`);
process.exit(2);
