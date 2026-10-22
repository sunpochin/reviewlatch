<!-- 檔案用途：記錄來源與授權範圍；所在層：根目錄；主要關聯：LICENSE、src/gate.ts、docs/agent-workflow.md。 -->
# Provenance

ReviewLatch was extracted and generalized from the maintainer's 家健錄 (Jia Jian Log) care-management project, licensed under MIT, copyright 2026 sunpochin.

The source project's `prStatus`, `prMerge`, `prThreads`, and `codexReviewGate` tools informed this implementation: review evidence tied to a commit, unresolved-thread gates, merge preflight, retarget invalidation, and explicit release boundaries. The standalone policy model, GitHub adapter, CLI, fixtures, and action were written for this repository.

This repository begins with a clean history. It does not include application code, database migrations, deployment identifiers, credentials, patient data, or real user fixtures from the source project. The MIT copyright notice is retained in `LICENSE`.

The project is independent of OpenAI, Anthropic, Google, and GitHub. Product names identify optional interoperability; they do not imply endorsement. No code from `pstack-claude` is included.
