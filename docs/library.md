<!-- 檔案用途：說明純函式整合與相容政策；所在層：公開 API 文件；主要關聯：src/index.ts、readiness.ts、checks.ts。 -->
# Composable library API

Pin an immutable repository commit when importing or vendoring ReviewLatch. The package is source TypeScript for Bun, with no dependencies or installation scripts. The entry point exports only pure code; importing it does not read credentials, call GitHub, publish statuses or merge.

`evaluate(snapshot, policy)` remains the complete strict decision API. Smaller functions help existing tools reuse mechanics while retaining their own review, release and mutation policies:

| Export | Contract |
| --- | --- |
| `reviewedCommit(body)` | Extract a 7–40 character hexadecimal reviewed-commit marker; caller must verify author, timestamp and commit identity. |
| `inspectPrState(facts, policy)` | Check open/draft/base and, in merge mode, mergeability. Defaults allow only `MERGEABLE` and `CLEAN`; unknown states block. |
| `inspectThreads(unresolved, complete)` | Report remaining threads and incomplete/invalid counts. Only literal boolean `true` confirms completeness. Does not fetch evidence. |
| `checkOutcome(rollup, options)` | Distinguish pass/fail/pending/skipped. Neutral is failure unless `neutralIsSuccess: true` is explicit. Unknown rollup types fail. |
| `latestChecksByName(checks)` | Compare parsed timestamps chronologically, last input wins equal instants, `null` sorts earliest. An unparseable timestamp throws `RangeError('invalid-check-timestamp')`; callers must stop instead of substituting empty evidence. Does not validate issuer or required checks. |

For a compatibility migration, `inspectPrState` accepts an explicit `{ allow: [...] }` or `{ deny: [...] }` rule for `mergeable` and `mergeState`. Each rule must contain exactly one list of strings; ambiguous or malformed rules block. Deny lists preserve legacy behavior but accept unknown future states: prefer allow lists for new integrations. `purpose: 'review'` deliberately omits mergeability checks. These options do not alter `evaluate`, its required-check semantics, or the CLI. Boolean compatibility options require literal `true`; truthy strings or numbers never grant an exception.

The primitives are **not a complete merge gate**. The caller must keep current-review evidence, required CI, issuer checks, release authorization, complete pagination, revision rechecks and expected-head mutation binding. Do not invent approvals or replace missing evidence with empty arrays to use the full evaluator. A name-only rollup must not let a same-named check run impersonate a trusted commit status.

Vendored integrations should retain the upstream license and provenance, record version and exact commit, copy upstream files without local edits, and verify their hashes. Upgrades should replace the pinned snapshot through review and rerun behavior-parity fixtures.
