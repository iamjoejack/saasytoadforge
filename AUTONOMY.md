# Forge Autonomy Engine

The plan to make Forge best in class at completing coding tasks, not just at having
a nice IDE. Dated 2026-06-17. Grounded in a research sweep of SWE-bench / Terminal-Bench
state of the art, the published internals of leading harnesses (Claude Code, Cursor,
Devin, OpenHands, Aider, Cline), and a full read of this repo's agent loop.

## Thesis: the harness beats the model

At the frontier, top models cluster within about one point on SWE-bench Verified, but the
same model swings from 42% to 78% on scaffolding alone. One controlled study changed only
the edit-tool interface and moved a model from 6.7% to 68.3%. A weaker, cheaper model on a
better harness beats a flagship model on a worse one.

So Forge does not need to out-train Google. It needs to out-engineer the harness. This
pairs with the flat, bring-your-own-key pricing: the leaders cannot fan out cheap models
to brute-force quality because token markup is their business model (Antigravity reportedly
burned about $916 of credits on one build). BYO-key lets Forge run the same test-time
compute trick on a cheap model at near-zero marginal cost. Pricing and performance
reinforce each other.

One correction up front: best autonomy is not the most agents. Cognition argues against
multi-agents for coding; Anthropic's large multi-agent gain was a research eval, not
coding. The win is a single strong coder loop wrapped in a relentless
execute -> verify -> repair -> select harness, with parallelism only for the genuinely
independent parts.

## Levers, ranked by performance per token

Each lever maps to a concrete integration point in `apps/agent-service`. Status reflects
what is actually built.

| #   | Lever                                                               | Evidence                                                              | Status                                                                                                      | Seam                                                          |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Diff / search-replace edits with a fuzzy applier                    | 26% -> 59%; edit interface alone 6.7% -> 68.3%; ~9x fewer edit errors | DONE                                                                                                        | `agent/apply-edit.ts`, `edit_file` tool in `agent/agentic.ts` |
| 2   | Real execution + per-edit test feedback                             | +54% relative                                                         | DONE (E2B turns on automatically when a key is set; verification at finish via lever 5)                     | `sandbox/index.ts`                                            |
| 3   | Git checkpoint / rollback                                           | reversibility = safe autonomy (the Replit prod-DB lesson)             | DONE (capability: `checkpoint`/`restore` on mock + E2B shadow git; loop-consumer / UI revert still to wire) | `packages/shared/src/sandbox.ts`, providers                   |
| 4   | Stuck detection                                                     | loops are the top production failure                                  | DONE (refuses the third identical call in a row)                                                            | loop body in `agentic.ts`                                     |
| 5   | Ronald as in-loop verifier                                          | ground truth beats self-rating                                        | DONE (verify gate before finish, bounded re-prompt, wired to `reviewWorkspace`)                             | `agentic.ts`, `server.ts`                                     |
| 6   | Codebase grounding (grep)                                           | repo graph +32.8%                                                     | DONE (`search` tool + `searchWorkspace`); repo map / PageRank still to add                                  | `agent/agentic.ts`, `tools.ts`                                |
| 7   | Best-of-N + executable-test selector                                | CodeMonkeys 57.4% vs 69.8% oracle ceiling                             | DONE (`runBestOfN` + `scoreByPassingRun`; opt-in primitive, not on the default path yet)                    | `agent/best-of-n.ts`                                          |
| 8   | Tool-protocol robustness (the practical win of native tool calling) | one bad JSON ends the task today                                      | DONE (forgiving parse + malformed-call re-prompt; full provider-native tool calling still optional)         | `agent/agentic.ts`                                            |
| 9   | Long-horizon context (compaction)                                   | the working transcript blows the context window on long turns         | DONE (`compactMessages` snip tier); LLM-summary + persistent memory still to add                            | `agent/agentic.ts`                                            |

Also shipped: a `delete_file` tool (the agent can remove files, not just create and edit them) and an edit-uniqueness guard (an exact-match edit whose search text appears more than once is refused rather than silently editing the wrong place).

The loop, in one line: ground (repo map + retrieval) -> plan (thin decomposition that
doubles as the acceptance checklist) -> act (diff edits, checkpointed) -> execute and
verify (real tests, typecheck, lint, screenshot for UI) -> repair (grounded reflection,
capped at 2 to 3, spec pinned, oscillation detected) -> select (best-of-N by executable
tests) -> Ronald critic gate (refute on correctness, security, repro). Every action is
reversible; every claim is backed by an environment signal, never the model's self-rating.

## Orchestration shape

- Single-threaded coder core for the actual coupled change, with full trace continuity.
- Fan out only for the embarrassingly parallel parts: read-only context gathering and
  verification. Each subagent runs in its own context and returns a summary, not raw reads.
- Parallelize across truly independent work (separate features or bugs) in isolated git
  worktrees, with an explicit, budgeted merge step. Never split one feature.
- Hard budget caps and termination conditions on everything spawned. Unbounded coordinators
  are the top cause of runaway spend.

## Most logical stack per build

Forge picks the right stack for the task instead of locking to one, which every rival does
(Bolt = JS in WebContainers, v0 = React/Next, Lovable = React + Supabase). This is open
white space.

- A stack-selection step in the plan phase: the agent states the stack and a one-line
  reason; non-devs confirm, pro devs override.
- A real polyglot sandbox underneath. A microVM (E2B) runs anything, which is why making
  real execution the default (lever 2) matters double. The mock cannot do this.
- Scaffold with the ecosystem's own generators (create-next-app, expo init, cargo new)
  rather than hand-written boilerplate.
- A configurable stack registry (task shape -> recommended stack), never a hardcoded
  default.
- Stack-aware deploy targets: static -> Vercel/Netlify, service -> container,
  mobile -> app store via EAS.

Guardrail: support a curated, tested core first (Next.js, React/Vite, Node, Python,
Astro/static, Expo). The microVM makes adding stacks cheap, and the agent must be honest
when a requested stack is not supported yet.

## Two audiences, one engine

The same engine drives both surfaces. Non-devs get chat, live preview, and plain-language
verification artifacts (screenshots, "tests passing" cards) and never see code. Pro devs
get the full IDE, diffs, terminal, and git, and can steer mid-run. Mobile is mission
control, not a code editor: start a task, watch async agents, review artifacts, approve or
steer, get pinged when done. Async long-horizon autonomy is what makes a mobile surface
valuable.

## Measuring it

There is no "best in class" without a scoreboard. The eval harness in `src/eval` is the
home for it. Today it runs the legacy planner against the mock sandbox, so it regression
checks behavior but does not measure the real agentic loop. The next step is to drive
`runAgentic` against a real model and an E2B sandbox over a fixed task suite (a SWE-bench
Verified subset plus internal cases spanning multiple stacks) and track success rate and
cost per task. That number is what turns "little giant" into a fact.

## Build order

- Phase 0, foundation: diff edits (DONE), real execution default (DONE: E2B turns on with a
  key), git checkpointing (DONE: capability), and a real-model eval baseline (wired; the
  number needs a model key + E2B).
- Phase 1, verification loop: in-loop verification before finish (DONE), stuck detection
  (DONE), Ronald as in-loop critic (DONE); grounded reflection capped at 2 to 3 still to add.
- Phase 2, grounding and robustness: grep search (DONE), tool-protocol robustness (DONE);
  repo map and full provider-native tool calling still to add.
- Phase 3, test-time compute: best-of-N selector (DONE as an opt-in primitive); live
  integration and parallel context subagents still to add.
- Phase 4, scale and horizon: working-transcript compaction (DONE); persistent memory and
  parallel independent-work worktrees + merge still to add.
- Surfaces: mobile mission control, non-dev and pro-dev skins.

This is a multi-week program, sequenced by evidence, with every step measurable.
