<!-- 檔案用途：本工具的協作不變量；所在層：根目錄；主要關聯：TECHNICAL.md、docs/security.md。 -->
# Contributor instructions

- Read `TECHNICAL.md` and only the relevant detail before changing code.
- Preserve the separation between pure decision, GitHub reads, and explicit writes.
- Fail closed on missing evidence. Never quietly add waivers, auto-merge, review requests, thread resolution, or administrative bypasses.
- Keep policy and executable provenance explicit. Changes to mutation, review trust, credential handling, or Actions permissions need independent review.
- Use fictitious identities and synthetic data in tests. Never copy private project history, operational identifiers, tokens, or captured private snapshots.
- Explain non-obvious reasons with Traditional Chinese comments. Human-maintained files start with purpose/layer/relations navigation; strict JSON and standard license text are exempt.
- User-facing CLI messages must have English, Traditional Chinese, and Indonesian versions in the same change.
- Use `bun run test` and focused regression tests. Do not add dependencies without a concrete need.
- Keep changes isolated in a branch, explain why in commits and PRs, and document actual verification. Do not claim a real merge was tested when only mocks ran.
- GitHub rules remain the server-side authority. Release, publication, or destructive operations require user authorization; never infer production authorization from a successful test.
