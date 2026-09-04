import { describe, expect, it } from "vitest";
import { contextMenuCapture, extractPastedUrl, isHttpUrl, isYouTubeUrl, makeCapture, normalizeUrl } from "../lib/capture.js";

describe("capture contract", () => {
  it("accepts HTTP(S) and rejects internal schemes", () => {
    expect(isHttpUrl("https://thoughtlogger.com")).toBe(true);
    expect(isHttpUrl("chrome://settings")).toBe(false);
    expect(isHttpUrl("file:///tmp/a")).toBe(false);
  });
  it("normalizes pasted links and recognizes YouTube variants", () => {
    expect(normalizeUrl("thoughtlogger.com/extension")).toBe("https://thoughtlogger.com/extension");
    expect(extractPastedUrl("Watch https://youtu.be/abc123.")).toBe("https://youtu.be/abc123");
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isYouTubeUrl("https://example.com/youtube")).toBe(false);
  });
  it("validates content and converts Auto to an unlocked null type", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(makeCapture({ text: "A thought", typeKey: "auto" }, id)).toMatchObject({ id, kind: "note", typeKey: null });
    expect(() => makeCapture({ text: "" }, id)).toThrow(/attachment/i);
  });
  it("maps context menu actions without reading the page body", () => {
    const tab = { url: "https://example.com", title: "Example" };
    expect(contextMenuCapture({ menuItemId: "thoughtlogger-save-page" }, tab)).toEqual({ kind: "page", sourceUrl: "https://example.com/", text: "Example" });
    expect(contextMenuCapture({ menuItemId: "thoughtlogger-save-selection", selectionText: "Chosen" }, tab).text).toBe("Chosen");
    expect(contextMenuCapture({ menuItemId: "thoughtlogger-save-screenshot" }, tab, "data:image/jpeg;base64,AA==").screenshot).toContain("image/jpeg");
  });
});
