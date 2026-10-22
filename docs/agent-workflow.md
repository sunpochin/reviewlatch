<!-- 檔案用途：可跨模型使用的 AI 交付流程；所在層：操作文件；主要關聯：AGENTS.md、README.md、docs/security.md。 -->
# A portable AI delivery workflow

Use this pattern in Claude, Codex, Gemini, or your own agent instructions. Keep the universal rules short; load operational detail only when needed. Product invariants belong to the consuming repository, not this toolkit.

1. **Define the task.** Find or create a trackable issue for work that can be reviewed independently. Describe the problem, scope, acceptance evidence, and release implications.
2. **Isolate the work.** Start from the team's synchronized integration branch in a dedicated branch/worktree. Preserve unrelated changes. Never copy secrets or runtime identities into fixtures.
3. **Implement and explain.** Make the smallest coherent change. Explain non-obvious reasons in code and update the affected documentation.
4. **Validate proportionately.** Run focused tests for the actual risk. Escalate for authorization, data loss, sensitive information, or release boundaries. After two meaningful failed fixes, reassess the cause instead of adding patches blindly.
5. **Review independently.** Open a normal PR and obtain review of the current revision. High-impact changes need an independent reviewer. CI passing is not proof that the review has finished.
6. **Handle feedback deliberately.** Reproduce or verify each relevant finding before fixing it. Resolve a thread only after a fix or demonstrated equivalent behavior is verified. Disagreement needs recorded evidence; unresolved work stays visible. Stop repeated bot-review loops at a team-defined limit and hand the decision to the owner.
7. **Recheck, then deliver.** Use ReviewLatch to fetch current evidence. Merge only with existing authorization and a full expected head SHA. An integration merge does not automatically authorize a production release.

## Copyable instruction block

```text
Before merging, run ReviewLatch status using trusted code and policy.
If blocked or errored, report the specific reason and verify it.
Do not weaken policy, bypass the CLI, resolve unverified discussions,
or request repeated bot reviews merely to obtain a green badge.
After fixes, obtain review evidence for the new head and rerun status.
Only with user authorization, execute merge with the full expected head SHA.
Production delivery is a separate decision. Never infer it from task completion.
```

`--release` records your explicit declaration that permission already exists; it cannot decide whether a user authorized production. Define that rule in your own repository.

## What you still own

ReviewLatch does not choose models, assign reviewers, create issues, repair code, approve migrations, resolve threads, request reviews, or deploy. Those require project context and human judgment. Its role is to make the final evidence check repeatable and inspectable.
