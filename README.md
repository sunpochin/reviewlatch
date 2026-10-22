<!-- 檔案用途：公開專案入口與快速開始；所在層：根目錄；主要關聯：README.zh-TW.md、TECHNICAL.md、docs/。 -->
# ReviewLatch

**Keep AI-assisted pull requests tied to the revision that was actually reviewed.**

[繁體中文](README.zh-TW.md) · [Configuration](docs/configuration.md) · [Agent workflow](docs/agent-workflow.md) · [Security model](docs/security.md)

ReviewLatch is a small, dependency-free Bun toolkit for the last mile of an AI coding workflow: inspect a PR, verify current review evidence, list unresolved feedback, and deliberately merge the expected commit.

It grew out of a working care-management application, where an old review, a green CI badge, and a completed task were too easy to mistake for permission to ship. The reusable part is the delivery discipline; application data and product rules stay outside this repository.

## Try it in 30 seconds

Requires [Bun](https://bun.sh/) 1.4.2 or newer. No GitHub credentials are needed for the examples.

```sh
git clone https://github.com/sunpochin/reviewlatch.git
cd reviewlatch
bun run demo
bun src/cli.ts check --config examples/reviewlatch.json --snapshot examples/stale.json
bun run test
```

The ready example exits `0`; the stale-review example exits `1`. Invalid input or API failures exit `2`. Add `--json` for machine-readable output, or `--locale en`, `zh`, or `id` for human-readable output. There are no dependencies to install and no npm package has been published.

## What it checks

| Condition | Behavior |
| --- | --- |
| Reviewed revision | A trusted, non-author reviewer must have reviewed the exact current head. Retargeting invalidates earlier reviews. |
| Review feedback | Unresolved threads and outstanding changes-requested reviews block merging. |
| Required CI | Every configured check must succeed; checks can be pinned to a GitHub App ID. Missing, skipped, neutral, or unknown results block. |
| Merge readiness | PR must be open, ready for review, on an allowed base, conflict-free, and reported `CLEAN` by GitHub. |
| Release boundary | Configured release branches require an explicit `--release` declaration of prior authorization. |
| Dependent PRs | Open PRs targeting this PR's branch block merging. No automatic retargeting or branch deletion. |
| Last-minute changes | Merge reads all evidence twice and sends GitHub the expected head SHA. |

This is an additional guard for cooperating agents and humans, not an access-control boundary. Keep GitHub branch protection and rulesets enabled. See [limitations and the remaining race window](docs/security.md).

## Use it with a real PR

Install [GitHub CLI](https://cli.github.com/) and authenticate with the appropriate repository permissions. ReviewLatch currently supports **github.com only**.

Copy `examples/reviewlatch.json` into a trusted policy location and set your allowed base branches, actual check names/App IDs, and trusted reviewer logins. The example reviewer is fictitious and will not match your repository.

```sh
# Substitute your repository and PR number.
bun src/cli.ts status 42 --repo OWNER/REPO --config /trusted/reviewlatch.json
bun src/cli.ts threads 42 --repo OWNER/REPO --config /trusted/reviewlatch.json

# Merge is a read-only dry run by default.
bun src/cli.ts merge 42 --repo OWNER/REPO --config /trusted/reviewlatch.json

# Only after reviewing the result and obtaining authorization:
bun src/cli.ts merge 42 --repo OWNER/REPO --config /trusted/reviewlatch.json \
  --execute --expect-head FULL_40_CHARACTER_HEAD_SHA
```

`gate` checks review freshness and feedback only. It deliberately does not wait for CI or mergeability, so a review status does not depend on itself. `gate --publish` writes a per-PR commit status (`reviewlatch/pr-42`); it never requests another review, resolves a thread, or merges. This changing context is informational, not a single static required check to add to every branch rule.

## GitHub Actions and coding agents

Use the [composite action](action.yml) with a trusted checkout and pinned version; a [manual workflow example](examples/review-gate.yml) is included. Publication is opt-in. Do not run PR-supplied code with a write-capable token.

The [agent workflow](docs/agent-workflow.md) includes a portable instruction block: small tracked task → isolated implementation → focused validation → independent review → verified feedback resolution → fresh evidence → authorized merge. It works as an instruction pattern for Claude, Codex, Gemini, or a human; it does not depend on installing a particular skill or plugin.

## Status

Initial `0.1.0` implementation. Tests use synthetic GitHub responses and offline fixtures, including pagination and merge races. A real authenticated merge is not part of the automated test suite. Read [TECHNICAL.md](TECHNICAL.md) before extending the adapter.

MIT © 2026 sunpochin. See [NOTICE.md](NOTICE.md) for provenance.
