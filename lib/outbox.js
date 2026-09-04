const DB_NAME = "thoughtlogger-extension";
const DB_VERSION = 1;
const OUTBOX = "outbox";
const DRAFTS = "drafts";

export function openDatabase(indexedDBImpl = indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDBImpl.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX)) {
        const store = db.createObjectStore(OUTBOX, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("nextAttemptAt", "nextAttemptAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact(db, storeName, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const result = action(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error || result?.error);
    tx.onabort = () => reject(tx.error || new Error("Database operation aborted."));
  });
}

export async function putOutbox(db, userId, payload) {
  const existing = await getOutbox(db, payload.id);
  const item = existing || { id: payload.id, userId, payload, attempts: 0, createdAt: Date.now(), nextAttemptAt: 0 };
  if (existing && existing.userId !== userId) throw new Error("Capture belongs to a different ThoughtLogger account.");
  await transact(db, OUTBOX, "readwrite", (store) => store.put(item));
  return item;
}

export async function getOutbox(db, id) {
  return transact(db, OUTBOX, "readonly", (store) => store.get(id));
}

export async function listOutbox(db, userId) {
  const all = await transact(db, OUTBOX, "readonly", (store) => store.getAll());
  return (all || []).filter((item) => item.userId === userId).sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeOutbox(db, id) {
  await transact(db, OUTBOX, "readwrite", (store) => store.delete(id));
}

export async function failOutbox(db, id, attempts, retryable = true) {
  const item = await getOutbox(db, id);
  if (!item) return;
  const delay = retryable ? Math.min(30 * 60_000, 15_000 * (2 ** Math.min(attempts, 7))) : Number.MAX_SAFE_INTEGER;
  await transact(db, OUTBOX, "readwrite", (store) => store.put({ ...item, attempts, nextAttemptAt: Date.now() + delay }));
}

export async function clearAccountOutbox(db, userId) {
  const items = await listOutbox(db, userId);
  await Promise.all(items.map((item) => removeOutbox(db, item.id)));
}

export async function countAllOutbox(db) {
  return transact(db, OUTBOX, "readonly", (store) => store.count());
}

export async function saveDraft(db, userId, draft) {
  await transact(db, DRAFTS, "readwrite", (store) => store.put({ id: `draft:${userId || "guest"}`, ...draft, updatedAt: Date.now() }));
}

export async function getDraft(db, userId) {
  return (await transact(db, DRAFTS, "readonly", (store) => store.get(`draft:${userId || "guest"}`))) || null;
}

export async function clearDraft(db, userId) {
  await transact(db, DRAFTS, "readwrite", (store) => store.delete(`draft:${userId || "guest"}`));
}
