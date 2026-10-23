<!-- 檔案用途：技術閱讀索引；所在層：根目錄；主要關聯：src/、tests/、docs/。 -->
# Technical map

Read only the area you are changing.

| Area | Implementation | Documentation / tests |
| --- | --- | --- |
| Data validation | `src/model.ts`, `src/policy.ts` | [Configuration](docs/configuration.md), `tests/unit/gate.test.ts` |
| Pure decision | `src/gate.ts` | [Security](docs/security.md), `tests/unit/gate.test.ts` |
| Composable library API | `src/readiness.ts`, `src/checks.ts`, `src/index.ts` | [Library integration](docs/library.md), `tests/unit/readiness.test.ts` |
| GitHub collection | `src/github.ts` | [Security](docs/security.md), `tests/unit/github.test.ts` |
| Mutations | `src/delivery.ts` | [Security](docs/security.md), `tests/unit/delivery.test.ts` |
| CLI and language | `src/cli.ts`, `src/i18n.ts` | README, `tests/unit/cli.test.ts` |
| Agent integration | `action.yml`, `examples/review-gate.yml` | [Workflow](docs/agent-workflow.md) |

Run `bun run test` (isolated Bun tests) and `bun run demo`. Build smoke check: `bun build src/cli.ts --target=bun --outfile=/tmp/reviewlatch-cli.js`. No runtime or development dependencies are required for these commands.

The adapter invokes `gh api` with argv arrays, never a shell command. GraphQL connections are paginated separately; REST uses `--paginate --slurp`. Missing evidence is an error. Check runs keep their GitHub App identity; classic statuses have no pinned app identity. Snapshot and policy format versions are currently `1`.

`evaluate` is pure and can replay snapshots. `collectSnapshot` verifies the PR revision before and after evidence collection. `mergePullRequest` obtains two complete snapshots, compares head and base, evaluates again, and uses GitHub's expected-head `sha` parameter for the sole write. It does not delete branches, retry writes, retarget other PRs, or enable auto-merge.
