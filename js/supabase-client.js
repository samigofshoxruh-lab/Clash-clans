// ============================================================
// WAR TABLE — shared Supabase client
// Fill in YOUR project values below. Find them in
// Supabase Dashboard → Project Settings → API
// ============================================================
const SUPABASE_URL = "https://gvsnmgdzctraghdgynxi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c25tZ2R6Y3RyYWdoZGd5bnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxODkxNTksImV4cCI6MjEwMzc2NTE1OX0.avavyIaJ1R9BHgzMihJEGxawTHlfaH4eSTPbr9aITc0";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// safety net: if any page-specific script throws and isn't caught, don't leave
// a spinner stuck forever — show the real error so it can be diagnosed.
window.addEventListener("unhandledrejection", (event) => {
  console.error("[unhandled promise rejection]", event.reason);
  showFatalError(
    "Техническая ошибка: " + (event.reason?.message || String(event.reason))
  );
});

// ---------- session helpers ----------
async function currentSession() {
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (err) {
    console.error("[currentSession] failed:", err);
    return null;
  }
}

async function currentProfile() {
  try {
    const session = await currentSession();
    if (!session) return null;

    // maybeSingle() instead of single(): a missing row returns null cleanly
    // instead of throwing a 406 "not acceptable" error.
    let { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      // self-heal: the auth account exists (e.g. signup succeeded) but the
      // profiles row never got created (interrupted signup, email
      // confirmation pending at the time, etc). Create a default one now
      // instead of leaving the person stuck. Prefer the username they chose
      // at signup time (stashed in localStorage before the email-confirm
      // redirect) over a generic fallback derived from their email.
      let pendingUsername = null;
      try {
        const key = "pendingUsername:" + (session.user.email || "").toLowerCase();
        pendingUsername = localStorage.getItem(key);
        if (pendingUsername) localStorage.removeItem(key);
      } catch (_) {}

      const fallbackUsername =
        pendingUsername ||
        (session.user.email && session.user.email.split("@")[0]) ||
        "Игрок" + session.user.id.slice(0, 4);
      const { data: created, error: createErr } = await sb
        .from("profiles")
        .insert({
          id: session.user.id,
          username: fallbackUsername,
          tag: "#" + session.user.id.slice(0, 6).toUpperCase(),
        })
        .select()
        .single();
      if (createErr) throw createErr;
      data = created;
    }
    return data;
  } catch (err) {
    console.error("[currentProfile] failed:", err);
    return null;
  }
}

// redirect to auth.html if not logged in; returns the profile if logged in
// never hangs: any failure surfaces as an error banner instead of an infinite spinner
async function requireAuth() {
  const session = await currentSession();
  if (!session) {
    window.location.href = "auth.html";
    return null;
  }
  const profile = await currentProfile();
  if (!profile) {
    showFatalError(
      "Не удалось загрузить профиль. Возможно, при регистрации не создалась запись в таблице profiles, либо база недоступна. Открой консоль браузера (F12 → Console) — там будет точная причина."
    );
    return null;
  }
  return profile;
}

// shows a full-page error instead of leaving a spinner stuck forever
function showFatalError(message) {
  const host =
    document.getElementById("loading") ||
    document.getElementById("profile-loading") ||
    document.body;
  host.innerHTML = `
    <div class="empty-state">
      <h3>Что-то пошло не так</h3>
      <p style="max-width:52ch;margin:0 auto;">${escapeHtml(message)}</p>
    </div>`;
  host.style.display = "block";
}

async function signOut() {
  await sb.auth.signOut();
  window.location.href = "index.html";
}

// ---------- small UI helpers shared across pages ----------
function fmtTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function toast(msg, kind = "info") {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `toast toast--${kind}`;
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

function defaultAvatar(seed) {
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(seed || "clan")}`;
}

// generic debounce for search inputs — waits `wait` ms of silence before firing
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// ---------- brand ----------
const BRAND_NAME = "Clash Nexus";
const LOGO_URL = "assets/logo.png";

// ---------- icons (inline SVG, currentColor) ----------
const ICONS = {
  home: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>`,
  shield: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z"/><path d="m9 11 2 2 4-4"/></svg>`,
  chat: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>`,
  settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>`,
  crown: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 20 2-10 5 5 3-8 3 8 5-5 2 10Z"/><path d="M4 20h16"/></svg>`,
  inbox: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>`,
  users: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  search: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
  bell: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  menu: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
  logout: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  user: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  member: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m22 21-3-3m0 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z"/></svg>`,
  globe: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>`,
};

// ---------- render the sidebar + topbar shell into any dashboard-style page ----------
async function mountShell(activePage) {
  const sidebarRoot = document.getElementById("sidebar-root");
  const topbarRoot = document.getElementById("topbar-root");
  if (!sidebarRoot && !topbarRoot) return null;

  const profile = await currentProfile();

  const links = [
    ["dashboard.html", "Главная", ICONS.home],
    ["clans.html", "Кланы", ICONS.shield],
    ["messages.html", "Сообщения", ICONS.chat],
    ["profile.html", "Настройки", ICONS.settings],
  ];

  if (sidebarRoot) {
    const linksHtml = links
      .map(
        ([href, label, icon]) =>
          `<a href="${href}" class="sidebar__link ${activePage === href ? "is-active" : ""}">${icon}<span>${label}</span></a>`
      )
      .join("");
    const adminLink =
      profile && profile.is_site_admin
        ? `<a href="admin.html" class="sidebar__link ${activePage === "admin.html" ? "is-active" : ""}">${ICONS.crown}<span>Совет старейшин</span></a>`
        : "";

    sidebarRoot.innerHTML = `
      <a href="dashboard.html" class="sidebar__brand">
        <img src="${LOGO_URL}" alt="">${BRAND_NAME}
      </a>
      <nav class="sidebar__nav">${linksHtml}${adminLink}</nav>
      <div class="sidebar__spacer"></div>
      <div class="sidebar__cta">
        <h4>Создай свой клан</h4>
        <p>Собери команду и открой набор игроков.</p>
        <a href="clan-create.html" class="btn btn--ember btn--sm btn--block">Создать клан</a>
      </div>`;
  }

  if (topbarRoot) {
    const rightHtml = profile
      ? `
        <div class="dropdown-wrap">
          <button class="icon-btn" id="bell-btn" type="button" aria-label="Уведомления">${ICONS.bell}<span class="dot" id="bell-dot"></span></button>
          <div class="dropdown-panel" id="notif-panel">
            <h4>Уведомления</h4>
            <div id="notif-list"><div class="empty-state">Загрузка…</div></div>
          </div>
        </div>
        <div class="dropdown-wrap">
          <button class="topbar__user" id="user-btn" type="button">
            <img src="${profile.avatar_url || defaultAvatar(profile.username)}" alt="">
            <span>${escapeHtml(profile.display_name || profile.username)}</span>
          </button>
          <div class="user-menu" id="user-menu">
            <a href="profile.html">${ICONS.settings}Настройки</a>
            ${profile.is_site_admin ? `<a href="admin.html">${ICONS.crown}Совет старейшин</a>` : ""}
            <hr>
            <button type="button" id="topbar-signout">${ICONS.logout}Выйти</button>
          </div>
        </div>`
      : `<a href="auth.html" class="btn btn--ember btn--sm">Войти</a>`;

    topbarRoot.innerHTML = `
      <nav class="topbar">
        <button class="icon-btn topbar__menu-btn" id="sidebar-toggle" type="button" aria-label="Меню">${ICONS.menu}</button>
        <form class="topbar__search" id="topbar-search-form">
          ${ICONS.search}
          <input id="topbar-search" placeholder="Поиск кланов…" autocomplete="off">
        </form>
        <div class="topbar__right">${rightHtml}</div>
      </nav>`;

    const bellBtn = document.getElementById("bell-btn");
    const notifPanel = document.getElementById("notif-panel");
    const userBtn = document.getElementById("user-btn");
    const userMenu = document.getElementById("user-menu");

    function closeDropdowns(except) {
      if (notifPanel && except !== notifPanel) notifPanel.classList.remove("is-open");
      if (userMenu && except !== userMenu) userMenu.classList.remove("is-open");
    }

    if (bellBtn) bellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !notifPanel.classList.contains("is-open");
      closeDropdowns();
      notifPanel.classList.toggle("is-open", willOpen);
      if (willOpen) markNotificationsRead();
    });
    if (userBtn) userBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !userMenu.classList.contains("is-open");
      closeDropdowns();
      userMenu.classList.toggle("is-open", willOpen);
    });
    document.addEventListener("click", () => closeDropdowns());

    const signoutBtn = document.getElementById("topbar-signout");
    if (signoutBtn) signoutBtn.addEventListener("click", signOut);

    const searchForm = document.getElementById("topbar-search-form");
    if (searchForm) searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = document.getElementById("topbar-search").value.trim();
      window.location.href = q ? `clans.html?q=${encodeURIComponent(q)}` : "clans.html";
    });

    const toggleBtn = document.getElementById("sidebar-toggle");
    if (toggleBtn && sidebarRoot) toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      sidebarRoot.classList.toggle("is-open");
      document.body.classList.toggle("sidebar-open", sidebarRoot.classList.contains("is-open"));
    });
    document.addEventListener("click", (e) => {
      if (sidebarRoot && sidebarRoot.classList.contains("is-open") && !sidebarRoot.contains(e.target) && e.target !== toggleBtn) {
        sidebarRoot.classList.remove("is-open");
        document.body.classList.remove("sidebar-open");
      }
    });

    if (profile) initNotifications(profile.id);
  }

  return profile;
}

// ---------- notifications ----------
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return Math.floor(diff / 60) + " мин назад";
  if (diff < 86400) return Math.floor(diff / 3600) + " ч назад";
  return Math.floor(diff / 86400) + " дн назад";
}

async function loadNotifications() {
  const { data } = await sb
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  renderNotifications(data || []);
}

function renderNotifications(items) {
  const list = document.getElementById("notif-list");
  const dot = document.getElementById("bell-dot");
  if (!list) return;
  const unread = items.filter((n) => !n.is_read).length;
  if (dot) dot.style.display = unread ? "block" : "none";

  if (!items.length) {
    list.innerHTML = `<div class="empty-state">Пока пусто</div>`;
    return;
  }

  list.innerHTML = items
    .map((n) => {
      const actions =
        n.type === "clan_invite" && n.related_id
          ? `<div class="notif-actions">
              <button class="btn btn--gold btn--sm" data-invite-accept="${n.related_id}">Принять</button>
              <button class="btn btn--ghost btn--sm" data-invite-decline="${n.related_id}">Отклонить</button>
            </div>`
          : "";
      return `
      <a href="${n.link || "#"}" class="notif-item ${n.is_read ? "" : "is-unread"}" data-notif="${n.id}">
        <div class="notif-item__title">${escapeHtml(n.title)}</div>
        ${n.body ? `<div class="notif-item__body">${escapeHtml(n.body)}</div>` : ""}
        <div class="notif-item__time">${timeAgo(n.created_at)}</div>
        ${actions}
      </a>`;
    })
    .join("");

  list.querySelectorAll("[data-invite-accept]").forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { error } = await sb.from("clan_invitations").update({ status: "accepted" }).eq("id", btn.dataset.inviteAccept);
      if (error) { toast(error.message, "error"); return; }
      toast("Приглашение принято — добро пожаловать в клан!");
      loadNotifications();
      setTimeout(() => window.location.reload(), 600);
    })
  );
  list.querySelectorAll("[data-invite-decline]").forEach((btn) =>
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { error } = await sb.from("clan_invitations").update({ status: "declined" }).eq("id", btn.dataset.inviteDecline);
      if (error) { toast(error.message, "error"); return; }
      toast("Приглашение отклонено");
      loadNotifications();
    })
  );
}

async function markNotificationsRead() {
  const { data } = await sb.from("notifications").select("id").eq("is_read", false);
  const ids = (data || []).map((n) => n.id);
  if (!ids.length) return;
  await sb.from("notifications").update({ is_read: true }).in("id", ids);
  const dot = document.getElementById("bell-dot");
  if (dot) dot.style.display = "none";
  document.querySelectorAll(".notif-item.is-unread").forEach((el) => el.classList.remove("is-unread"));
}

function initNotifications(profileId) {
  loadNotifications();
  sb.channel(`notifications-${profileId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${profileId}` }, () => {
      loadNotifications();
    })
    .subscribe();
  // polling fallback in case Realtime replication isn't enabled for this table
  setInterval(loadNotifications, 15000);
}