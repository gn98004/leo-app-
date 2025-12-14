/* Supabase Test Panel (safe loader) - email/password auth + reset password
   This file is for demo/testing on GitHub Pages. It stores URL/key in localStorage.
*/
(function () {
  const LS_URL = "hm_sb_url";
  const LS_KEY = "hm_sb_key";

  function el(id) { return document.getElementById(id); }
  function setText(id, msg) { const e = el(id); if (e) e.textContent = msg || ""; }
  function safeJson(v) { try { return typeof v === "string" ? v : JSON.stringify(v, null, 2); } catch { return String(v); } }

  // Inject minimal styles (namespaced)
  const style = document.createElement("style");
  style.textContent = `
  .sbp-wrap{position:fixed;right:12px;bottom:12px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","Microsoft JhengHei",sans-serif}
  .sbp-card{width:min(360px,calc(100vw - 24px));background:#0b0b0ccc;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:14px;box-shadow:0 18px 45px rgba(0,0,0,.45);backdrop-filter: blur(10px);overflow:hidden}
  .sbp-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.10)}
  .sbp-title{font-weight:700;font-size:14px}
  .sbp-actions{display:flex;gap:8px}
  .sbp-btn{appearance:none;border:0;border-radius:10px;padding:8px 10px;background:rgba(255,255,255,.12);color:#fff;font-weight:700;font-size:12px}
  .sbp-btn.primary{background:#ffffff;color:#111}
  .sbp-body{padding:12px;display:flex;flex-direction:column;gap:10px}
  .sbp-row{display:flex;gap:8px}
  .sbp-input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.35);color:#fff;font-size:14px;outline:none}
  .sbp-small{font-size:12px;opacity:.85;line-height:1.45}
  .sbp-log{white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px;max-height:180px;overflow:auto}
  .sbp-hide{display:none !important}
  `;
  document.head.appendChild(style);

  // Build panel
  const wrap = document.createElement("div");
  wrap.className = "sbp-wrap";
  wrap.innerHTML = `
    <div class="sbp-card" id="sbp-card">
      <div class="sbp-head">
        <div class="sbp-title">Supabase 測試面板（之後可刪）</div>
        <div class="sbp-actions">
          <button class="sbp-btn" id="sbp-min">縮小</button>
          <button class="sbp-btn primary" id="sbp-close">關閉</button>
        </div>
      </div>
      <div class="sbp-body" id="sbp-body">
        <div class="sbp-small">
          Step 1：貼上 <b>Project URL</b> 與 <b>anon public key</b> → 按「儲存」→ 按「建立 Client」→ 再註冊/登入。<br>
          提示：請使用 <b>anon public</b>（不是 <code>sb_secret</code>）。
        </div>

        <input class="sbp-input" id="sbp-url" placeholder="Project URL（https://xxxx.supabase.co）">
        <textarea class="sbp-input" id="sbp-key" rows="3" placeholder="anon public key（很長一串 JWT）"></textarea>

        <div class="sbp-row">
          <button class="sbp-btn primary" id="sbp-save" style="flex:1;">儲存 URL/Key</button>
          <button class="sbp-btn primary" id="sbp-create" style="flex:1;">建立 Client</button>
        </div>

        <hr style="width:100%;border:0;border-top:1px solid rgba(255,255,255,.10);margin:2px 0;">

        <input class="sbp-input" id="sbp-email" placeholder="Email（完整信箱）" autocomplete="email">
        <input class="sbp-input" id="sbp-pass" type="password" placeholder="Password（至少 6 碼）" autocomplete="current-password">

        <div class="sbp-row">
          <button class="sbp-btn primary" id="sbp-signup" style="flex:1;">註冊</button>
          <button class="sbp-btn primary" id="sbp-signin" style="flex:1;">登入</button>
        </div>

        <div class="sbp-row">
          <button class="sbp-btn" id="sbp-forgot" style="flex:1;">忘記密碼</button>
          <button class="sbp-btn" id="sbp-signout" style="flex:1;">登出</button>
        </div>

        <div class="sbp-row">
          <button class="sbp-btn" id="sbp-who" style="flex:1;">我現在是誰</button>
          <button class="sbp-btn" id="sbp-clear" style="flex:1;">清除 URL/Key</button>
        </div>

        <div id="sbp-recovery" class="sbp-hide">
          <hr style="width:100%;border:0;border-top:1px solid rgba(255,255,255,.10);margin:2px 0;">
          <div class="sbp-small"><b>重設密碼模式</b>：請輸入新密碼並更新。</div>
          <input class="sbp-input" id="sbp-newpass" type="password" placeholder="新密碼（至少 6 碼）">
          <button class="sbp-btn primary" id="sbp-updatepass">更新密碼</button>
        </div>

        <div class="sbp-log" id="sbp-log">尚未建立 supabase client（URL/key 未填或 SDK 未載入）</div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const card = el("sbp-card");
  const body = el("sbp-body");
  el("sbp-min").addEventListener("click", () => {
    body.classList.toggle("sbp-hide");
    el("sbp-min").textContent = body.classList.contains("sbp-hide") ? "展開" : "縮小";
  });
  el("sbp-close").addEventListener("click", () => { card.classList.add("sbp-hide"); });

  function log(msg) { setText("sbp-log", typeof msg === "string" ? msg : safeJson(msg)); }

  // Load stored creds
  const savedUrl = localStorage.getItem(LS_URL) || "";
  const savedKey = localStorage.getItem(LS_KEY) || "";
  el("sbp-url").value = savedUrl;
  el("sbp-key").value = savedKey;

  // Load Supabase SDK (UMD)
  function loadSdk() {
    return new Promise((resolve) => {
      if (window.supabase && window.supabase.createClient) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  let client = null;

  function isValidUrl(u) {
    try { new URL(u); return true; } catch { return false; }
  }

  async function createClientFromInputs() {
    await loadSdk();
    const url = (el("sbp-url").value || "").trim();
    const key = (el("sbp-key").value || "").trim();
    if (!isValidUrl(url) || !key) {
      log("建立 Client 失敗：請確認 Project URL / anon public key 已正確貼上。");
      return null;
    }
    try {
      client = window.supabase.createClient(url, key);
      log("Supabase Client 已建立。你可以註冊/登入了。");
      // expose
      window.__HM_SUPABASE__ = client;
      return client;
    } catch (e) {
      log("建立 Client 失敗：" + (e?.message || e));
      client = null;
      return null;
    }
  }

  // Recovery handling (when user clicks reset-password link)
  async function tryHandleRecovery() {
    if (!client) return;

    const url = new URL(window.location.href);
    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hash);
    const queryParams = url.searchParams;

    const type = hashParams.get("type") || queryParams.get("type");
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");
    const code = queryParams.get("code");

    try {
      if (code) {
        // PKCE flow
        await client.auth.exchangeCodeForSession(code);
        el("sbp-recovery").classList.remove("sbp-hide");
        log("已進入重設密碼模式（PKCE）。請輸入新密碼並按「更新密碼」。");
        return;
      }

      if (type === "recovery" && access_token && refresh_token) {
        await client.auth.setSession({ access_token, refresh_token });
        el("sbp-recovery").classList.remove("sbp-hide");
        log("已進入重設密碼模式。請輸入新密碼並按「更新密碼」。");
        return;
      }
    } catch (e) {
      log("重設密碼連結處理失敗：" + (e?.message || e));
    }
  }

  // Expose friendly API for the app
  window.HMAuth = {
    isReady: () => !!client,
    getClient: () => client,
    async signUp(email, password) {
      if (!client) return { ok: false, message: "尚未建立 Supabase Client。" };
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) return { ok: false, message: error.message, error };
      // If email confirmation required, session might be null
      if (!data.session) {
        return { ok: true, message: "註冊成功。請到信箱點擊確認後再登入（或先在 Supabase 關閉 Confirm email）。", data };
      }
      return { ok: true, message: "註冊成功，已登入。", data };
    },
    async signIn(email, password) {
      if (!client) return { ok: false, message: "尚未建立 Supabase Client。" };
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, message: error.message, error };
      return { ok: true, message: "登入成功。", data };
    },
    async signOut() {
      if (!client) return { ok: false, message: "尚未建立 Supabase Client。" };
      const { error } = await client.auth.signOut();
      if (error) return { ok: false, message: error.message, error };
      return { ok: true, message: "已登出。" };
    },
    async getUser() {
      if (!client) return { ok: false, message: "尚未建立 Supabase Client。" };
      const { data, error } = await client.auth.getUser();
      if (error) return { ok: false, message: error.message, error };
      return { ok: true, data };
    },
    async resetPassword(email) {
      if (!client) return { ok: false, message: "尚未建立 Supabase Client。" };
      // redirect back to this page so we can show the recovery UI
      const redirectTo = window.location.origin + window.location.pathname;
      const { data, error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return { ok: false, message: error.message, error };
      return { ok: true, message: "已寄出重設密碼信。", data };
    },
    async updatePassword(newPassword) {
      if (!client) return { ok: false, message: "尚未建立 Supabase Client。" };
      const { data, error } = await client.auth.updateUser({ password: newPassword });
      if (error) return { ok: false, message: error.message, error };
      return { ok: true, message: "密碼已更新。", data };
    }
  };

  // Wire UI actions
  el("sbp-save").addEventListener("click", () => {
    const url = (el("sbp-url").value || "").trim();
    const key = (el("sbp-key").value || "").trim();
    localStorage.setItem(LS_URL, url);
    localStorage.setItem(LS_KEY, key);
    log("已儲存 URL/Key（存在本機瀏覽器）。接著請按「建立 Client」。");
  });

  el("sbp-clear").addEventListener("click", () => {
    localStorage.removeItem(LS_URL);
    localStorage.removeItem(LS_KEY);
    el("sbp-url").value = "";
    el("sbp-key").value = "";
    client = null;
    log("已清除 URL/Key。");
  });

  el("sbp-create").addEventListener("click", async () => {
    await createClientFromInputs();
    await tryHandleRecovery();
  });

  el("sbp-signup").addEventListener("click", async () => {
    const email = (el("sbp-email").value || "").trim();
    const password = (el("sbp-pass").value || "").trim();
    if (!email || !password) return log("請輸入 Email 與 Password。");
    const r = await window.HMAuth.signUp(email, password);
    log(r.ok ? r.message : { ok:false, error: r.message });
  });

  el("sbp-signin").addEventListener("click", async () => {
    const email = (el("sbp-email").value || "").trim();
    const password = (el("sbp-pass").value || "").trim();
    if (!email || !password) return log("請輸入 Email 與 Password。");
    const r = await window.HMAuth.signIn(email, password);
    log(r.ok ? r.data : { ok:false, error: r.message });
  });

  el("sbp-forgot").addEventListener("click", async () => {
    const email = (el("sbp-email").value || "").trim();
    if (!email) return log("請先輸入 Email（完整信箱）。");
    const r = await window.HMAuth.resetPassword(email);
    log(r.ok ? r.message : { ok:false, error: r.message });
  });

  el("sbp-signout").addEventListener("click", async () => {
    const r = await window.HMAuth.signOut();
    log(r.ok ? r.message : { ok:false, error: r.message });
  });

  el("sbp-who").addEventListener("click", async () => {
    const r = await window.HMAuth.getUser();
    log(r.ok ? r.data : { ok:false, error: r.message });
  });

  el("sbp-updatepass").addEventListener("click", async () => {
    const np = (el("sbp-newpass").value || "").trim();
    if (!np || np.length < 6) return log("新密碼至少 6 碼。");
    const r = await window.HMAuth.updatePassword(np);
    log(r.ok ? "密碼已更新。你現在可以用新密碼登入。" : { ok:false, error: r.message });
  });

  // Auto-load SDK + auto-create client if URL/key already saved
  (async () => {
    const ok = await loadSdk();
    if (!ok) return log("Supabase SDK 載入失敗（請確認網路可連 jsdelivr）。");
    if (savedUrl && savedKey && isValidUrl(savedUrl)) {
      try {
        client = window.supabase.createClient(savedUrl, savedKey);
        window.__HM_SUPABASE__ = client;
        log("Supabase Client 已自動建立（已讀取你先前儲存的 URL/Key）。");
        await tryHandleRecovery();
      } catch (e) {
        log("自動建立 Client 失敗：" + (e?.message || e));
      }
    } else {
      log("尚未建立 supabase client（URL/key 未填或 SDK 未載入）");
    }
  })();
})();
