// api.js
// HeartMeet 前端資料存取層：所有 Supabase CRUD 都集中在這裡
// 用法：API.getMyProfile(supabaseClient) / API.upsertProfile(supabaseClient, payload)
//
// 注意：supabaseClient 由外部建立（例如 index.html 透過 localStorage 的 SB_URL / SB_ANON_KEY 建立）

window.API = (function () {
  function assertSupabase(supabase) {
    if (!supabase) throw new Error("supabase client not found");
    if (!supabase.auth) throw new Error("supabase.auth not found");
    if (!supabase.from) throw new Error("supabase.from not found");
  }

  async function getUser(supabase) {
    assertSupabase(supabase);
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data?.user || null;
  }

  async function getProfile(supabase, userId) {
    assertSupabase(supabase);
    if (!userId) throw new Error("getProfile: userId is required");

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function upsertProfile(supabase, payload) {
    assertSupabase(supabase);
    if (!payload?.id) throw new Error("upsertProfile: payload.id is required");

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function getMyProfile(supabase) {
    const user = await getUser(supabase);
    if (!user) return { user: null, profile: null };
    const profile = await getProfile(supabase, user.id);
    return { user, profile };
  }

  return {
    getUser,
    getProfile,
    upsertProfile,
    getMyProfile,
  };
})();
