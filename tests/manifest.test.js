import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "manifest.json"), "utf8"));
describe("Manifest V3 privacy boundary", () => {
  it("requests only the approved permissions", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["activeTab", "scripting", "contextMenus", "identity", "storage", "alarms"]);
    expect(manifest.host_permissions).toEqual(["https://hjgbnndsobovniflcqcm.supabase.co/*"]);
    expect(manifest.content_scripts).toBeUndefined();
  });
});
