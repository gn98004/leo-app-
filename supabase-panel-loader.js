(() => {
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.js";
  const LS_URL = "SB_URL";
  const LS_KEY = "SB_KEY";

  const css = `
  #sbPanel{position:fixed;right:12px;bottom:12px;z-index:999999;width:min(92vw,420px);
    background:rgba(0,0,0,.88);color:#fff;border-radius:14px;padding:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans TC",sans-serif;}
  #sbPanel h3{margin:0 0 8px 0;font-size:16px;}
  #sbPanel input{width:100%;box-sizing:border-box;margin:6px 0;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#111;color:#fff;font-size:14px;}
  #sbPanel .row{display:flex;gap:8px;margin-top:6px;}
  #sbPanel button{flex:1;padding:10px;border-radius:10px;border:0;font-size:14px;font-weight:700;}
  #sbPanel button.primary{background:#e5e7eb;color:#111;}
  #sbPanel button.ghost{background:#111;color:#fff;border:1px solid rgba(255,255,255,.15);}
  #sbLog{margin-top:8px;background:#000;border-radius:12px;padding:10px;max-height:160px;overflow:auto;white-space:pre-wrap;font-size:12px;line-height:1.3;}
  `;

  function addStyle() {
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  function log(msg) {
    const el = document.getElementById("sbLog");
    if (!el) return;
    el.textContent = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  }

  function ensurePanel() {
    if (document.getElementById("sbPanel")) return;
    const wrap = document.createElement("div");
    wrap.id = "sbPanel";
    wrap.innerHTML = `
      <h3>Supabase 測試面板（之後可刪）</h3>
      <input id="sbUrl" placeholder="Project URL（https://xxxx.supabase.co）" />
      <input id="sbKey" placeholder="anon public key（很長一串）" />
      <div class="row">
        <button id="sbSave" class="ghost" style="flex:1;">儲存 URL/Key</button>
        <button id="sbInit" class="primary" style="flex:1;">建立 Client</button>
      </div>
      <input id="sbEmail" placeholder="Email（一定要完整信箱）" />
      <input id="sbPw" placeholder="Password" type="password" />
      <div class="row">
        <button id="sbSignUp" class="primary">註冊</button>
        <button id="sbSignIn" class="primary">登入</button>
      </div>
      <div class="row">
        <button id="sbSignOut" class="ghost">登出</button>
        <button id="sbWho" class="ghost">目前登入狀態</button>
      </div>
      <div id="sbLog">尚未建立 supabase client（URL/key 未填或 SDK 未載入）</div>
    `;
    document.body.appendChild(wrap);

    // restore saved
    const url = localStorage.getItem(LS_URL) || "";
    const key = localStorage.getItem(LS_KEY) || "";
    wrap.querySelector("#sbUrl").value = url;
    wrap.querySelector("#sbKey").value = key;

    // events
    wrap.querySelector("#sbSave").addEventListener("click", () => {
      const u = wrap.querySelector("#sbUrl").value.trim();
      const k = wrap.querySelector("#sbKey").value.trim();
      localStorage.setItem(LS_URL, u);
      localStorage.setItem(LS_KEY, k);
      log("已儲存 URL/Key（存在手機本機，不會上傳到 GitHub）");
    });
  }

  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (window.supabase?.createClient) return resolve();
      const s = document.createElement("script");
      s.src = SDK_URL;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Supabase SDK 載入失敗"));
      document.head.appendChild(s);
    });
  }

  let client = null;

  async function initClient() {
    const url = (localStorage.getItem(LS_URL) || "").trim();
    const key = (localStorage.getItem(LS_KEY) || "").trim();
    if (!url || !key) {
      log("請先填入 Project URL 與 anon public key，並按「儲存 URL/Key」。");
      return;
    }
    try {
      await loadSdk();
      client = window.supabase.createClient(url, key);
      log("createClient 成功：可以開始註冊/登入了。");
    } catch (e) {
      log("createClient 失敗：請確認 URL/key 是否正確。\n" + (e?.message || e));
    }
  }

  async function signUp() {
    if (!client) return log("尚未建立 supabase client（先按「建立 Client」）");
    const email = document.getElementById("sbEmail").value.trim();
    const password = document.getElementById("sbPw").value;
    log("註冊中…");
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) return log(error);
    log({ ok: true, signUp: data });

    // 若拿得到 user，就順便寫 profiles
    const user = data?.user;
    if (user?.id) {
      const { error: upErr } = await client.from("profiles").upsert({
        id: user.id,
        name: email.split("@")[0],
        region: "其他",
      });
      if (upErr) return log({ profile_upsert_error: upErr });
      log("註冊成功 + profiles 已 upsert");
    } else {
      log("註冊成功（可能需要信箱驗證後才會有 session）");
