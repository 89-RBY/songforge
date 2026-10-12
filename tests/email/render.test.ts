import { describe, expect, it } from "vitest";
import { escapeHtml, renderMagicLinkEmail } from "@/server/email/send";

describe("escapeHtml", () => {
  it("escapes characters that could break out of an HTML attribute", () => {
    expect(escapeHtml(`a&b<c>"d"`)).toBe("a&amp;b&lt;c&gt;&quot;d&quot;");
  });
});

describe("renderMagicLinkEmail", () => {
  const url = "http://localhost:3000/api/auth/callback/nodemailer?token=abc&email=a%40b.it";

  it("includes the raw link in the plain-text body", () => {
    expect(renderMagicLinkEmail(url).text).toContain(url);
  });

  it("escapes the link inside the HTML body", () => {
    const { html } = renderMagicLinkEmail(url);
    expect(html).toContain("token=abc&amp;email=a%40b.it");
    expect(html).not.toContain("token=abc&email");
  });

  it("states the 24-hour, single-use validity", () => {
    expect(renderMagicLinkEmail(url).text).toMatch(/24 ore/);
  });
});
