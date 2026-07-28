// ============================================================
//  Чат: личные и групповые чаты, сообщения (текст/фото/emoji)
// ============================================================
import {
  db, collection, addDoc, doc, setDoc, updateDoc, getDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, getDocs
} from "./firebase-config.js";

// Детерминированный id личного чата для пары пользователей
export function getDirectChatId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

// Получить (или создать) личный чат между двумя пользователями.
// Чат не появляется у всех подряд — только когда кто-то реально
// инициирует переписку через поиск.
export async function ensureDirectChat(myUid, otherUid) {
  const chatId = getDirectChatId(myUid, otherUid);
  const ref = doc(db, "chats", chatId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      type: "direct",
      members: [myUid, otherUid],
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessage: ""
    });
  }
  return chatId;
}

// Создать групповой чат
export async function createGroupChat(creatorUid, memberUids, name, bgColor) {
  const members = Array.from(new Set([creatorUid, ...memberUids]));
  const ref = await addDoc(collection(db, "chats"), {
    type: "group",
    name,
    bgColor,
    members,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessage: ""
  });
  return ref.id;
}

// Подписка на список чатов текущего пользователя (обновляется в реальном времени)
export function listenMyChats(uid, callback) {
  const q = query(
    collection(db, "chats"),
    where("members", "array-contains", uid),
    orderBy("lastMessageAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const chats = [];
    snap.forEach((d) => chats.push({ id: d.id, ...d.data() }));
    callback(chats);
  });
}

// Поиск пользователей по имени/юзернейму (используется только в модалке
// "Новый чат" / "Создать группу" — не показывается автоматически всем)
export async function searchUsers(myUid, queryText) {
  const snap = await getDocs(collection(db, "users"));
  const q = queryText.trim().toLowerCase().replace(/^@/, "");
  const results = [];
  snap.forEach((d) => {
    if (d.id === myUid) return;
    const u = d.data();
    if (!q || (u.name || "").toLowerCase().includes(q) || (u.username || "").toLowerCase().includes(q)) {
      results.push({ uid: d.id, ...u });
    }
  });
  return results;
}

// Отправить сообщение. type: "text" | "image" | "emoji"
export async function sendMessage(chatId, senderUid, payload) {
  const { type, text, imageBase64, emojiId } = payload;
  const msg = {
    senderUid,
    type,
    createdAt: serverTimestamp()
  };
  if (type === "text") msg.text = text.trim();
  if (type === "image") { msg.imageBase64 = imageBase64; if (text) msg.text = text.trim(); }
  if (type === "emoji") msg.emojiId = emojiId;

  await addDoc(collection(db, "chats", chatId, "messages"), msg);

  let preview = "";
  if (type === "text") preview = text.trim();
  if (type === "image") preview = "📷 Фото";
  if (type === "emoji") preview = "😊 Эмодзи";

  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: preview.slice(0, 80),
    lastMessageAt: serverTimestamp()
  });
}

// Подписка на сообщения чата в реальном времени.
export function listenMessages(chatId, callback) {
  const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const messages = [];
    snap.forEach((d) => messages.push({ id: d.id, ...d.data() }));
    callback(messages);
  });
}

// Получить профили участников чата (кроме себя) — для отображения имени/аватара
export async function getOtherMembersProfiles(chat, myUid) {
  const others = chat.members.filter((m) => m !== myUid);
  const profiles = [];
  for (const uid of others) {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) profiles.push({ uid, ...snap.data() });
  }
  return profiles;
}
