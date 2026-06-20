import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, set, get, update, onValue, off, child, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB7q8KvXjmEEarKXy-m4YyTPl85clzTNy8",
  authDomain: "dia-del-padre-2026.firebaseapp.com",
  databaseURL: "https://dia-del-padre-2026-default-rtdb.firebaseio.com",
  projectId: "dia-del-padre-2026",
  storageBucket: "dia-del-padre-2026.firebasestorage.app",
  messagingSenderId: "274672737843",
  appId: "1:274672737843:web:bcd0104fde9a06a2bb8d46"
};

const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);

window.__fb = { ref, set, get, update, onValue, off, child, remove, db };
window.dispatchEvent(new Event('firebase-ready'));
