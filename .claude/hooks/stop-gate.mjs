#!/usr/bin/env node
// Stop hook: the turn can't end red. If source/test files changed, run the unit tests;
// on failure, block the stop once and hand Claude the failures. `stop_hook_active` prevents loops.
import { spawnSync } from "node:child_process";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || "{}");
if (input.stop_hook_active || process.env.SKIP_STOP_GATE === "1") process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
const changed = (status.stdout ?? "").split("\n").some((l) => /\.(ts|tsx)$/.test(l.trim()));
if (!changed) process.exit(0);

const r = spawnSync("pnpm", ["exec", "vitest", "run", "--reporter=dot"], { cwd: root, encoding: "utf8", timeout: 170_000 });
if (r.status === 0) process.exit(0);

const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(-40).join("\n");
process.stderr.write(
  `Unit tests are failing, so this turn can't end yet. Fix them, or if you are stuck, use the escalate skill.\n${out}\n`,
);
process.exit(2);
