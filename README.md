# Linko Android-ready

這份是以你原始 `index.html` 為底整理出的 **功能保留版 + Android 可包裝結構**。

## 保留的重點功能
- 巧遇 / 人們頁
- 相簿與鎖圖解鎖
- VIP60 區塊
- 心情日記廣場
- 玫瑰 / 小禮物 / 送禮入口
- 好友限定小語 / 日記
- 聊天 / 排行榜 / 我的頁
- 封鎖 / 檢舉 / Daily reward / Supabase scaffold

## 這次補上的缺口
- 18+ 年齡確認
- 安全中心入口
- 服務條款 / 隱私政策 / 帳號刪除說明頁
- 更清楚的儲值 / VIP 入口
- PWA manifest / app icon
- Capacitor 結構，方便包 Android

## 本機預覽
直接開啟 `www/index.html` 即可。

## 包 Android
```bash
npm install
npx cap add android
npm run copy
npm run android
```

## 上架前仍要做
- Google Play Billing：VIP60 訂閱、玫瑰 / 禮物商品
- 正式 release keystore 與 AAB
- 正式隱私政策內容與客服聯絡方式
- 正式後端表與 RPC 驗證


## 新增：Billing / Supabase 規劃檔

這包已補上可直接交給工程師實作的規劃：

- `docs/google-play-billing-plan.md`
- `docs/supabase-plan.md`
- `docs/android-billing-supabase-integration.md`
- `supabase/migrations/20260421_linko_schema.sql`
- `www/docs/supabase-client-example.js`

### 建議實作順序
1. 先在 Google Play Console 建立商品
2. 在 Supabase 套用 migration
3. 前端把發文 / 回覆 / 送花 / 解鎖 / 購買改成呼叫 RPC
4. 再做 Google Play Developer API 驗證與 RTDN webhook
