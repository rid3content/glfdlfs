// ============================================================
//  Главный файл приложения
// ============================================================
import { auth, onAuthStateChanged, serverTimestamp } from "./firebase-config.js";
import { registerWithEmail, loginWithEmail, loginWithGoogle, logout } from "./auth.js";
import {
  SOLID_COLORS, EMOJIS,
  fileToBase64Resized, saveProfile, updateProfileFields, getProfile,
  renderBgPicker, renderEmojiPicker, renderEmojiSendPanel,
  emojiById, emojiImgHTML, pingOnline, isOnline, lastSeenText
} from "./profile.js";
import {
  ensureDirectChat, createGroupChat, listenMyChats, searchUsers,
  sendMessage, listenMessages, getOtherMembersProfiles, getDirectChatId
} from "./chat.js";

const appEl = document.getElementById("app");

// ---------- Ссылки на экраны ----------
const screens = {
  auth: document.getElementById("authScreen"),
  setup: document.getElementById("profileSetupScreen"),
  main: document.getElementById("mainScreen")
};
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ---------- AUTH SCREEN ----------
document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach((f) => f.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab + "Form").classList.add("active");
    document.getElementById("authError").textContent = "";
  });
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const { error } = await loginWithEmail(email, password);
  if (error) document.getElementById("authError").textContent = error;
});

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const { error } = await registerWithEmail(email, password);
  if (error) document.getElementById("authError").textContent = error;
});

document.getElementById("googleLoginBtn").addEventListener("click", async () => {
  const { error } = await loginWithGoogle();
  if (error) document.getElementById("authError").textContent = error;
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  unsubscribeMessages();
  unsubscribeChats();
  clearInterval(onlineInterval);
  await logout();
});

// ---------- PROFILE SETUP SCREEN ----------
let pendingAvatarBase64 = null;
let setupSelectedBg = SOLID_COLORS[0];
let setupSelectedEmoji = EMOJIS[0].id;

renderBgPicker(document.getElementById("bgPickerSetup"), setupSelectedBg, (v) => (setupSelectedBg = v));
renderEmojiPicker(document.getElementById("emojiPickerSetup"), setupSelectedEmoji, (v) => (setupSelectedEmoji = v));

document.getElementById("avatarInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pendingAvatarBase64 = await fileToBase64Resized(file);
  const preview = document.getElementById("avatarPreview");
  preview.style.background = `url(${pendingAvatarBase64}) center/cover`;
  document.getElementById("avatarInitial").style.display = "none";
});

document.getElementById("saveProfileBtn").addEventListener("click", async () => {
  const name = document.getElementById("setupName").value.trim();
  const username = document.getElementById("setupUsername").value.trim().replace(/^@/, "");
  const bio = document.getElementById("setupBio").value.trim();
  const errEl = document.getElementById("setupError");

  if (!name || !username) {
    errEl.textContent = "Заполните имя и юзернейм.";
    return;
  }
  const user = auth.currentUser;
  if (!user) return;

  await saveProfile(user.uid, {
    name, username, bio,
    photoBase64: pendingAvatarBase64 || null,
    bgColor: setupSelectedBg,
    emojiStatus: setupSelectedEmoji,
    createdAt: serverTimestamp(),
    lastActive: Date.now()
  });

  await enterMainApp(user.uid);
});

// ---------- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ----------
let currentUser = null;
let currentProfile = null;
let myChats = [];
let activeChatId = null;
let activeChat = null;
let activeChatMembersProfiles = {}; // uid -> profile, для группового чата
let unsubscribeMessages = () => {};
let unsubscribeChats = () => {};
let onlineInterval = null;
const profileCache = new Map();

async function cachedProfile(uid) {
  if (profileCache.has(uid)) return profileCache.get(uid);
  const p = await getProfile(uid);
  profileCache.set(uid, p);
  return p;
}

function avatarStyleFor(el, profile) {
  el.textContent = "";
  if (profile?.photoBase64) {
    el.style.background = `url(${profile.photoBase64}) center/cover`;
  } else {
    el.style.background = profile?.bgColor || "linear-gradient(135deg,#4ea4f5,#5e5ce6)";
    el.textContent = (profile?.name || "?").charAt(0).toUpperCase();
  }
}

function groupAvatarStyleFor(el, chat) {
  el.textContent = "";
  el.style.background = chat.bgColor || "linear-gradient(135deg,#4ea4f5,#5e5ce6)";
  el.innerHTML = `<span class="group-avatar-icon">👥</span>`;
}

// ---------- ВХОД В ГЛАВНОЕ ПРИЛОЖЕНИЕ ----------
async function enterMainApp(uid) {
  currentProfile = await getProfile(uid);
  showScreen("main");

  const myAvatar = document.getElementById("myAvatar");
  avatarStyleFor(myAvatar, currentProfile);
  document.getElementById("myEmojiStatus").innerHTML = emojiImgHTML(currentProfile.emojiStatus, 14);
  document.getElementById("myAvatarWrap").onclick = () => openProfileModal(currentProfile, currentUser.uid, true);

  await pingOnline(uid);
  onlineInterval = setInterval(() => pingOnline(uid), 30000);

  unsubscribeChats();
  unsubscribeChats = listenMyChats(uid, renderChatsList);
}

// ---------- СПИСОК ЧАТОВ ----------
let chatsSearchTerm = "";
document.getElementById("chatsSearchInput").addEventListener("input", (e) => {
  chatsSearchTerm = e.target.value.trim().toLowerCase();
  renderChatsList(myChats);
});

async function renderChatsList(chats) {
  myChats = chats;
  const emptyEl = document.getElementById("chatsListEmpty");
  const listEl = document.getElementById("chatsList");
  if (chats.length === 0) {
    emptyEl.classList.add("show");
    emptyEl.querySelector("p").textContent = "У вас пока нет чатов.";
    listEl.innerHTML = "";
    return;
  }
  emptyEl.classList.remove("show");

  const items = await Promise.all(chats.map(async (chat) => {
    let displayName, avatarProfileLike, isOnlineFlag = false, subtitle;
    if (chat.type === "group") {
      displayName = chat.name || "Группа";
      avatarProfileLike = null;
      subtitle = chat.lastMessage || "Группа создана";
    } else {
      const otherUid = chat.members.find((m) => m !== currentUser.uid);
      const p = await cachedProfile(otherUid);
      displayName = p?.name || "Пользователь";
      avatarProfileLike = p;
      isOnlineFlag = isOnline(p);
      subtitle = chat.lastMessage || `@${p?.username || ""}`;
    }
    return { chat, displayName, avatarProfileLike, isOnlineFlag, subtitle };
  }));

  const filtered = chatsSearchTerm
    ? items.filter((it) => it.displayName.toLowerCase().includes(chatsSearchTerm))
    : items;

  if (filtered.length === 0) {
    listEl.innerHTML = "";
    emptyEl.classList.add("show");
    emptyEl.querySelector("p").textContent = "Ничего не найдено.";
    return;
  }
  emptyEl.classList.remove("show");

  listEl.innerHTML = "";
  filtered.forEach(({ chat, displayName, avatarProfileLike, isOnlineFlag, subtitle }) => {
    const item = document.createElement("div");
    item.className = "contact-item" + (chat.id === activeChatId ? " active" : "");

    const avatar = document.createElement("div");
    avatar.className = "avatar-small";
    if (chat.type === "group") groupAvatarStyleFor(avatar, chat);
    else avatarStyleFor(avatar, avatarProfileLike);
    if (isOnlineFlag) {
      const dot = document.createElement("span");
      dot.className = "online-dot";
      avatar.appendChild(dot);
    }

    const textWrap = document.createElement("div");
    textWrap.className = "contact-text-wrap";
    textWrap.innerHTML = `
      <div class="contact-name-row">
        <span class="contact-name">${escapeHtml(displayName)}</span>
      </div>
      <div class="contact-preview">${escapeHtml(subtitle)}</div>
    `;
    item.appendChild(avatar);
    item.appendChild(textWrap);
    item.addEventListener("click", () => openChat(chat));
    listEl.appendChild(item);
  });
}

// ---------- ОТКРЫТИЕ ЧАТА ----------
async function openChat(chat) {
  activeChatId = chat.id;
  activeChat = chat;
  appEl.classList.add("chat-open");

  renderChatsList(myChats);

  document.getElementById("chatEmptyState").classList.add("hidden");
  document.getElementById("chatActive").classList.remove("hidden");
  document.getElementById("emojiPanel").classList.add("hidden");

  // Профили участников (для группы — все, для личного — собеседник)
  activeChatMembersProfiles = {};
  const others = chat.members.filter((m) => m !== currentUser.uid);
  await Promise.all(others.map(async (uid) => {
    activeChatMembersProfiles[uid] = await cachedProfile(uid);
  }));

  const header = document.getElementById("chatHeaderInfo");
  header.innerHTML = "";
  const avatar = document.createElement("div");
  avatar.className = "avatar-small";
  const info = document.createElement("div");

  if (chat.type === "group") {
    groupAvatarStyleFor(avatar, chat);
    const memberNames = others.map((uid) => activeChatMembersProfiles[uid]?.name || "?").join(", ");
    info.innerHTML = `<div class="name">${escapeHtml(chat.name || "Группа")}</div>
                       <div class="username">${escapeHtml(memberNames)}</div>`;
    header.onclick = () => openGroupInfoModal(chat, others.map((uid) => activeChatMembersProfiles[uid]));
  } else {
    const otherUid = others[0];
    const p = activeChatMembersProfiles[otherUid];
    avatarStyleFor(avatar, p);
    info.innerHTML = `<div class="name">${escapeHtml(p?.name || "")} ${emojiImgHTML(p?.emojiStatus, 16)}</div>
                       <div class="username">${isOnline(p) ? "в сети" : lastSeenText(p)}</div>`;
    header.onclick = () => openProfileModal(p, otherUid, false);
  }
  header.appendChild(avatar);
  header.appendChild(info);

  unsubscribeMessages();
  resetMessageRenderState();
  unsubscribeMessages = listenMessages(chat.id, renderMessages);
}

document.getElementById("backToListBtn").addEventListener("click", () => {
  appEl.classList.remove("chat-open");
});

document.getElementById("startFirstChatBtn").addEventListener("click", () => openNewChatModal());
document.getElementById("newChatBtn").addEventListener("click", () => openNewChatModal());

// ---------- СООБЩЕНИЯ ----------
let renderedMessageIds = new Set();
function resetMessageRenderState() {
  renderedMessageIds = new Set();
}

function buildMessageBubble(m) {
  const bubble = document.createElement("div");
  const isMine = m.senderUid === currentUser.uid;
  let cls = "msg " + (isMine ? "msg-me" : "msg-other");
  if (m.type === "image") cls += " msg-image";
  if (m.type === "emoji") cls += " msg-emoji";
  bubble.className = cls;
  bubble.dataset.id = m.id;

  const time = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
  const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;

  let senderLabel = "";
  if (!isMine && activeChat?.type === "group") {
    const p = activeChatMembersProfiles[m.senderUid];
    senderLabel = `<div class="msg-sender">${escapeHtml(p?.name || "Участник")}</div>`;
  }

  if (m.type === "text") {
    bubble.innerHTML = `${senderLabel}${escapeHtml(m.text)}<div class="msg-time">${timeStr}</div>`;
  } else if (m.type === "image") {
    bubble.innerHTML = `${senderLabel}<img src="${m.imageBase64}" alt="Фото">${m.text ? `<div style="padding:6px 8px 0">${escapeHtml(m.text)}</div>` : ""}<div class="msg-time" style="padding:0 8px 4px">${timeStr}</div>`;
  } else if (m.type === "emoji") {
    const emoji = emojiById(m.emojiId);
    bubble.innerHTML = `${senderLabel}${emoji ? emojiImgHTML(emoji.id, 64) : ""}<div class="msg-time">${timeStr}</div>`;
  }
  return bubble;
}

function renderMessages(messages) {
  const container = document.getElementById("messagesList");
  const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
  const isFirstRender = renderedMessageIds.size === 0 && container.children.length === 0;

  const incomingIds = new Set(messages.map((m) => m.id));
  // Если состав сообщений не просто "добавили новые в конец" (например, чат
  // только что открыт, либо порядок/состав изменился) — перерисовываем всё.
  const isSimpleAppend =
    !isFirstRender &&
    [...renderedMessageIds].every((id) => incomingIds.has(id)) &&
    messages.length >= renderedMessageIds.size;

  if (!isSimpleAppend) {
    container.innerHTML = "";
    messages.forEach((m) => container.appendChild(buildMessageBubble(m)));
  } else {
    messages
      .filter((m) => !renderedMessageIds.has(m.id))
      .forEach((m) => {
        const bubble = buildMessageBubble(m);
        bubble.classList.add("msg-new");
        container.appendChild(bubble);
      });
  }

  renderedMessageIds = incomingIds;

  if (isFirstRender || nearBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

document.getElementById("messageForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeChatId) return;
  const input = document.getElementById("messageInput");
  const text = input.value;
  if (!text.trim()) return;
  input.value = "";
  await sendMessage(activeChatId, currentUser.uid, { type: "text", text });
});

document.getElementById("photoInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !activeChatId) return;
  const base64 = await fileToBase64Resized(file, 1000, 0.6);
  await sendMessage(activeChatId, currentUser.uid, { type: "image", imageBase64: base64 });
});

document.getElementById("emojiToggleBtn").addEventListener("click", () => {
  const panel = document.getElementById("emojiPanel");
  const willShow = panel.classList.contains("hidden");
  if (willShow) {
    renderEmojiSendPanel(panel, async (emojiId) => {
      if (!activeChatId) return;
      await sendMessage(activeChatId, currentUser.uid, { type: "emoji", emojiId });
      panel.classList.add("hidden");
    });
  }
  panel.classList.toggle("hidden");
});

// ---------- МОДАЛКА: НОВЫЙ ЧАТ / ГРУППА ----------
let groupSelectedBg = SOLID_COLORS[1];
const groupSelectedMembers = new Map(); // uid -> profile

function openNewChatModal() {
  document.getElementById("newChatModal").classList.remove("hidden");
  document.getElementById("userSearchInput").value = "";
  document.getElementById("userSearchResults").innerHTML = "";
  document.getElementById("groupNameInput").value = "";
  document.getElementById("groupMemberSearch").value = "";
  document.getElementById("groupMemberResults").innerHTML = "";
  groupSelectedMembers.clear();
  renderSelectedMembers();
  renderBgPicker(document.getElementById("groupBgPicker"), groupSelectedBg, (v) => (groupSelectedBg = v));
}
document.getElementById("newChatCloseBtn").addEventListener("click", () => {
  document.getElementById("newChatModal").classList.add("hidden");
});

document.querySelectorAll("[data-newtab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-newtab]").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".new-chat-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.newtab === "user" ? "newChatUserTab" : "newChatGroupTab").classList.add("active");
  });
});

function renderUserResultItem(u, onClick) {
  const item = document.createElement("div");
  item.className = "contact-item";
  const avatar = document.createElement("div");
  avatar.className = "avatar-small";
  avatarStyleFor(avatar, u);
  const textWrap = document.createElement("div");
  textWrap.className = "contact-text-wrap";
  textWrap.innerHTML = `<div class="contact-name">${escapeHtml(u.name || "")}</div>
                         <div class="contact-username">@${escapeHtml(u.username || "")}</div>`;
  item.appendChild(avatar);
  item.appendChild(textWrap);
  item.addEventListener("click", () => onClick(u));
  return item;
}

let userSearchTimer = null;
document.getElementById("userSearchInput").addEventListener("input", (e) => {
  clearTimeout(userSearchTimer);
  const val = e.target.value;
  userSearchTimer = setTimeout(async () => {
    const results = await searchUsers(currentUser.uid, val);
    const container = document.getElementById("userSearchResults");
    container.innerHTML = "";
    if (val.trim() === "") return;
    if (results.length === 0) {
      container.innerHTML = `<p style="padding:10px;color:var(--text-dim);font-size:13px;">Никого не найдено</p>`;
      return;
    }
    results.forEach((u) => {
      container.appendChild(renderUserResultItem(u, async (user) => {
        const chatId = await ensureDirectChat(currentUser.uid, user.uid);
        profileCache.set(user.uid, user);
        document.getElementById("newChatModal").classList.add("hidden");
        openChat({ id: chatId, type: "direct", members: [currentUser.uid, user.uid] });
      }));
    });
  }, 250);
});

let groupSearchTimer = null;
document.getElementById("groupMemberSearch").addEventListener("input", (e) => {
  clearTimeout(groupSearchTimer);
  const val = e.target.value;
  groupSearchTimer = setTimeout(async () => {
    const results = await searchUsers(currentUser.uid, val);
    const container = document.getElementById("groupMemberResults");
    container.innerHTML = "";
    if (val.trim() === "") return;
    results.filter((u) => !groupSelectedMembers.has(u.uid)).forEach((u) => {
      container.appendChild(renderUserResultItem(u, (user) => {
        groupSelectedMembers.set(user.uid, user);
        renderSelectedMembers();
        container.innerHTML = "";
        document.getElementById("groupMemberSearch").value = "";
      }));
    });
  }, 250);
});

function renderSelectedMembers() {
  const container = document.getElementById("groupSelectedMembers");
  container.innerHTML = "";
  groupSelectedMembers.forEach((profile, uid) => {
    const chip = document.createElement("div");
    chip.className = "member-chip";
    chip.innerHTML = `${escapeHtml(profile.name || "")} <button>✕</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      groupSelectedMembers.delete(uid);
      renderSelectedMembers();
    });
    container.appendChild(chip);
  });
}

document.getElementById("createGroupBtn").addEventListener("click", async () => {
  const name = document.getElementById("groupNameInput").value.trim();
  if (!name) { alert("Введите название группы"); return; }
  if (groupSelectedMembers.size === 0) { alert("Добавьте хотя бы одного участника"); return; }
  const memberUids = Array.from(groupSelectedMembers.keys());
  memberUids.forEach((uid) => profileCache.set(uid, groupSelectedMembers.get(uid)));
  const chatId = await createGroupChat(currentUser.uid, memberUids, name, groupSelectedBg);
  document.getElementById("newChatModal").classList.add("hidden");
  openChat({ id: chatId, type: "group", name, bgColor: groupSelectedBg, members: [currentUser.uid, ...memberUids] });
});

// ---------- ПРОФИЛЬ: модальное окно (просмотр / редактирование) ----------
function openProfileModal(profile, uid, isMine) {
  const modal = document.getElementById("profileModal");
  const content = document.getElementById("profileModalContent");
  modal.classList.remove("hidden");

  content.innerHTML = `
    <div class="profile-banner" style="background:${profile?.bgColor || "linear-gradient(135deg,#4ea4f5,#5e5ce6)"}">
      <button class="profile-close" id="modalCloseBtn">✕</button>
      <div class="avatar-big" id="modalAvatar"></div>
    </div>
    <div class="profile-info">
      <div class="profile-name-row">
        <span>${escapeHtml(profile?.name || "")}</span>
        ${emojiImgHTML(profile?.emojiStatus, 22)}
      </div>
      <div class="profile-username">@${escapeHtml(profile?.username || "")}</div>
      <div class="profile-online">${isMine ? "" : (isOnline(profile) ? "в сети" : lastSeenText(profile))}</div>
      <div class="profile-bio">${escapeHtml(profile?.bio || "Описание не указано")}</div>
    </div>
    ${isMine ? `<div class="profile-actions"><button class="btn-secondary" id="editProfileBtn">Изменить профиль</button></div>` : ""}
  `;
  avatarStyleFor(document.getElementById("modalAvatar"), profile);
  document.getElementById("modalCloseBtn").onclick = () => modal.classList.add("hidden");
  if (isMine) document.getElementById("editProfileBtn").onclick = () => openEditProfile(profile);
}

function openGroupInfoModal(chat, memberProfiles) {
  const modal = document.getElementById("profileModal");
  const content = document.getElementById("profileModalContent");
  modal.classList.remove("hidden");
  content.innerHTML = `
    <div class="profile-banner" style="background:${chat.bgColor || "linear-gradient(135deg,#4ea4f5,#5e5ce6)"}">
      <button class="profile-close" id="modalCloseBtn">✕</button>
      <div class="avatar-big" style="display:flex;align-items:center;justify-content:center;font-size:34px;">👥</div>
    </div>
    <div class="profile-info">
      <div class="profile-name-row"><span>${escapeHtml(chat.name || "Группа")}</span></div>
      <div class="profile-username">${memberProfiles.length + 1} участник(а/ов)</div>
      <h3 style="margin:14px 0 6px;font-size:13px;color:var(--text-dim);">Участники</h3>
      <div id="groupMembersList"></div>
    </div>
  `;
  const list = document.getElementById("groupMembersList");
  [currentProfile, ...memberProfiles].forEach((p) => {
    const row = document.createElement("div");
    row.className = "contact-item";
    row.style.cursor = "default";
    const avatar = document.createElement("div");
    avatar.className = "avatar-small";
    avatarStyleFor(avatar, p);
    const textWrap = document.createElement("div");
    textWrap.className = "contact-text-wrap";
    textWrap.innerHTML = `<div class="contact-name">${escapeHtml(p?.name || "")}</div><div class="contact-username">@${escapeHtml(p?.username || "")}</div>`;
    row.appendChild(avatar);
    row.appendChild(textWrap);
    list.appendChild(row);
  });
  document.getElementById("modalCloseBtn").onclick = () => modal.classList.add("hidden");
}

function openEditProfile(profile) {
  const content = document.getElementById("profileModalContent");
  let editAvatarBase64 = profile.photoBase64 || null;
  let editBg = profile.bgColor || SOLID_COLORS[0];
  let editEmoji = profile.emojiStatus || EMOJIS[0].id;

  content.innerHTML = `
    <div class="profile-banner" style="background:${editBg}">
      <button class="profile-close" id="modalCloseBtn2">✕</button>
    </div>
    <div class="profile-info">
      <div class="avatar-upload">
        <div id="editAvatarPreview" class="avatar-preview"></div>
        <label for="editAvatarInput" class="avatar-upload-btn">
          <img src="svg/camera.svg" alt=""> Сменить фото
        </label>
        <input type="file" id="editAvatarInput" accept="image/*" hidden>
      </div>
      <input type="text" id="editName" value="${escapeHtml(profile.name || "")}" placeholder="Имя" style="margin-top:12px;">
      <input type="text" id="editUsername" value="${escapeHtml(profile.username || "")}" placeholder="Юзернейм" style="margin-top:8px;">
      <textarea id="editBio" rows="3" placeholder="О себе" style="margin-top:8px;">${escapeHtml(profile.bio || "")}</textarea>
      <h3 style="margin:14px 0 4px;font-size:13px;color:var(--text-dim);">Фон профиля</h3>
      <div id="editBgPicker" class="bg-picker"></div>
      <h3 style="margin:14px 0 4px;font-size:13px;color:var(--text-dim);">Emoji-статус</h3>
      <div id="editEmojiPicker" class="emoji-picker"></div>
      <button class="btn-primary" id="saveEditBtn" style="margin-top:14px;">Сохранить</button>
    </div>
  `;

  const preview = document.getElementById("editAvatarPreview");
  avatarStyleFor(preview, profile);

  document.getElementById("editAvatarInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    editAvatarBase64 = await fileToBase64Resized(file);
    preview.style.background = `url(${editAvatarBase64}) center/cover`;
    preview.textContent = "";
  });

  renderBgPicker(document.getElementById("editBgPicker"), editBg, (v) => (editBg = v));
  renderEmojiPicker(document.getElementById("editEmojiPicker"), editEmoji, (v) => (editEmoji = v));

  document.getElementById("modalCloseBtn2").onclick = () => document.getElementById("profileModal").classList.add("hidden");

  document.getElementById("saveEditBtn").onclick = async () => {
    const name = document.getElementById("editName").value.trim();
    const username = document.getElementById("editUsername").value.trim().replace(/^@/, "");
    const bio = document.getElementById("editBio").value.trim();

    const updated = { name, username, bio, photoBase64: editAvatarBase64, bgColor: editBg, emojiStatus: editEmoji };
    await updateProfileFields(currentUser.uid, updated);
    currentProfile = { ...currentProfile, ...updated };
    profileCache.set(currentUser.uid, currentProfile);

    avatarStyleFor(document.getElementById("myAvatar"), currentProfile);
    document.getElementById("myEmojiStatus").innerHTML = emojiImgHTML(currentProfile.emojiStatus, 14);

    document.getElementById("profileModal").classList.add("hidden");
    renderChatsList(myChats);
  };
}

// ---------- СЛЕЖЕНИЕ ЗА СОСТОЯНИЕМ АВТОРИЗАЦИИ ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    currentProfile = null;
    activeChatId = null;
    activeChat = null;
    profileCache.clear();
    appEl.classList.remove("chat-open");
    clearInterval(onlineInterval);
    showScreen("auth");
    return;
  }
  currentUser = user;
  const profile = await getProfile(user.uid);
  if (!profile) {
    showScreen("setup");
  } else {
    await enterMainApp(user.uid);
  }
});