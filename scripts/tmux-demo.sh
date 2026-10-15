#!/usr/bin/env bash
# Screen-share layout: two agents in two worktrees + a live status pane.
#   bash scripts/tmux-demo.sh <issueA> <issueB>
#
#  +--------------------------+--------------------------+
#  | agent A (worktree A)     | agent B (worktree B)     |
#  |                          +--------------------------+
#  |                          | status: worktrees, PRs,  |
#  |                          | CI runs (refreshes)      |
#  +--------------------------+--------------------------+
set -euo pipefail
A="${1:?usage: tmux-demo.sh <issueA> <issueB>}"
B="${2:?usage: tmux-demo.sh <issueA> <issueB>}"
ROOT="$(git worktree list --porcelain | head -1 | cut -d' ' -f2-)"   # main checkout, even from a worktree
BASE="$(dirname "$ROOT")/$(basename "$ROOT")-wt"
dir() { ls -d "$BASE/$1"-* 2>/dev/null | head -1; }
for i in "$A" "$B"; do [ -n "$(dir "$i")" ] || bash "$ROOT/scripts/wt.sh" "$i"; done
DA="$(dir "$A")"; DB="$(dir "$B")"

SESSION=demo
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -n agents -c "$DA"
tmux set -t "$SESSION" -g mouse on
tmux set -t "$SESSION" pane-border-status top
tmux set -t "$SESSION" pane-border-format " #{pane_title} "
tmux select-pane -t "$SESSION:0.0" -T "A  #$A  $(basename "$DA")"
tmux split-window -h -t "$SESSION:0" -c "$DB"
tmux select-pane -t "$SESSION:0.1" -T "B  #$B  $(basename "$DB")"
tmux split-window -v -t "$SESSION:0.1" -c "$ROOT" -l 35%
tmux select-pane -t "$SESSION:0.2" -T "status"
tmux send-keys -t "$SESSION:0.2" \
  "export GH_PAGER=cat; while true; do clear; git worktree list; echo; gh pr list --limit 5 2>/dev/null; echo; gh run list --limit 5 2>/dev/null; sleep 15; done" C-m
# Agents are typed by you, not auto-started, so the audience sees the prompt go in:
tmux send-keys -t "$SESSION:0.0" "claude" C-m
tmux send-keys -t "$SESSION:0.1" "claude" C-m
tmux select-pane -t "$SESSION:0.0"
exec tmux attach -t "$SESSION"
