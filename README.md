# leo-app-

Patched build: Supabase test panel loader (no hard-coded keys).
# HeartMeet — Supabase 後端化（簽到 / 道具）

## 你要做什麼
這版已把「每日簽到、玫瑰/小禮物庫存、送禮/心情廣場扣款」改成 **Supabase 後端權威**：

- inventories：玫瑰/小禮物餘額
- reward_claims：每日簽到紀錄（防重複領）
- monthly_bonuses：月全勤送 3 玫瑰（只發一次）
- 前端呼叫：
  - `rpc('claim_daily_reward')`
  - `rpc('consume_item')`
  - `rpc('send_gift')`
  - `rpc('get_received_gift_stats')`

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
- 心情廣場發文：發文成功後 → 扣玫瑰 x1

已追加：
- `send_gift` 會扣 sender 的 inventories 並寫入 `gift_transactions`（目前用於『收到禮物』統計；尚未把道具加進收禮者 inventories）。
- 對外資料頁會顯示『累積收到』🌹/🎁 數量，資料來源為 `gift_transactions` 聚合（透過 `get_received_gift_stats` RPC）。


---

## 疑難排除

### A) 簽到出現『Could not choose the best candidate function』
代表你專案中曾建立過 *同名* 的 `claim_daily_reward`（含 default 參數）造成 RPC 選擇困難。

處理方式：
1. 直接重新 Run 最新版 `SUPABASE_BACKEND_SETUP.sql`（已自動 `drop function if exists public.claim_daily_reward(date);`）
2. 或只執行這行：
   - `drop function if exists public.claim_daily_reward(date);`
