// ============================================================
//  Авторизация: e-mail/пароль + Google
// ============================================================
import {
  auth,
  googleProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "./firebase-config.js";

function translateError(code) {
  const map = {
    "auth/invalid-email": "Некорректный e-mail.",
    "auth/user-not-found": "Пользователь с такой почтой не найден.",
    "auth/wrong-password": "Неверный пароль.",
    "auth/invalid-credential": "Неверная почта или пароль.",
    "auth/email-already-in-use": "Эта почта уже зарегистрирована.",
    "auth/weak-password": "Пароль должен быть не короче 6 символов.",
    "auth/popup-closed-by-user": "Окно входа через Google было закрыто.",
    "auth/network-request-failed": "Проблема с сетью. Проверьте интернет."
  };
  return map[code] || "Что-то пошло не так. Попробуйте ещё раз.";
}

export async function registerWithEmail(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return { user: cred.user };
  } catch (e) {
    return { error: translateError(e.code) };
  }
}

export async function loginWithEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { user: cred.user };
  } catch (e) {
    return { error: translateError(e.code) };
  }
}

export async function loginWithGoogle() {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return { user: cred.user };
  } catch (e) {
    return { error: translateError(e.code) };
  }
}

export async function logout() {
  await signOut(auth);
}
