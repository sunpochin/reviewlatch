/*
檔案用途：集中三語 CLI 文案；所在層：呈現層；主要關聯：cli.ts、gate.ts。
*/
import type { ReasonCode } from './gate.ts';
export type Locale = 'en' | 'zh' | 'id';
type Text = Record<Locale, string>;
const messages = {
  ready: { en: 'Ready for the requested operation.', zh: '已通過這次操作的檢查。', id: 'Pemeriksaan untuk tindakan ini sudah lulus.' },
  blocked: { en: 'Blocked.', zh: '尚未通過。', id: 'Tindakan tertahan.' },
  dryRun: { en: 'Dry run: nothing was changed. Merging requires --execute and --expect-head <full SHA>.', zh: '僅預覽，沒有修改。合併需加上 --execute 與 --expect-head <完整 SHA>。', id: 'Simulasi saja, tidak ada perubahan. Penggabungan memerlukan --execute dan --expect-head <SHA lengkap>.' },
  merged: { en: 'Merge confirmed.', zh: '已確認合併成功。', id: 'Penggabungan telah dikonfirmasi.' },
  invalid: { en: 'Invalid input', zh: '輸入格式不正確', id: 'Masukan tidak valid' },
  error: { en: 'Operation failed', zh: '操作失敗', id: 'Tindakan gagal' },
  github: { en: 'GitHub could not be read. Check gh authentication, network and repository permissions.', zh: '無法讀取 GitHub。請檢查 gh 登入、網路與 repository 權限。', id: 'GitHub tidak dapat dibaca. Periksa autentikasi gh, jaringan, dan izin repositori.' },
  changed: { en: 'The revision changed during verification. Inspect the PR before trying again.', zh: '驗證期間版本已改變。請先檢查 PR 再重試。', id: 'Revisi berubah selama pemeriksaan. Periksa PR sebelum mencoba lagi.' },
  expectedHead: { en: 'An explicit full head SHA is required to merge.', zh: '合併前必須明確指定完整 head SHA。', id: 'SHA head lengkap harus ditentukan untuk menggabungkan.' },
  publicationUnknown: { en: 'The remote write outcome is unknown. Inspect GitHub before any retry.', zh: '遠端寫入結果不明。重試前請先檢查 GitHub。', id: 'Hasil penulisan jarak jauh belum diketahui. Periksa GitHub sebelum mencoba lagi.' },
  closed: { en: 'The PR is not open.', zh: 'PR 並非開啟狀態。', id: 'PR tidak berstatus terbuka.' },
  draft: { en: 'The PR is a draft.', zh: 'PR 仍是草稿。', id: 'PR masih berupa draf.' },
  base: { en: 'The target branch is not allowed.', zh: '目標分支不在允許清單。', id: 'Cabang tujuan tidak diizinkan.' },
  release: { en: 'This branch requires explicit release authorization (--release).', zh: '此分支需要明確的發布授權（--release）。', id: 'Cabang ini memerlukan izin rilis yang jelas (--release).' },
  mergeable: { en: 'GitHub has not confirmed conflict-free merging.', zh: 'GitHub 尚未確認可無衝突合併。', id: 'GitHub belum memastikan penggabungan tanpa konflik.' },
  mergeState: { en: 'GitHub merge readiness is not CLEAN.', zh: 'GitHub 合併狀態尚未是 CLEAN。', id: 'Status kesiapan penggabungan GitHub belum CLEAN.' },
  checkMissing: { en: 'A required check is missing or came from another app.', zh: '必要檢查缺少，或來自不同的應用程式。', id: 'Pemeriksaan wajib belum ada atau berasal dari aplikasi lain.' },
  checkFailed: { en: 'A required check has not succeeded.', zh: '必要檢查尚未成功。', id: 'Pemeriksaan wajib belum berhasil.' },
  reviewMissing: { en: 'Not enough trusted reviews cover the current head after the last retarget.', zh: '目前版本在最近改目標分支後，尚未獲得足夠的可信審查。', id: 'Revisi saat ini belum mendapat cukup tinjauan tepercaya setelah perubahan cabang tujuan terakhir.' },
  changesRequested: { en: 'A reviewer still requests changes.', zh: '仍有審查者要求修改。', id: 'Masih ada peninjau yang meminta perubahan.' },
  threads: { en: 'Unresolved review threads remain.', zh: '仍有未結案的審查討論。', id: 'Masih ada diskusi tinjauan yang belum selesai.' },
  threadsIncomplete: { en: 'Review thread evidence is incomplete.', zh: '審查討論的證據不完整。', id: 'Bukti diskusi tinjauan belum lengkap.' },
  dependents: { en: 'Other open PRs depend on this branch; handle the stack before merging.', zh: '其他開啟的 PR 依賴此分支，請先處理疊接順序。', id: 'PR terbuka lain bergantung pada cabang ini; atur urutannya sebelum menggabungkan.' },
  help: {
    en: 'ReviewLatch — verify review evidence before delivery.\nCommands: check --snapshot FILE | status N --repo OWNER/REPO | threads N --repo OWNER/REPO | merge N --repo OWNER/REPO | gate N --repo OWNER/REPO\nAll commands require --config FILE. Options: --json, --locale en|zh|id.\nmerge: dry run by default; --execute --expect-head SHA to write; --release only with owner authorization.\ngate: review evidence only; --publish writes a per-PR commit status. It never merges or requests a review.',
    zh: 'ReviewLatch — 交付前確認審查證據。\n指令：check --snapshot FILE | status N --repo OWNER/REPO | threads N --repo OWNER/REPO | merge N --repo OWNER/REPO | gate N --repo OWNER/REPO\n所有指令需要 --config FILE。選項：--json、--locale en|zh|id。\nmerge 預設只預覽；--execute --expect-head SHA 才寫入；--release 僅限擁有者已授權發布。\ngate 只查審查證據；--publish 寫入每張 PR 的 commit status，不會合併或請求審查。',
    id: 'ReviewLatch — periksa bukti tinjauan sebelum penyerahan.\nPerintah: check --snapshot FILE | status N --repo OWNER/REPO | threads N --repo OWNER/REPO | merge N --repo OWNER/REPO | gate N --repo OWNER/REPO\nSemua perintah memerlukan --config FILE. Opsi: --json, --locale en|zh|id.\nmerge hanya simulasi secara bawaan; --execute --expect-head SHA untuk menulis; --release hanya dengan izin pemilik.\ngate hanya memeriksa bukti tinjauan; --publish menulis status commit per PR. Tidak menggabungkan atau meminta tinjauan.',
  },
} satisfies Record<string | ReasonCode, Text>;
export type MessageKey = keyof typeof messages;
export function text(key: MessageKey, locale: Locale): string { return messages[key][locale]; }
export function detectLocale(value = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || ''): Locale {
  return value.startsWith('zh') ? 'zh' : value.startsWith('id') ? 'id' : 'en';
}
