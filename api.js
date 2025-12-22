/* api.js - HeartMeet Frontend API Layer
   目的：
   1) 集中管理 Supabase 連線 / Auth / profiles CRUD
   2) 後續你要串自建後端 API（Cloud Run / VPS / Edge Functions）時，只改這裡即可
   使用：
   - index.html 先載入本檔： <script src="./api.js"></script>
   - 透過 window.HM_API 呼叫
*/

(function (global) {
  "use strict";

  var HM_API = {};
  var SB_URL_KEY = "SB_URL";
  var SB_ANON_KEY = "SB_ANON_KEY";

  // 你目前專案的預設 URL（可被 localStorage 覆蓋）
  var DEFAULT_SB_URL = "https://eqtvoxcavjgronfmalfw.supabase.co";
  // 建議你之後把 anon key 也填進來（或繼續用測試面板寫入 localStorage）
  var DEFAULT_SB_ANON_KEY = "";

  // UMD SDK（與你原本版本一致）
  var SUPABASE_SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.js";

  var _supabaseClient = null;
  var _sdkLoading = null;

  function _getStorage(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return (v && String(v).trim()) ? String(v).trim() : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function _setStorage(key, value) {
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch (e) {}
  }

  function _ensureSupabaseSdk() {
    if (global.supabase && global.supabase.createClient) return Promise.resolve(true);
    if (_sdkLoading) return _sdkLoading;

    _sdkLoading = new Promise(function (resolve, reject) {
      var exist = document.getElementById("hm_supabase_sdk");
      if (exist) {
        var t0 = Date.now();
        var timer = setInterval(function () {
          if (global.supabase && global.supabase.createClient) {
            clearInterval(timer);
            resolve(true);
          }
          if (Date.now() - t0 > 15000) {
            clearInterval(timer);
            reject(new Error("Supabase SDK 載入逾時"));
          }
        }, 200);
        return;
      }

      var s = document.createElement("script");
      s.id = "hm_supabase_sdk";
      s.src = SUPABASE_SDK_URL;
      s.async = true;
      s.onload = function () {
        if (global.supabase && global.supabase.createClient) resolve(true);
        else reject(new Error("Supabase SDK 載入失敗（createClient 不存在）"));
      };
      s.onerror = function () {
        reject(new Error("Supabase SDK 載入失敗（network error）"));
      };
      document.head.appendChild(s);
    });

    return _sdkLoading;
  }

  async function getSupabaseClient() {
    if (_supabaseClient) return _supabaseClient;

    // 補上預設值（若 localStorage 尚未存過）
    if (!_getStorage(SB_URL_KEY, "" ) && DEFAULT_SB_URL) _setStorage(SB_URL_KEY, DEFAULT_SB_URL);
    if (!_getStorage(SB_ANON_KEY, "" ) && DEFAULT_SB_ANON_KEY) _setStorage(SB_ANON_KEY, DEFAULT_SB_ANON_KEY);

    var url = _getStorage(SB_URL_KEY, DEFAULT_SB_URL);
    var key = _getStorage(SB_ANON_KEY, DEFAULT_SB_ANON_KEY);

    if (!url || !key) return null;

    await _ensureSupabaseSdk();
    _supabaseClient = global.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    return _supabaseClient;
  }

  // -----------------------------
  // Auth
  // -----------------------------
  HM_API.auth = {
    async getSession() {
      var cli = await getSupabaseClient();
      if (!cli) return { ok: false, skipped: true, reason: "缺少 SB_URL / SB_ANON_KEY" };
      var res = await cli.auth.getSession();
      return { ok: true, data: res.data, error: res.error || null };
    },

    async signUp(email, password) {
      var cli = await getSupabaseClient();
      if (!cli) return { ok: false, skipped: true, reason: "缺少 SB_URL / SB_ANON_KEY" };
      var res = await cli.auth.signUp({ email: email, password: password });
      return { ok: !res.error, data: res.data || null, error: res.error || null };
    },

    async signInWithPassword(email, password) {
      var cli = await getSupabaseClient();
      if (!cli) return { ok: false, skipped: true, reason: "缺少 SB_URL / SB_ANON_KEY" };
      var res = await cli.auth.signInWithPassword({ email: email, password: password });
      return { ok: !res.error, data: res.data || null, error: res.error || null };
    },

    async signOut() {
      var cli = await getSupabaseClient();
      if (!cli) return { ok: false, skipped: true, reason: "缺少 SB_URL / SB_ANON_KEY" };
      var res = await cli.auth.signOut();
      return { ok: !res.error, error: res.error || null };
    },

    async onAuthStateChange(handler) {
      var cli = await getSupabaseClient();
      if (!cli) return { ok: false, skipped: true, reason: "缺少 SB_URL / SB_ANON_KEY" };
      var sub = cli.auth.onAuthStateChange(function (event, session) {
        try { handler(event, session); } catch (e) {}
      });
      return { ok: true, data: sub };
    }
  };

  // -----------------------------
  // Profiles (public.profiles)
  // -----------------------------
  HM_API.profiles = {
    async upsert(profile) {
      var cli = await getSupabaseClient();
      if (!cli) return { ok: false, skipped: true, reason: "缺少 SB_URL / SB_ANON_KEY" };

      var s = await cli.auth.getSession();
      var user = s && s.data && s.data.session && s.data.session.user;
      if (!user || !user.id) return { ok: false, skipped: true, reason: "尚未登入（無 session）" };

      // --- 欄位標準化（避免 UI key 與 DB 欄位不一致）---
      // profiles 表目前使用：id, name, region, height, weight, avatar_url, status, updated_at
      var src = profile || {};

      // name：允許多種 key，最後都寫入 DB 的 name
      var name =
        (src.name != null && String(src.name).trim() !== "" ? String(src.name).trim() : null) ||
        (src.display_name != null && String(src.display_name).trim() !== "" ? String(src.display_name).trim() : null) ||
        (src.displayName != null && String(src.displayName).trim() !== "" ? String(src.displayName).trim() : null);

      // 允許字串數字；空字串視為 null
      function toIntOrNull(v) {
        if (v == null) return null;
        var t = String(v).trim();
        if (!t) return null;
        var n = Number(t);
        return Number.isFinite(n) ? Math.trunc(n) : null;
      }

      var payload = {
        id: user.id,
        name: name,
        region: src.region != null ? String(src.region).trim() : null,
        height: toIntOrNull(src.height),
        weight: toIntOrNull(src.weight),
        avatar_url: src.avatar_url || src.avatarUrl || null,
        status: src.status || null,
        updated_at: new Date().toISOString()
      };

      // socials：
      // 你目前的 public.profiles 可能「還沒有 socials 欄位」。
      // 為了兼容：若傳入 socials，我們會先嘗試寫入；若回報欄位不存在，會自動重試（移除 socials）。
      var tryWithSocials = null;
      if (src.socials && typeof src.socials === "object") {
        tryWithSocials = src.socials;
      }

      // 清掉 undefined，避免 PostgREST 誤判型別
      Object.keys(payload).forEach(function (k) {
        if (payload[k] === undefined) delete payload[k];
      });

      async function doUpsert(p) {
        return await cli.from("profiles").upsert(p, { onConflict: "id" }).select().single();
      }

      var firstPayload = payload;
      if (tryWithSocials) {
        // clone to avoid mutating base payload
        firstPayload = Object.assign({}, payload, { socials: tryWithSocials });
      }

      var res = await doUpsert(firstPayload);
      if (res.error && tryWithSocials) {
        var msg = String(res.error.message || res.error.details || res.error.hint || res.error);
        // 常見訊息："Could not find the 'socials' column of 'profiles' in the schema cache" 或 "column \"socials\" does not exist"
        var looksLikeMissingColumn = msg.includes("socials") && (msg.includes("schema") || msg.includes("cache") || msg.includes("does not exist") || msg.includes("Could not find"));
        if (looksLikeMissingColumn) {
          // 退回只寫 profiles 既有欄位（確保 name/region/height/weight 能寫入）
          res = await doUpsert(payload);
        }
      }

      if (res.error) return { ok: false, error: res.error };
      return { ok: true, data: res.data };
    },

    async fetchMine() {
      var cli = await getSupabaseClient();
      if (!cli) return { ok: false, skipped: true, reason: "缺少 SB_URL / SB_ANON_KEY" };

      var s = await cli.auth.getSession();
      var user = s && s.data && s.data.session && s.data.session.user;
      if (!user || !user.id) return { ok: false, skipped: true, reason: "尚未登入（無 session）" };

      var res = await cli.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (res.error) return { ok: false, error: res.error };
      return { ok: true, data: res.data || null };
    }
  };

  // -----------------------------
  // Generic REST helper (for your future server API)
  // -----------------------------
  var _baseUrl = ""; // 例如：https://api.heartmeet.tw
  HM_API.setBaseUrl = function (baseUrl) { _baseUrl = String(baseUrl || "").replace(/\/+$/, ""); };

  HM_API.request = async function (path, options) {
    options = options || {};
    var url = path;
    if (_baseUrl && !/^https?:\/\//i.test(path)) url = _baseUrl + (path.startsWith("/") ? path : ("/" + path));

    var headers = options.headers || {};
    if (!headers["Content-Type"] && options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    var fetchOpts = {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? (headers["Content-Type"] === "application/json" && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body) : undefined
    };

    var resp = await fetch(url, fetchOpts);
    var text = await resp.text();
    var data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

    if (!resp.ok) return { ok: false, status: resp.status, data: data };
    return { ok: true, status: resp.status, data: data };
  };

  
// -----------------------------
// Config (SB_URL / SB_ANON_KEY)
// -----------------------------
HM_API.config = {
  get: function () {
    return {
      url: _getStorage(SB_URL_KEY, DEFAULT_SB_URL || ""),
      anonKey: _getStorage(SB_ANON_KEY, DEFAULT_SB_ANON_KEY || ""),
      hasUrl: !!_getStorage(SB_URL_KEY, DEFAULT_SB_URL || ""),
      hasAnonKey: !!_getStorage(SB_ANON_KEY, DEFAULT_SB_ANON_KEY || "")
    };
  },
  set: function (cfg) {
    cfg = cfg || {};
    if (typeof cfg.url === "string") _setStorage(SB_URL_KEY, cfg.url.trim());
    if (typeof cfg.anonKey === "string") _setStorage(SB_ANON_KEY, cfg.anonKey.trim());
    // 重新初始化 client
    _supabaseClient = null;
    return this.get();
  },
  clear: function () {
    _setStorage(SB_URL_KEY, null);
    _setStorage(SB_ANON_KEY, null);
    _supabaseClient = null;
    return this.get();
  }
};

// Export
  global.HM_API = HM_API;

})(window);
