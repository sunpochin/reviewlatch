<!-- 檔案用途：繁中專案入口；所在層：根目錄；主要關聯：README.md、docs/agent-workflow.md。 -->
# ReviewLatch 審查閂

**讓 AI 寫完的 PR，只在目前這一版確實審過後才合併。**

[English](README.md) · [設定說明](docs/configuration.md) · [AI 工作流程](docs/agent-workflow.md) · [安全邊界](docs/security.md)

ReviewLatch 把實際專案累積的 AI 交付流程抽成小工具：確認審查對應目前版本、列出未結案意見、檢查 CI，最後才有意識地合併。沒有帶出原產品程式、使用者資料或部署設定。

名字來自 **Review + Latch（門閂）**：AI 可以幫你做事，但交付前還需要把關。

## 先跑看看

安裝 Bun 1.4.2 以上版本，以下示範不需要 GitHub 登入，也不用安裝相依套件：

```sh
git clone https://github.com/sunpochin/reviewlatch.git
cd reviewlatch
bun run demo
bun src/cli.ts check --config examples/reviewlatch.json --snapshot examples/stale.json --locale zh
bun run test
```

第一份是假資料的可合併範例；第二份故意使用舊版審查，應該被擋下。結束碼 `0` 表示符合本次檢查、`1` 表示未符合、`2` 表示輸入或 API 出錯。文字輸出支援英文、繁中、印尼文；自動化可用 `--json`。

## 第一版包含什麼

- 可設定的目標分支、必要 CI、可信任審查者與發布分支。
- 人工 approval 或帶有 commit 聲明的 Codex 審查證據。
- PR 狀態摘要與未結案討論清單。
- 預設唯讀的合併預檢；真的合併必須指定完整 head SHA，送出前再查一次。
- GitHub Actions adapter，以及可放進各種 AI 工具的工作流程。

`status` 是完整合併預檢，`gate` 只檢查審查與討論，避免 CI 等待自己的死結。`gate --publish` 才會寫入 GitHub status。工具不會主動叫 bot 重審、不會自動關閉討論，也不會自行決定發布。

## 接到自己的專案

先安裝並登入 GitHub CLI，把 `examples/reviewlatch.json` 複製到可信任的位置，填入實際 reviewer、CI 名稱和分支。範例中的帳號是假的，不能直接拿來審正式 PR。

```sh
bun src/cli.ts status 42 --repo OWNER/REPO --config /trusted/reviewlatch.json --locale zh
bun src/cli.ts merge 42 --repo OWNER/REPO --config /trusted/reviewlatch.json --locale zh
```

第二行仍然只檢查。確認使用者授權後，才加上 `--execute --expect-head 完整40碼SHA`；發布分支另須 `--release`。這個旗標只是宣告已獲授權，不能取代真人授權或 GitHub 權限。

目前只支援 github.com，還沒有發布到 npm。GitHub ruleset 與 branch protection 仍需保留：CLI 無法阻止別人繞過它，也無法把審查、討論、base 分支與合併鎖成同一筆原子操作。

初版以合成資料測試，不會為了驗證工具而合併真實產品 PR。詳細限制見 [安全邊界](docs/security.md)，原始脈絡見 [NOTICE.md](NOTICE.md)。
