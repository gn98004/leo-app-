/* Supabase Test Panel Loader - non-invasive
 * - Does NOT overwrite body.innerHTML
 * - Adds a small "SB" button (bottom-right) to open/close panel
 * - Loads Supabase UMD SDK only once
 */
(() => {
  const LS_URL = "sb_project_url";
  const LS_KEY = "sb_anon_key";

  const state = {
    sdkReady: false,
    client: null,
    sdkLoading: false,
  };

  function el(id){ return document.getElementById(id); }
  function setStatus(msg){ const box = el("sb_status"); if(box) box.textContent = msg || ""; }
  function safeJson(x){
    try { return typeof x === "string" ? x : JSON.stringify(x, null, 2); }
    catch { return String(x); }
  }

  function ensureSdk() {
    return new Promise((resolve, reject) => {
      if (window.supabase && typeof window.supabase.createClient === "function") {
        state.sdkReady = true;
        return resolve();
      }
      if (state.sdkLoading) {
        const t = setInterval(() => {
          if (window.supabase && typeof window.supabase.createClient === "function") {
            clearInterval(t);
            state.sdkReady = true;
            resolve();
          }
        }, 50);
        setTimeout(() => { clearInterval(t); reject(new Error("Supabase SDK load timeout")); }, 15000);
        return;
      }
      state.sdkLoading = true;
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      s.async = true;
      s.onload = () => { state.sdkReady = true; state.sdkLoading = false; resolve(); };
      s.onerror = () => { state.sdkLoading = false; reject(new Error("Supabase SDK 載入失敗（網路或 CDN 阻擋）")); };
      document.head.appendChild(s);
    });
  }

  function buildClient() {
    const url = (el("sb_url").value || "").trim();
    const key = (el("sb_key").value || "").trim();

    if (!url || !key) throw new Error("請先貼上 Project URL 與 anon public key。");
    if (!/^https:\/\/.+\.supabase\.co\/?$/.test(url)) {
      throw new Error("Project URL 格式看起來不對（應類似 https://xxxx.supabase.co）。");
    }

    localStorage.setItem(LS_URL, url);
    localStorage.setItem(LS_KEY, key);

    state.client = window.supabase.createClient(url.replace(/\/$/, ""), key);
    setStatus("已建立 Supabase client，可註冊 / 登入 / 忘記密碼。\n\n下一步：輸入 Email/Password 後按『登入』或『註冊』。");
    return state.client;
  }

  async function onCreateClient() {
    try {
      setStatus("正在載入 Supabase SDK…");
      await ensureSdk();
      buildClient();
    } catch (e) {
      setStatus("建立 client 失敗：\n" + (e?.message || e));
    }
  }

  function requireClient() {
    if (!state.client) throw new Error("尚未建立 Supabase client。請先按『建立 Client』。");
    return state.client;
  }

  async function signUp() {
    try {
      const client = requireClient();
      const email = (el("sb_email").value || "").trim();
      const password = (el("sb_password").value || "").trim();
      if (!email || !password) throw new Error("請輸入 Email 與密碼。");
      setStatus("註冊中…");
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw error;

      const confirmed = !!(data?.user?.email_confirmed_at);
      setStatus(confirmed
        ? "註冊成功，Email 已確認。你可以直接登入。"
        : "註冊成功。若 Supabase 開啟『Confirm email』，請到信箱點確認信後再登入。\n（你剛剛看到的 Email not confirmed 就是這個原因）");
    } catch (e) {
      setStatus("註冊失敗：\n" + (e?.message || safeJson(e)));
    }
  }

  async function signIn() {
    try {
      const client = requireClient();
      const email = (el("sb_email").value || "").trim();
      const password = (el("sb_password").value || "").trim();
      if (!email || !password) throw new Error("請輸入 Email 與密碼。");
      setStatus("登入中…");
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;

      setStatus("登入成功。\n使用者：" + (data.user?.email || "") + "\nUID：" + (data.user?.id || ""));
      window.dispatchEvent(new CustomEvent("sb:login", { detail: data }));
    } catch (e) {
      setStatus("登入失敗：\n" + (e?.message || safeJson(e)));
    }
  }

  async function signOut() {
    try {
      const client = requireClient();
      setStatus("登出中…");
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setStatus("已登出。\n（若要換帳號，直接輸入新的 Email/Password 再登入即可）");
      window.dispatchEvent(new CustomEvent("sb:logout"));
    } catch (e) {
      setStatus("登出失敗：\n" + (e?.message || safeJson(e)));
    }
  }

  async function whoAmI() {
    try {
      const client = requireClient();
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      setStatus("目前登入使用者：\n" + safeJson({ email: data.user?.email, id: data.user?.id }));
    } catch (e) {
      setStatus("查詢失敗：\n" + (e?.message || safeJson(e)));
    }
  }

  async function resetPassword() {
    try {
      const client = requireClient();
      const email = (el("sb_email").value || "").trim();
      if (!email) throw new Error("請先輸入 Email。");
      setStatus("正在寄送重設密碼信…");
      const redirectTo = location.href.split("#")[0];
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setStatus("已寄出重設密碼信。\n步驟：到信箱點連結 → 會回到此頁 → 輸入新密碼 → 按『更新密碼』。");
    } catch (e) {
      setStatus("寄信失敗：\n" + (e?.message || safeJson(e)));
    }
  }

  async function handleRecoveryFromUrl() {
    try {
      if (!location.hash) return;
      const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
      const type = hash.get("type");
      if (type !== "recovery") return;

      await ensureSdk();
      const savedUrl = localStorage.getItem(LS_URL) || "";
      const savedKey = localStorage.getItem(LS_KEY) || "";
      if (savedUrl && savedKey && !state.client) {
        state.client = window.supabase.createClient(savedUrl.replace(/\/$/, ""), savedKey);
      }

      setStatus("偵測到重設密碼流程：\n請輸入『新密碼』並按『更新密碼』。");
      const area = el("sb_recovery_area");
      if (area) area.style.display = "block";
      openPanel(true);
    } catch (e) {
      setStatus("重設密碼流程初始化失敗：\n" + (e?.message || safeJson(e)));
    }
  }

  async function updatePassword() {
    try {
      const client = requireClient();
      const newPassword = (el("sb_new_password").value || "").trim();
      if (!newPassword) throw new Error("請輸入新密碼。");
      setStatus("更新密碼中…");
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setStatus("密碼已更新。\n你可以用新密碼重新登入。\n（系統會自動清掉網址上的 #recovery 參數）");
      history.replaceState(null, "", location.href.split("#")[0]);
      const area = el("sb_recovery_area");
      if (area) area.style.display = "none";
    } catch (e) {
      setStatus("更新失敗：\n" + (e?.message || safeJson(e)));
    }
  }

  function openPanel(forceOpen=false) {
    const panel = el("sb_panel");
    const mask = el("sb_mask");
    if (!panel || !mask) return;
    const nowOpen = forceOpen ? true : (panel.getAttribute("data-open") !== "1");
    panel.setAttribute("data-open", nowOpen ? "1" : "0");
    mask.style.display = nowOpen ? "block" : "none";
    panel.style.display = nowOpen ? "block" : "none";
  }

  function injectUI() {
    if (el("sb_panel")) return;

    const savedUrl = localStorage.getItem(LS_URL) || "";
    const savedKey = localStorage.getItem(LS_KEY) || "";

    const html = `
<style>
  #sb_fab{position:fixed;right:12px;bottom:12px;z-index:99999;width:44px;height:44px;border-radius:12px;border:0;background:#111827;color:#fff;font-weight:700;box-shadow:0 8px 20px rgba(0,0,0,.25);cursor:pointer;}
  #sb_mask{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.35);display:none;}
  #sb_panel{position:fixed;right:12px;bottom:64px;z-index:99999;width:min(420px,calc(100vw - 24px));max-height:min(80vh,680px);overflow:auto;background:#0b0f19;color:#e5e7eb;border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 12px 30px rgba(0,0,0,.35);display:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft JhengHei",sans-serif;}
  #sb_panel *{box-sizing:border-box;}
  .sb_hd{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 8px;border-bottom:1px solid rgba(255,255,255,.08)}
  .sb_title{font-weight:800}
  .sb_btn{border:1px solid rgba(255,255,255,.16);background:#111827;color:#e5e7eb;border-radius:10px;padding:8px 10px;cursor:pointer}
  .sb_body{padding:12px}
  .sb_label{font-size:12px;opacity:.85;margin:10px 0 6px}
  .sb_in{width:100%;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#0f172a;color:#e5e7eb;outline:none}
  .sb_row{display:flex;gap:10px;margin-top:10px}
  .sb_row .sb_btn{flex:1}
  #sb_status{white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;background:#020617;border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:10px;margin-top:12px;font-size:12px;min-height:56px}
  #sb_recovery_area{display:none;margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,.16)}
</style>

<div id="sb_mask"></div>
<button id="sb_fab" type="button" title="Supabase 面板">SB</button>

<div id="sb_panel" data-open="0" role="dialog" aria-modal="true">
  <div class="sb_hd">
    <div class="sb_title">Supabase 測試面板</div>
    <div style="display:flex;gap:8px;">
      <button class="sb_btn" id="sb_close" type="button">關閉</button>
    </div>
  </div>
  <div class="sb_body">
    <div style="font-size:12px;opacity:.85;line-height:1.5">
      1) 貼上 <b>Project URL</b> 與 <b>anon public key</b> → 2) 按『建立 Client』 → 3) 註冊/登入/忘記密碼。<br/>
      提示：不要用 <b>sb_secret</b> 開頭的 key。
    </div>

    <div class="sb_label">Project URL</div>
    <input id="sb_url" class="sb_in" placeholder="https://xxxx.supabase.co" value="${savedUrl.replace(/"/g,'&quot;')}"/>

    <div class="sb_label">anon public key</div>
    <textarea id="sb_key" class="sb_in" rows="3" placeholder="eyJhbGci...">${savedKey.replace(/</g,'&lt;')}</textarea>

    <div class="sb_row">
      <button class="sb_btn" id="sb_create" type="button">建立 Client</button>
    </div>

    <div class="sb_label">Email</div>
    <input id="sb_email" class="sb_in" placeholder="Email" autocomplete="email"/>

    <div class="sb_label">Password</div>
    <input id="sb_password" class="sb_in" placeholder="Password" type="password" autocomplete="current-password"/>

    <div class="sb_row">
      <button class="sb_btn" id="sb_signup" type="button">註冊</button>
      <button class="sb_btn" id="sb_signin" type="button">登入</button>
    </div>

    <div class="sb_row">
      <button class="sb_btn" id="sb_reset" type="button">忘記密碼</button>
      <button class="sb_btn" id="sb_who" type="button">我現在是誰</button>
    </div>

    <div class="sb_row">
      <button class="sb_btn" id="sb_signout" type="button">登出</button>
    </div>

    <div id="sb_recovery_area">
      <div class="sb_label">新密碼</div>
      <input id="sb_new_password" class="sb_in" type="password" placeholder="New password" autocomplete="new-password"/>
      <div class="sb_row">
        <button class="sb_btn" id="sb_update_pw" type="button">更新密碼</button>
      </div>
    </div>

    <div id="sb_status"></div>
  </div>
</div>
`;

    // IMPORTANT: do not touch existing DOM via innerHTML
    document.body.insertAdjacentHTML("beforeend", html);

    el("sb_fab").addEventListener("click", () => openPanel(false));
    el("sb_close").addEventListener("click", () => openPanel(false));
    el("sb_mask").addEventListener("click", () => openPanel(false));

    el("sb_create").addEventListener("click", onCreateClient);
    el("sb_signup").addEventListener("click", signUp);
    el("sb_signin").addEventListener("click", signIn);
    el("sb_signout").addEventListener("click", signOut);
    el("sb_who").addEventListener("click", whoAmI);
    el("sb_reset").addEventListener("click", resetPassword);
    el("sb_update_pw").addEventListener("click", updatePassword);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectUI, { once: true });
  } else {
    injectUI();
  }

  handleRecoveryFromUrl();
})();
