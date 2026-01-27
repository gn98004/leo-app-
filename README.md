# HeartMeet — Supabase 後端化（簽到 / 道具）.

## 你要做什麼
這版已把「每日簽到、玫瑰/小禮物庫存、送禮/心情廣場扣款」改成 **Supabase 後端權威**：

- inventories：玫瑰/小禮物餘額
- reward_claims：每日簽到紀錄（防重複領）
- monthly_bonuses：月全勤送 3 玫瑰（只發一次）
- 簽到規則：單數日 🌹 x1；雙數日 🎁 x2（第 1 天也算單數日）
- 登入規則：每日登入送 🎁 x1（claim_login_gift 防重複）
- 前端呼叫：
  - `rpc('claim_daily_reward')`
  - `rpc('consume_item')`
  - `rpc('send_gift')`
  - `rpc('get_received_gift_stats')`
  - `rpc('claim_login_gift')`（每日登入送 🎁 x1）
  - `rpc('create_post_with_limit')`（心情發文：每日最多 3 篇，且每篇扣 🌹 x1）
  - `rpc('create_reply_with_limit')`（心情回覆：每日免費 3 則，第 4 則起每則扣 🎁 x1）

> 注意：這份 demo 仍是單檔前端，主要目標是把「會被玩家鑽漏洞的 LocalStorage」搬去後端。

---

## 建置步驟（一次做完）
1. Supabase 專案 → SQL Editor
2. 建立新 Query，貼上 `SUPABASE_BACKEND_SETUP.sql` 全部內容
3. Run

---

## 前端使用方式
1. 打開 `index.html`（或 GitHub Pages）
2. 在右下 Supabase 面板填入 `SUPABASE_URL` / `ANON_KEY`
3. 用 Email/Password 註冊/登入
4. 完成基本資料後：
   - 會自動彈出簽到視窗（同一天只自動彈一次）
   - 你也可以在「我的」按「每日簽到」手動開啟

---

## 遷移（從舊版 LocalStorage）
若你先前在同一台裝置用舊版領過道具，前端會嘗試一次性呼叫：
- `rpc('migrate_inventory', {p_roses, p_gifts})`

搬移完成後會在本機打上 `hmRewardMigrated::<uid>=1`，避免重複搬移。

---

## 目前已後端化的消耗點
- 送禮彈窗：按下送出 → 後端扣款 + 寫入 gift_transactions（可做『收到禮物』統計）
- 心情廣場發文：後端 `create_post_with_limit` 直接做到「每日最多 3 篇」+「每篇扣 🌹 x1」（同一筆交易，避免被繞過）
- 心情廣場回覆：後端 `create_reply_with_limit` 做到「每日免費 3 則；第 4 則起每則扣 🎁 x1」

已追加：
- `send_gift` 會扣 sender 的 inventories 並寫入 `gift_transactions`（目前用於『收到禮物』統計；尚未把道具加進收禮者 inventories）。
- 對外資料頁會顯示『累積收到』🌹/🎁 數量，資料來源為 `gift_transactions` 聚合（透過 `get_received_gift_stats` RPC）。


---

## 升級說明（V12）
若你已經跑過舊版 SQL，不想整份重跑：
- 直接在 Supabase SQL Editor 執行 `SUPABASE_V12_PATCH.sql`

## 疑難排除

### A) 簽到出現『Could not choose the best candidate function』
代表你專案中曾建立過 *同名* 的 `claim_daily_reward`（含 default 參數）造成 RPC 選擇困難。

處理方式：
1. 直接重新 Run 最新版 `SUPABASE_BACKEND_SETUP.sql`（已自動 `drop function if exists public.claim_daily_reward(date);`）
2. 或只執行這行：
   - `drop function if exists public.claim_daily_reward(date);`

---

## 營利架構預留（Ads + VIP IAP）

這版已先把「未來要接廣告與 VIP 訂閱」需要的 **資料表/RPC** 預先鋪好（但尚未整合 AdMob SDK 與 Apple/Google IAP SDK）。

### 你要執行的 SQL
在 Supabase → SQL Editor 另外跑一次：
- `SUPABASE_MONETIZATION_SETUP.sql`

### 會新增的內容
- `app_config_public`：前端可讀的公開設定（ad unit id、產品 id、album 解鎖分鐘數…等）
- `user_entitlements`：VIP 權益（tier/到期、是否免廣告、每日配額…）
- `feature_unlocks`：功能解鎖到期（目前先用於 `album_unlock`）
- `billing_transactions`：未來 IAP 驗證/補單/退款的流水（預留）
- `ad_reward_events`：未來 rewarded ads 回呼的流水（預留）

### 前端已接好的管線（最小改動）
- 登入後會嘗試：
  - `rpc('get_monetization_state')` 拉取 entitlements/unlocks/config（若你尚未跑 SQL，前端會自動降級，不影響現有功能）
  - `rpc('apply_vip_daily_roses')`（可選；若沒有 VIP 或 quota=0，會直接回 0）
- 相簿解鎖：
  - 後續接 rewarded ad 時，只要在「看完廣告獲得獎勵」回呼呼叫 `rpc('grant_album_unlock')` 即可（本 demo 仍保留原本的假廣告流程）。

> 重點：收款帳戶不在程式內填寫，而是在 App Store Connect / Google Play Console / AdMob 後台完成合約、稅務、銀行資料後由平台結算。

---

## VIP60（月費 NT$60）

本版已把 VIP 從「多等級 Demo」調整為單一訂閱方案 **VIP60**：

- 相簿免廣告全解鎖（不需觀看 20 分鐘廣告解鎖）
- 每日登入後自動補發 **🌹 玫瑰 x3**（不累積）

### 後端補丁（必跑）

請在你已經跑完 `SUPABASE_MONETIZATION_SETUP.sql` 之後，再跑一次：

- `SUPABASE_VIP60_PATCH_v14.sql`

### Web Demo 測試方式（可選）

若你要在 GitHub Pages 上測試 VIP 行為：

1. 到 Supabase `public.app_config_public` 將 `dev_vip_grant_enabled` 設為 `true`（env=prod, platform=web）。
2. 重新整理頁面，在「我的」相簿區會出現「測試開通 30 天 / 測試取消」。
3. 或者在網址後加 `?devvip=1` 也會顯示測試按鈕（但後端仍需 `dev_vip_grant_enabled=true` 才能成功呼叫 RPC）。

> 注意：測試按鈕僅用於開發驗證，正式上架會改為 Apple/Google 內購訂閱驗證後，透過 Edge Function / Server 端呼叫 `grant_vip_from_iap()` 來寫入 `user_entitlements`。
