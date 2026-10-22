<!-- 檔案用途：政策設定契約；所在層：技術文件；主要關聯：src/policy.ts、examples/reviewlatch.json。 -->
# Configuration

Use [the example](../examples/reviewlatch.json) as a starting point. JSON does not support comments; its field names are the navigation. The ready/stale JSON fixtures are synthetic, not captured from a real project.

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Must be `1`. |
| `baseBranches` | Nonempty allowlist of branches this tool may consider. |
| `releaseBranches` | Subset requiring `--release` for merge readiness; may be empty. |
| `requiredChecks` | Nonempty list of `{ "name": "test", "appId": 15368 }`. Use the actual check name and app ID from your repository. |
| `review.kind` | `approval` for formal GitHub approvals; `codex` for explicitly versioned review evidence. |
| `review.logins` | Trusted GitHub logins, case-insensitive. PR authors cannot count as their own reviewer. |
| `review.minimum` | Number of distinct trusted reviewers, at least one. |
| `mergeMethod` | `merge`, `squash`, or `rebase`; the repository must allow it. |

Unknown policy keys and missing fields are errors. `requiredChecks[].appId` must be an explicit positive integer or `null`. An integer pins the app; `null` intentionally accepts any producer with that name, including classic commit statuses. Prefer pinned apps. Duplicate matching results must all succeed. `reviewlatch/` contexts cannot be configured as required checks inside this policy.

`approval` uses the review's `commit_id`, state, author, and submission time. Ordinary later comments do not revoke an approval. A later dismissal or change request does. Retargeting the PR invalidates all earlier evidence, including retargeting away and back.

`codex` additionally requires `**Reviewed commit:**` followed by a backtick-quoted 7–40 character hexadecimal SHA. Formal reviews must bind that marker to their `commit_id`; standalone comments must resolve the abbreviated SHA through GitHub to the exact full head. Only configured logins count. A version marker proves a review round occurred, not that every finding is correct or fixed: unresolved threads and changes-requested reviews are separate blockers. Reviewers remain responsible for substantive assessment.

Keep policy outside an untrusted PR checkout. A contributor who can replace the policy or the executable can replace the decision. Protect policy changes with CODEOWNERS/review rules appropriate to your team. This toolkit does not install repository rules automatically.

## CLI reference

Every command needs `--config FILE`. Live commands require `NUMBER --repo OWNER/REPO`.

| Command | Reads | Writes |
| --- | --- | --- |
| `check --snapshot FILE` | Offline snapshot | None |
| `status NUMBER` | Complete live snapshot, full merge policy | None |
| `threads NUMBER` | Complete live snapshot, prints unresolved threads | None |
| `gate NUMBER` | Complete live snapshot, review-only decision | Only with `--publish`: pending then success/failure status |
| `merge NUMBER` | Complete live snapshot | Only with `--execute --expect-head SHA`: guarded merge |

`--release` applies to `check`, `status`, and `merge`. It declares that release authorization already exists; it does not obtain or authenticate that authorization. `--locale en|zh|id` changes human output; `--json` returns versioned data. Exit `0`: selected check passed; `1`: blocked; `2`: error or uncertain write outcome. A `gate` success is not the same as full merge readiness.

The JSON output can contain review bodies and repository metadata. Store it with the same access restrictions as the repository; do not paste private snapshots into public issues.
