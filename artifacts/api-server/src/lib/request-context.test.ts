import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";
import { getInternalApiOrigin, getTrustedRequestOrigin } from "./request-context.ts";

test("forged request hosts cannot change public links or secret-bearing dispatch targets", () => {
  const previous = {
    app: process.env.APP_PUBLIC_ORIGIN,
    domains: process.env.REPLIT_DOMAINS,
    port: process.env.PORT,
  };
  try {
    process.env.APP_PUBLIC_ORIGIN = "https://studio.example.test";
    process.env.REPLIT_DOMAINS = "studio.example.test";
    process.env.PORT = "8080";
    const forged = {
      get: (header: string) =>
        header === "host" || header === "x-forwarded-host"
          ? "attacker.example.test"
          : undefined,
      protocol: "https",
    } as unknown as Request;
    assert.equal(getTrustedRequestOrigin(forged), "https://studio.example.test");
    assert.equal(getInternalApiOrigin(), "http://127.0.0.1:8080");
    process.env.APP_PUBLIC_ORIGIN = "https://attacker.example.test/path";
    assert.throws(() => getTrustedRequestOrigin(forged), /Invalid configured public origin/);
  } finally {
    for (const [key, value] of Object.entries({
      APP_PUBLIC_ORIGIN: previous.app,
      REPLIT_DOMAINS: previous.domains,
      PORT: previous.port,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});