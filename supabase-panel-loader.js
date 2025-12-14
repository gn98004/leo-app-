(()=>{
  const LS_URL='sb_project_url';
  const LS_KEY='sb_anon_key';
  const LS_MIN='sb_panel_min';

  const ensureSupabaseSDK=()=>new Promise((resolve,reject)=>{
    if (window.supabase && typeof window.supabase.createClient==='function') return resolve();
    const existing=[...document.scripts].find(s=>/supabase(\.min)?\.js/.test(s.src));
    if (existing){
      existing.addEventListener('load',()=>resolve());
      existing.addEventListener('error',()=>reject(new Error('Supabase SDK 載入失敗')));
      // if already loaded but window not set yet, poll briefly
      let t=0; const iv=setInterval(()=>{t+=100; if(window.supabase&&window.supabase.createClient){clearInterval(iv);resolve();} if(t>5000){clearInterval(iv);reject(new Error('Supabase SDK 載入逾時'));}},100);
      return;
    }
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
    s.async=true;
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('Supabase SDK 載入失敗'));
    document.head.appendChild(s);
  });

  const el=(tag,attrs={},children=[])=>{
    const n=document.createElement(tag);
    for(const [k,v] of Object.entries(attrs)){
      if(k==='class') n.className=v;
      else if(k==='style') n.setAttribute('style',v);
      else if(k.startsWith('on') && typeof v==='function') n.addEventListener(k.slice(2),v);
      else n.setAttribute(k,v);
    }
    for(const c of children){
      if(c==null) continue;
      n.appendChild(typeof c==='string'?document.createTextNode(c):c);
    }
    return n;
  };

  const safeJson=(obj)=>{
    try{return JSON.stringify(obj,null,2);}catch{return String(obj);}
  };

  const mount=async()=>{
    // Avoid double-mount
    if(document.getElementById('sb_test_panel_root')) return;

    const root=el('div',{id:'sb_test_panel_root',style:'position:fixed;right:12px;bottom:12px;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Microsoft JhengHei,sans-serif;'});

    const css=el('style',{},[`
      #sb_test_panel_root .sb-card{width:min(420px,calc(100vw - 24px));background:rgba(17,24,39,.92);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:hidden;}
      #sb_test_panel_root .sb-h{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 10px 14px;background:rgba(0,0,0,.18);}
      #sb_test_panel_root .sb-title{font-weight:800;letter-spacing:.3px;}
      #sb_test_panel_root .sb-actions{display:flex;gap:8px;}
      #sb_test_panel_root button{appearance:none;border:0;cursor:pointer;border-radius:12px;padding:10px 12px;font-weight:700;}
      #sb_test_panel_root .sb-btn{background:rgba(255,255,255,.12);color:#fff;}
      #sb_test_panel_root .sb-btn2{background:#e5e7eb;color:#111827;}
      #sb_test_panel_root .sb-body{padding:12px 14px 14px;}
      #sb_test_panel_root .sb-row{display:flex;gap:10px;}
      #sb_test_panel_root .sb-row > *{flex:1;}
      #sb_test_panel_root input{width:100%;box-sizing:border-box;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#fff;padding:12px 12px;outline:none;}
      #sb_test_panel_root input::placeholder{color:rgba(255,255,255,.55);}
      #sb_test_panel_root .sb-help{opacity:.85;font-size:13px;line-height:1.35;margin:8px 0 10px;}
      #sb_test_panel_root .sb-log{margin-top:10px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.10);border-radius:14px;padding:10px;font-size:12px;max-height:170px;overflow:auto;white-space:pre-wrap;}
      #sb_test_panel_root .sb-mini{width:120px;background:rgba(17,24,39,.92);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
      #sb_test_panel_root .sb-mini button{padding:8px 10px;border-radius:999px;}
    `]);

    const state={ client:null };

    const logBox=el('div',{class:'sb-log',id:'sb_log'},['尚未連線。']);
    const log=(msg)=>{ logBox.textContent = (typeof msg==='string')?msg:safeJson(msg); };

    const urlInput=el('input',{id:'sb_url',placeholder:'Project URL（https://xxxx.supabase.co）',autocomplete:'off'});
    const keyInput=el('input',{id:'sb_key',placeholder:'anon public key（很長那串）',autocomplete:'off'});
    urlInput.value=localStorage.getItem(LS_URL)||'';
    keyInput.value=localStorage.getItem(LS_KEY)||'';

    const emailInput=el('input',{id:'sb_email',placeholder:'Email（完整信箱）',autocomplete:'email'});
    const passInput=el('input',{id:'sb_password',placeholder:'Password',type:'password',autocomplete:'current-password'});

    const saveBtn=el('button',{class:'sb-btn2',onclick:()=>{
      const u=urlInput.value.trim();
      const k=keyInput.value.trim();
      localStorage.setItem(LS_URL,u);
      localStorage.setItem(LS_KEY,k);
      log('已儲存 URL / Key。下一步請按「建立 Client」。');
    }},['儲存 URL/Key']);

    const createBtn=el('button',{class:'sb-btn2',onclick:async()=>{
      const u=localStorage.getItem(LS_URL)||urlInput.value.trim();
      const k=localStorage.getItem(LS_KEY)||keyInput.value.trim();
      if(!u || !k){
        log('尚未設定 Project URL / anon key。\n\n做法：到 Supabase 後台 → Project Settings → API → 複製 Project URL 和 anon public key。');
        return;
      }
      try{
        await ensureSupabaseSDK();
        state.client = window.supabase.createClient(u,k);
        log('Client 建立成功。你現在可以：註冊 / 登入 / 忘記密碼。');
      }catch(e){
        log('建立 Client 失敗：\n'+(e?.message||String(e)));
      }
    }},['建立 Client']);

    const requireClient=()=>{
      if(!state.client){
        log('尚未建立 Client。請先按「建立 Client」。');
        return false;
      }
      return true;
    };

    const signUpBtn=el('button',{class:'sb-btn2',onclick:async()=>{
      if(!requireClient()) return;
      const email=emailInput.value.trim();
      const password=passInput.value;
      if(!email || !password){log('請先輸入 Email 與 Password。');return;}
      const {data,error}=await state.client.auth.signUp({email,password});
      if(error){log({ok:false,action:'signUp',error});return;}
      // If email confirmation is on, user may be null and session null
      log({ok:true,action:'signUp',data,tip:'若後台開啟 Confirm email，請到信箱點確認連結後再登入。'});
    }},['註冊']);

    const signInBtn=el('button',{class:'sb-btn2',onclick:async()=>{
      if(!requireClient()) return;
      const email=emailInput.value.trim();
      const password=passInput.value;
      if(!email || !password){log('請先輸入 Email 與 Password。');return;}
      const {data,error}=await state.client.auth.signInWithPassword({email,password});
      if(error){log({ok:false,action:'signIn',error});return;}
      log({ok:true,action:'signIn',user:data.user,session:!!data.session});
      // Hook point for your app
      window.hmAuthUser = data.user;
      window.dispatchEvent(new CustomEvent('hm:auth', {detail:{user:data.user}}));
    }},['登入']);

    const signOutBtn=el('button',{class:'sb-btn2',onclick:async()=>{
      if(!requireClient()) return;
      const {error}=await state.client.auth.signOut();
      if(error){log({ok:false,action:'signOut',error});return;}
      log('已登出。');
      window.hmAuthUser = null;
      window.dispatchEvent(new CustomEvent('hm:auth', {detail:{user:null}}));
    }},['登出']);

    const whoBtn=el('button',{class:'sb-btn2',onclick:async()=>{
      if(!requireClient()) return;
      const {data,error}=await state.client.auth.getUser();
      if(error){log({ok:false,action:'getUser',error});return;}
      log({ok:true,action:'getUser',user:data.user});
    }},['我現在是誰']);

    const resetBtn=el('button',{class:'sb-btn2',onclick:async()=>{
      if(!requireClient()) return;
      const email=emailInput.value.trim();
      if(!email){log('請先輸入 Email（你要收重設信的信箱）。');return;}
      // Use current origin as redirect; user should have a reset handler page in real app
      const redirectTo=location.origin + location.pathname;
      const {data,error}=await state.client.auth.resetPasswordForEmail(email,{redirectTo});
      if(error){log({ok:false,action:'resetPasswordForEmail',error});return;}
      log({ok:true,action:'resetPasswordForEmail',data,tip:'已寄出重設密碼信。到信箱點連結後，回到本頁會帶 token（後續可再做重設 UI）。'});
    }},['忘記密碼']);

    // Panel UI
    const close=()=>{root.remove();};

    const setMin=(v)=>{localStorage.setItem(LS_MIN,v?'1':'0'); render();};

    const fullCard=()=>{
      return el('div',{class:'sb-card',role:'dialog','aria-label':'Supabase 測試面板'},[
        el('div',{class:'sb-h'},[
          el('div',{class:'sb-title'},['Supabase 測試面板（測試用）']),
          el('div',{class:'sb-actions'},[
            el('button',{class:'sb-btn',onclick:()=>setMin(true)},['縮小']),
            el('button',{class:'sb-btn',onclick:close},['關閉'])
          ])
        ]),
        el('div',{class:'sb-body'},[
          el('div',{class:'sb-help'},[
            'Step 1：貼上 Project URL 與 anon public key → 按「儲存」→ 按「建立 Client」。\n',
            '提示：不要用 sb_secret_ 開頭那種 Secret Key。'
          ]),
          urlInput,
          el('div',{style:'height:10px'}),
          keyInput,
          el('div',{style:'height:10px'}),
          el('div',{class:'sb-row'},[saveBtn,createBtn]),
          el('div',{style:'height:14px'}),
          emailInput,
          el('div',{style:'height:10px'}),
          passInput,
          el('div',{style:'height:10px'}),
          el('div',{class:'sb-row'},[signUpBtn,signInBtn]),
          el('div',{style:'height:10px'}),
          el('div',{class:'sb-row'},[signOutBtn,whoBtn]),
          el('div',{style:'height:10px'}),
          resetBtn,
          logBox
        ])
      ]);
    };

    const mini=()=>{
      return el('div',{class:'sb-mini'},[
        el('div',{style:'font-weight:800'},['Supabase']),
        el('button',{class:'sb-btn',onclick:()=>setMin(false)},['展開'])
      ]);
    };

    const render=()=>{
      root.innerHTML='';
      root.appendChild(css);
      const isMin=localStorage.getItem(LS_MIN)==='1';
      root.appendChild(isMin?mini():fullCard());
    };

    render();
    document.body.appendChild(root);

    // Best-effort: load SDK early but do not fail the app
    ensureSupabaseSDK().then(()=>{
      // no auto-create; user presses create
    }).catch(()=>{});
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
  else mount();
})();
