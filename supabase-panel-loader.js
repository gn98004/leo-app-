/* Supabase Test Panel Loader (Safe, No hard-coded keys)
   - Stores URL/Key in localStorage (SB_URL, SB_ANON_KEY)
   - Dynamically loads Supabase UMD SDK if missing
   - Provides Signup / Signin / Signout / WhoAmI
*/
(function () {
  'use strict';

  var LS_URL = 'SB_URL';
  var LS_KEY = 'SB_ANON_KEY';
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.js';

  var client = null;

  function $(id) { return document.getElementById(id); }

  function formatSbMsg(msg) {
    try {
      if (msg == null) return '';
      if (typeof msg === 'string') return msg;
      if (msg instanceof Error) return msg.message || String(msg);

      var name = msg.name || '';
      var message = msg.message || msg.msg || '';
      var status = msg.status || msg.statusCode;

      if (name === 'AuthApiError') {
        var m = (message || '').toLowerCase();
        if (m.indexOf('email not confirmed') >= 0) {
          return '尚未完成信箱驗證（Email not confirmed）。

做法：
1) 到 Gmail 找 Supabase 的驗證信，點「Confirm」完成驗證。
2) 或到 Supabase 後台關閉「Confirm email」（僅限測試用）。';
        }
        if (m.indexOf('user already registered') >= 0) {
          return '這個 Email 已經註冊過了。

做法：
- 請直接按「登入」。
- 若忘記密碼，需要加「忘記密碼 / 重設密碼」流程（我可再幫你加）。';
        }
        if (m.indexOf('invalid login credentials') >= 0) {
          return '帳號或密碼不正確（Invalid login credentials）。

確認：
- Email/密碼是否打錯
- 你登入的是同一個 Supabase Project';
        }
      }

      if (status === 429 || (message || '').toLowerCase().indexOf('rate limit') >= 0) {
        return '操作太頻繁（Rate limit）。請稍後 30 秒再試一次。';
      }

      if (message) return message + (status ? ('
(status: ' + status + ')') : '');
      return JSON.stringify(msg, null, 2);
    } catch (e) {
      return String(msg);
    }
  }

  function log(msg) {
    try {
      var el = $('sb_log');
      if (!el) return;
      el.textContent = formatSbMsg(msg);
    } catch (e) { /* ignore */ }
  }


  function ensureStyle() {
    if (document.getElementById('sb_style')) return;
    var style = document.createElement('style');
    style.id = 'sb_style';
    style.textContent = [
      '#sb_panel{position:fixed;right:12px;bottom:12px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft JhengHei",sans-serif;max-width:94vw;width:360px;background:#0b0b0b;color:#fff;border-radius:14px;box-shadow:0 12px 35px rgba(0,0,0,.35);overflow:hidden;}',
      '#sb_panel *{box-sizing:border-box;}',
      '#sb_panel .hd{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,.06);}',
      '#sb_panel .hd .t{font-weight:800;font-size:14px;}',
      '#sb_panel .hd .btns{display:flex;gap:6px;}',
      '#sb_panel button{border:0;border-radius:10px;padding:10px 10px;font-weight:700;cursor:pointer;}',
      '#sb_panel button:disabled{opacity:.5;cursor:not-allowed;}',
      '#sb_panel .bd{padding:10px 12px;display:flex;flex-direction:column;gap:8px;}',
      '#sb_panel input,#sb_panel textarea{width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;font-size:14px;outline:none;}',
      '#sb_panel textarea{min-height:70px;resize:vertical;}',
      '#sb_panel .row{display:flex;gap:8px;}',
      '#sb_panel .row > *{flex:1;}',
      '#sb_panel .mini{position:fixed;right:12px;bottom:12px;z-index:999999;display:none;background:#0b0b0b;color:#fff;border-radius:999px;padding:10px 12px;font-weight:800;box-shadow:0 12px 35px rgba(0,0,0,.35);}',
      '#sb_panel pre{margin:0;padding:10px;border-radius:10px;background:rgba(255,255,255,.06);max-height:180px;overflow:auto;font-size:12px;white-space:pre-wrap;word-break:break-word;}',
      '#sb_hint{font-size:12px;opacity:.9;line-height:1.35;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if (document.getElementById('sb_panel')) return;

    var panel = document.createElement('div');
    panel.id = 'sb_panel';
    panel.innerHTML = ''
      + '<div class="hd">'
      + '  <div class="t">Supabase 測試面板（之後可刪）</div>'
      + '  <div class="btns">'
      + '    <button id="sb_min" type="button">縮小</button>'
      + '    <button id="sb_close" type="button">關閉</button>'
      + '  </div>'
      + '</div>'
      + '<div class="bd">'
      + '  <div id="sb_hint">Step 1：貼上 <b>Project URL</b> 與 <b>anon public key</b> → 按「儲存」→ 按「建立 Client」→ 再註冊/登入。<br>（提示：不要用 <code>sb_secret_</code> 那種 Secret Key）</div>'
      + '  <input id="sb_url" placeholder="Project URL（例：https://xxxx.supabase.co）" />'
      + '  <textarea id="sb_key" placeholder="anon public key（很長一串）"></textarea>'
      + '  <div class="row">'
      + '    <button id="sb_save" type="button">儲存 URL/Key</button>'
      + '    <button id="sb_init" type="button">建立 Client</button>'
      + '  </div>'
      + '  <hr style="border:none;border-top:1px solid rgba(255,255,255,.10);margin:4px 0;">'
      + '  <input id="sb_email" placeholder="Email（完整信箱）" />'
      + '  <input id="sb_password" type="password" placeholder="Password" />'
      + '  <div class="row">'
      + '    <button id="sb_signup" type="button">註冊</button>'
      + '    <button id="sb_signin" type="button">登入</button>'
      + '  </div>'
      + '  <div class="row">'
      + '    <button id="sb_forgot" type="button">忘記密碼</button>'
      + '    <button id="sb_setpw" type="button">設定新密碼</button>'
      + '  </div>'
      + '  <div id="sb_reset_box" style="display:none; margin-top:8px;">'
      + '    <input id="sb_new_password" placeholder="新密碼（至少 6 碼）" type="password" autocomplete="new-password" />'
      + '    <input id="sb_new_password2" placeholder="再輸入一次新密碼" type="password" autocomplete="new-password" />'
      + '  </div>'
      + '  <div class="row">'
      + '    <button id="sb_signout" type="button">登出</button>'
      + '    <button id="sb_whoami" type="button">我現在是誰</button>'
      + '  </div>'
      + '  <pre id="sb_log">尚未建立 supabase client（URL/key 未填或 SDK 未載入）</pre>'
      + '</div>';

    document.body.appendChild(panel);

    var mini = document.createElement('button');
    mini.id = 'sb_mini';
    mini.className = 'mini';
    mini.type = 'button';
    mini.textContent = 'Supabase';
    document.body.appendChild(mini);

    $('sb_min').addEventListener('click', function () {
      panel.style.display = 'none';
      mini.style.display = 'block';
    });
    mini.addEventListener('click', function () {
      mini.style.display = 'none';
      panel.style.display = 'block';
    });
    $('sb_close').addEventListener('click', function () {
      panel.remove();
      mini.remove();
    });

    // Restore saved URL/KEY
    var savedUrl = localStorage.getItem(LS_URL) || '';
    var savedKey = localStorage.getItem(LS_KEY) || '';
    $('sb_url').value = savedUrl;
    $('sb_key').value = savedKey;

    $('sb_save').addEventListener('click', function () {
      var url = ($('sb_url').value || '').trim();
      var key = ($('sb_key').value || '').trim();
      if (!url || !key) return log('請先填入 Project URL 與 anon public key，再按儲存。');
      localStorage.setItem(LS_URL, url);
      localStorage.setItem(LS_KEY, key);
      log('已儲存 URL/Key（存在本機瀏覽器 localStorage）。接著按「建立 Client」。');
    });

    $('sb_init').addEventListener('click', function () { initClient(); });

    $('sb_signup').addEventListener('click', function () { signUp(); });
    $('sb_signin').addEventListener('click', function () { signIn(); });
    $('sb_forgot').addEventListener('click', function () { forgotPassword(); });
    $('sb_setpw').addEventListener('click', function () { setNewPassword(); });
    $('sb_signout').addEventListener('click', function () { signOut(); });
    $('sb_whoami').addEventListener('click', function () { whoAmI(); });

    setButtonsEnabled(false);
  }

  function setButtonsEnabled(enabled) {
    var ids = ['sb_signup','sb_signin','sb_forgot','sb_setpw','sb_signout','sb_whoami'];
    ids.forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = !enabled;
    });
  }

  function loadSdk() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      // avoid duplicate script
      if (document.getElementById('sb_sdk')) {
        // wait a bit
        var t0 = Date.now();
        var timer = setInterval(function () {
          if (window.supabase && window.supabase.createClient) { clearInterval(timer); resolve(); }
          if (Date.now() - t0 > 15000) { clearInterval(timer); reject(new Error('Supabase SDK 載入逾時')); }
        }, 200);
        return;
      }
      var s = document.createElement('script');
      s.id = 'sb_sdk';
      s.src = SDK_URL;
      s.async = true;
      s.onload = function () {
        if (window.supabase && window.supabase.createClient) resolve();
        else reject(new Error('Supabase SDK 載入後仍未找到 createClient'));
      };
      s.onerror = function () { reject(new Error('Supabase SDK 載入失敗（CDN 無法連線或被阻擋）')); };
      document.head.appendChild(s);
    });
  }

  function validateUrl(url) {
    try { new URL(url); return true; } catch (e) { return false; }
  }

  function initClient() {
    var url = (localStorage.getItem(LS_URL) || '').trim();
    var key = (localStorage.getItem(LS_KEY) || '').trim();
    if (!url || !key) return log('尚未儲存 URL/Key。請先貼上並按「儲存 URL/Key」。');
    if (!validateUrl(url)) return log('Project URL 格式不正確，應該像：https://xxxx.supabase.co');

    if (key.indexOf('sb_secret_') === 0) {
      log('你貼到的是 sb_secret_（Secret Key）。請回 Supabase → Project Settings → API 找「anon public key」。');
      return;
    }

    log('載入 Supabase SDK…');
    loadSdk().then(function () {
      log('SDK 已載入，建立 supabase client…');
      try {
        client = window.supabase.createClient(url, key, {
          // 為了支援「忘記密碼／重設密碼」流程，需要讓 SDK 可以從網址 hash 讀取 recovery token。
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        setButtonsEnabled(true);
        log('supabase client 已建立。現在可以按「註冊/登入」。');
      } catch (e) {
        client = null;
        setButtonsEnabled(false);
        log('createClient 失敗：\n' + (e && e.message ? e.message : String(e)));
      }
    }).catch(function (e) {
      client = null;
      setButtonsEnabled(false);
      log(String(e && e.message ? e.message : e));
    });
  }

  function getEmailPw() {
    var email = ($('sb_email').value || '').trim();
    var password = $('sb_password').value || '';
    return { email: email, password: password };
  }

  function signUp() {
    if (!client) return log('尚未建立 supabase client（先按「建立 Client」）。');
    var v = getEmailPw();
    if (!v.email || !v.password) return log('請輸入 Email 與 Password。');
    log('註冊中…');
    client.auth.signUp({ email: v.email, password: v.password }).then(function (res) {
      if (res.error) return log(res.error);
      // If email confirmation is required, session may be null
      if (res.data && res.data.session == null) {
        log('註冊成功。\n\n如果你開啟了「Confirm email」，請到信箱點驗證信後再登入。\n（測試用也可在 Supabase 後台把 Confirm email 關掉）');
      } else {
        log({ ok: true, signUp: res.data });
      }
    }).catch(function (e) { log('註冊流程出錯：\n' + e); });
  }

  function signIn() {
    if (!client) return log('尚未建立 supabase client（先按「建立 Client」）。');
    var v = getEmailPw();
    if (!v.email || !v.password) return log('請輸入 Email 與 Password。');
    log('登入中…');
    client.auth.signInWithPassword({ email: v.email, password: v.password }).then(function (res) {
      if (res.error) return log(res.error);
      log({ ok: true, signIn: res.data });
    }).catch(function (e) { log('登入流程出錯：\n' + e); });
  }

  // 忘記密碼：寄出重設密碼信（Email 會包含連結）
  function forgotPassword() {
    if (!client) {
      log('尚未建立 supabase client（先按「建立 Client」）。');
      return;
    }
    var email = ($('sb_email').value || '').trim();
    if (!email) {
      log('請先在 Email 欄位輸入「完整信箱」，再按「忘記密碼」。');
      return;
    }

    var redirectTo = location.origin + location.pathname;
    log('已送出重設密碼請求：請到信箱收信並點連結。');

    // v2 SDK：resetPasswordForEmail
    client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo })
      .then(function (res) {
        if (res && res.error) {
          log('寄送失敗：' + (res.error.message || JSON.stringify(res.error)));
        } else {
          log('重設密碼信已寄出。開啟 Email 內的連結後，回到這個頁面再按「設定新密碼」。');
        }
      })
      .catch(function (e) {
        log('寄送失敗：' + e);
      });
  }

  // 重設密碼：點 Email 的連結回到此頁後，設定新密碼
  function setNewPassword() {
    if (!client) {
      log('尚未建立 supabase client（先按「建立 Client」）。');
      return;
    }

    // Supabase recovery 連結通常會帶 #access_token=...&type=recovery
    var hash = location.hash || '';
    if (hash.indexOf('type=recovery') === -1) {
      log('尚未進入重設流程：請先按「忘記密碼」寄信，並點信件連結回到此頁。');
      return;
    }

    var newPw = prompt('輸入新密碼（建議 8 碼以上）');
    if (!newPw) return;
    var newPw2 = prompt('再次輸入新密碼');
    if (newPw !== newPw2) {
      log('兩次密碼不一致，請重試。');
      return;
    }

    log('更新新密碼中...');
    client.auth.updateUser({ password: newPw })
      .then(function (res) {
        if (res && res.error) {
          log('更新失敗：' + (res.error.message || JSON.stringify(res.error)));
        } else {
          log('新密碼設定完成。你現在可以用新密碼登入。');
          // 清掉 URL hash（避免每次重整都卡在 recovery）
          try { history.replaceState(null, document.title, location.pathname + location.search); } catch (_) {}
        }
      })
      .catch(function (e) {
        log('更新失敗：' + e);
      });
  }

  function signOut() {
    if (!client) return log('尚未建立 supabase client（先按「建立 Client」）。');
    log('登出中…');
    client.auth.signOut().then(function (res) {
      if (res.error) return log(res.error);
      log('已登出');
    }).catch(function (e) { log('登出流程出錯：\n' + e); });
  }

  function whoAmI() {
    if (!client) return log('尚未建立 supabase client（先按「建立 Client」）。');
    Promise.all([client.auth.getUser(), client.auth.getSession()]).then(function (arr) {
      var userRes = arr[0], sessRes = arr[1];
      var u = (userRes.data && userRes.data.user) ? userRes.data.user : null;
      if (userRes.error) return log(userRes.error);
      if (!u) return log('目前未登入');
      log('目前登入：' + (u.email || '(no email)') + '\nuser_id: ' + (u.id || '') + '\n最後登入：' + (u.last_sign_in_at || ''));
      
    }).catch(function (e) { log('讀取狀態出錯：\n' + e); });
  }

  function boot() {
    ensureStyle();
    ensurePanel();
    // auto init if url/key exist
    if ((localStorage.getItem(LS_URL) || '').trim() && (localStorage.getItem(LS_KEY) || '').trim()) {
      // don't auto-init immediately; wait for DOM painted
      setTimeout(function () { initClient(); }, 50);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
