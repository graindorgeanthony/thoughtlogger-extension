import { beforeEach, describe, expect, it } from "vitest";
import { clearAccountOutbox, countAllOutbox, listOutbox, openDatabase, putOutbox, removeOutbox } from "../lib/outbox.js";

beforeEach(() => new Promise((resolve) => { const req = indexedDB.deleteDatabase("thoughtlogger-extension"); req.onsuccess = req.onerror = req.onblocked = () => resolve(); }));
describe("offline outbox", () => {
  it("is idempotent by capture UUID", async () => {
    const db = await openDatabase(); const payload = { id: "one", text: "first" };
    await putOutbox(db, "user-a", payload); await putOutbox(db, "user-a", payload);
    expect(await countAllOutbox(db)).toBe(1); db.close();
  });
  it("isolates accounts and clears only the confirmed account", async () => {
    const db = await openDatabase();
    await putOutbox(db, "user-a", { id: "a" }); await putOutbox(db, "user-b", { id: "b" });
    expect((await listOutbox(db, "user-a")).map((i) => i.id)).toEqual(["a"]);
    await clearAccountOutbox(db, "user-a"); expect(await countAllOutbox(db)).toBe(1);
    await removeOutbox(db, "b"); expect(await countAllOutbox(db)).toBe(0); db.close();
  });
  it("refuses to reassign a UUID to another account", async () => {
    const db = await openDatabase(); await putOutbox(db, "user-a", { id: "same" });
    await expect(putOutbox(db, "user-b", { id: "same" })).rejects.toThrow(/different/); db.close();
  });
});
