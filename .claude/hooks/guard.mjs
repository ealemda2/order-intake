#!/usr/bin/env node
// PreToolUse guard. Deterministic: CLAUDE.md asks, this enforces.
// Blocks agent writes to the grader, the golden set, the baseline, CI and the agent's own guardrails,
// and blocks the shell commands that are human decisions (accepting a baseline, merging, force-pushing).
// Exit 2 = block; stderr is shown to Claude. Maintenance sessions: start Claude with HARNESS_UNLOCK=1.
import { relative, resolve } from "node:path";

if (process.env.HARNESS_UNLOCK === "1") process.exit(0);

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || "{}");
const tool = input.tool_name ?? "";
const ti = input.tool_input ?? {};
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();

const PROTECTED = [
  [/^evals\//, "evals/ is the grader and golden set (human-owned). Propose the change in an escalation instead."],
  [/^\.github\/workflows\//, "CI workflows are human-owned."],
  [/^\.claude\/(hooks\/|settings\.json$)/, "The agent may not edit its own guardrails."],
  [/(^|\/)\.env(\..*)?$/, "Secrets files are off limits."],
];

const block = (why) => {
  process.stderr.write(`BLOCKED by guard hook: ${why}\nIf this is genuinely needed, stop and use the escalate skill.\n`);
  process.exit(2);
};

if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
  const p = ti.file_path ?? ti.notebook_path;
  if (p) {
    const rel = relative(root, resolve(root, p)).split("\\").join("/");
    if (rel.endsWith(".test.ts") && rel.startsWith("evals/")) block("evals/ tests guard the grader (human-owned).");
    for (const [re, why] of PROTECTED) if (re.test(rel)) block(`${rel}: ${why}`);
  }
}

if (tool === "Bash") {
  const cmd = String(ti.command ?? "");
  const RULES = [
    [/eval:accept|evals\/accept\.ts/, "Accepting a new eval baseline is a human decision."],
    [/gh\s+pr\s+merge/, "Merging is a human decision."],
    [/--remove-label[= ]+["']?needs-human/, "Only a human removes needs-human."],
    [/git\s+push\b.*(--force|-f\b)/, "No force pushes."],
    [/git\s+push\b.*\s(\S+:)?main(\s|$)/, "Never push to main; open a PR."],
    [/--no-verify/, "Do not skip verification."],
    [/(>|>>|\btee\b|\bsed\s+-i|\bmv\b|\bcp\b|\brm\b|\btruncate\b).*\bevals\//, "Writing to evals/ from the shell is blocked (human-owned)."],
    [/(>|>>|\btee\b|\bsed\s+-i|\bmv\b|\bcp\b|\brm\b).*(\.claude\/hooks|\.claude\/settings\.json|\.github\/workflows)/, "Guardrails and CI are human-owned."],
  ];
  for (const [re, why] of RULES) if (re.test(cmd)) block(why);
}

process.exit(0);
