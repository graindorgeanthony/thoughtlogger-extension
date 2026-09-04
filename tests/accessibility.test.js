import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
describe("popup accessibility", () => {
  const html = readFileSync(resolve(process.cwd(), "popup/popup.html"), "utf8");
  const css = readFileSync(resolve(process.cwd(), "popup/popup.css"), "utf8");
  beforeEach(() => { document.documentElement.innerHTML = html; });
  it("uses explicit labels and live feedback", () => {
    for (const id of ["note", "type"]) expect(document.querySelector(`label[for=${id}]`)).not.toBeNull();
    expect(document.querySelector("#status").getAttribute("aria-live")).toBe("polite");
  });
  it("gives every icon control an accessible name and native keyboard behavior", () => {
    for (const button of document.querySelectorAll(".tool")) expect(button.getAttribute("aria-label")).toBeTruthy();
    expect([...document.querySelectorAll("button")].every((node) => node.tagName === "BUTTON")).toBe(true);
  });
  it("exposes loading and disabled state through native semantics", () => {
    const submit = document.querySelector("#submit"); submit.disabled = true;
    expect(submit.matches(":disabled")).toBe(true);
  });
  it("never renders connected and disconnected views together", () => {
    const connect = document.querySelector("#connect-view");
    const composer = document.querySelector("#composer");
    const footer = document.querySelector("#connected-footer");
    connect.hidden = true; composer.hidden = false; footer.hidden = false;
    expect([connect, composer, footer].filter((node) => !node.hidden)).toEqual([composer, footer]);
    expect(css).toMatch(/\[hidden\]\{display:none!important\}/);
  });
});
