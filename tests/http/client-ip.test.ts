import { describe, expect, it } from "vitest";
import { clientIp } from "@/server/http/client-ip";

const headers = (value?: string) => new Headers(value === undefined ? {} : { "x-forwarded-for": value });

describe("clientIp", () => {
  it("uses no address when no proxy is trusted, so visitors do not share one bucket", () => {
    expect(clientIp(headers("203.0.113.9"), false)).toBeNull();
  });

  it("takes the last address added by the trusted proxy, not one the client could forge", () => {
    expect(clientIp(headers("198.51.100.1, 203.0.113.9"), true)).toBe("203.0.113.9");
    expect(clientIp(headers("203.0.113.9"), true)).toBe("203.0.113.9");
  });

  it("returns null when the proxy sent no forwarded header", () => {
    expect(clientIp(headers(), true)).toBeNull();
  });
});
