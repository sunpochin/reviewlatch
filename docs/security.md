<!-- 檔案用途：界定信任來源與保護範圍；所在層：安全文件；主要關聯：github.ts、delivery.ts、action.yml。 -->
# Security model and limitations

ReviewLatch helps a cooperating caller avoid accidental delivery. It is not a sandbox, a GitHub ruleset, or proof of correctness. An actor who bypasses the CLI, edits its policy, controls a trusted reviewer, or uses administrative privileges is outside this boundary.

## Trusted inputs

- The executable and policy must come from a trusted, reviewed revision.
- Reviewer logins must identify people or integrations your team trusts. A bot's commit marker is a freshness signal, not a guarantee of review quality.
- Prefer GitHub App-pinned required checks. A name-only classic status can be created by other actors with status-write access.
- GitHub CLI authentication supplies authority. Read-only commands need access to contents, checks/statuses, and pull requests. Publishing needs commit-status write permission; merge needs the normal repository merge permission. Use the least privilege appropriate to the command.

## Failure behavior

Incomplete API responses, invalid data, missing pagination cursors, unknown merge states, and required checks that did not succeed stop the operation. No missing list is treated as an empty list. `gate --publish` first posts `pending`; a later API failure cannot leave that invocation's previous success intact. Other failures may leave an old status on GitHub, so the guarded merge always collects fresh evidence instead of trusting a ReviewLatch badge.

Each published context includes the PR number to keep PRs with a shared head from overwriting each other. It is informational and does not automatically update after every review, edit, or push. Do not treat it as an always-current authorization or a universal static required check. The supplied Action is intended for deliberate/manual invocation.

Merge defaults to a dry run. Execution requires a full expected head SHA. All evidence is fetched twice, and both snapshots must agree on head, base SHA, and branch names. GitHub receives the expected head SHA. A timeout or unexpected response after the write returns an uncertain outcome and is **never retried automatically**; inspect the PR before doing anything else.

## Remaining race window

GitHub's merge endpoint atomically compares the head SHA, not the full set of review threads, reviewer states, and base SHA. Those can change after the final read. Branch protection, required approvals/checks, conversation resolution, and an up-to-date-branch requirement should enforce your server-side policy. No CLI can promise to lock all this evidence with that endpoint. ReviewLatch does not override server rules or queue auto-merge.

Base-branch retargeting requires a new review. Ordinary movement of the same base branch does not invalidate every existing head review, but changes during collection or between the two merge snapshots stop merging. Configure GitHub's strict/up-to-date requirements if your project requires validation against the latest base.

## Actions boundary

Use a pinned ReviewLatch commit and trusted configuration from the default branch. Never check out or execute an untrusted PR's code in a workflow with a write-capable token, especially `pull_request_target`. The example uses `workflow_dispatch`, not a privileged PR trigger. Tokens must be provided via `GH_TOKEN`; never place credentials in policy, snapshots, argv, or commits. Shell arguments in the action are passed through quoted environment variables.

No tests merge real PRs. Synthetic tests cover policy, pagination, stale evidence, changed revisions, and uncertain writes; authenticated end-to-end merge behavior remains dependent on your GitHub permissions and server rules.

For a sensitive vulnerability, use GitHub's private vulnerability reporting if enabled, or contact the maintainer through the public profile to arrange a private channel. Do not post secrets or private repository data in public issues.
