# Forge security model & review log

The hard constraints from the mission (section 6) and where each stands. "Enforced by
construction" means the design makes the unsafe thing impossible, not merely discouraged.

## 6.1 Isolation
Agent- and user-generated code runs ONLY through `SandboxProvider`. The control plane
(web + agent-service) never executes untrusted code.
- The agent reaches the sandbox only via the scoped `ToolSet` (filesystem + terminal bound
  to one sandbox id; browser for screenshots). No host filesystem, no control-plane network,
  no secret-access tools (mission section 10).
- `MockSandboxProvider` refuses to execute arbitrary commands (exit 127); it never shells out
  to the host. Real isolation is E2B microVM / Daytona gVisor (drop-in behind the interface).
- Status: enforced by construction. Real microVM execution pending `E2B_API_KEY`.

## 6.2 Egress
Default-deny per sandbox; allowlist = package registries + the user's declared domains.
- `SandboxProvider.setEgressAllowlist` + `EGRESS_ALLOWLIST` env (`parseEgressAllowlist`).
- Status: interface + config in place. Enforcement + a blocked-egress test land in Phase 4.

## 6.3 Side-effect approvals
Reads, plans, edits, and test runs proceed freely; irreversible side effects require explicit
approval.
- `ApprovalGate` pauses the loop; the UI shows approval cards (approve/reject). The
  "require approval before each file write" toggle gates writes. Diffs have accept/reject
  (reject reverts the file in the sandbox).
- Status: write-approval done. The full side-effect queue (git push, deploy, global installs,
  out-of-allowlist network, deletes, payments) lands in Phase 4.

## 6.4 Secrets
No secret values in the repo, prompts, or logs. Env-only; injected into sandboxes only as
allowlisted vars.
- `.env.example` documents every key, all empty. Secrets are optional at boot (`secretStatus`);
  missing ones degrade to mocks. Third-party keys stay server-side.
- Status: enforced. Structured no-secret logging is formalized in Phase 4.

## 6.5 Spend control
Per-user and global caps enforced before each model call, backed by a Postgres ledger.
- `SPEND_CAP_USER_USD` / `SPEND_CAP_GLOBAL_USD` env in place.
- Status: caps defined. Ledger + pre-call enforcement + a cap test land in Phase 4.

## Review log
- Phase 1 (IDE + sandbox): isolation boundary and path-traversal guard reviewed. PASS.
- Phase 2 (agent loop): edits/tests in-sandbox only; write-approval gate reviewed. PASS.
- Phase 3 (subagents + tools): scoped `ToolSet` confirms no host fs / control-plane net /
  secret tools; browser tool is read-only render; 6.1-6.3 reviewed. PASS.
- Phase 4 will add the egress-block test, the spend-cap test, and the full approval queue.
