import { AsyncLocalStorage } from "node:async_hooks";
import type { CookieOptions, Request, Response } from "express";

function normalizePublicOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const localhost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".localhost");
    if (!localhost && url.protocol !== "https:") return null;
    if (localhost && url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

type CookieValue = { name: string; value: string; options?: CookieOptions };
type RequestContext = { request: Request; response: Response };

const context = new AsyncLocalStorage<RequestContext>();

// Next's cookie API specifies maxAge in seconds; Express expects milliseconds.
function expressCookieOptions(options?: CookieOptions): CookieOptions {
  return options?.maxAge === undefined
    ? options ?? {}
    : { ...options, maxAge: options.maxAge * 1000 };
}

export function withRequestContext<T>(
  request: Request,
  response: Response,
  callback: () => Promise<T>,
): Promise<T> {
  return context.run({ request, response }, callback);
}

export async function cookies() {
  const current = context.getStore();
  if (!current) throw new Error("Request cookie context is unavailable.");
  return {
    getAll() {
      const raw = current.request.headers.cookie ?? "";
      return raw.split(";").flatMap((part) => {
        const separator = part.indexOf("=");
        if (separator < 0) return [];
        return [{
          name: part.slice(0, separator).trim(),
          value: decodeURIComponent(part.slice(separator + 1).trim()),
        }];
      });
    },
    get(name: string) {
      return this.getAll().find((item) => item.name === name);
    },
    set(name: string, value: string, options?: CookieOptions) {
      current.response.cookie(name, value, expressCookieOptions(options));
    },
    delete(name: string) {
      current.response.clearCookie(name, { path: "/" });
    },
  };
}

export async function headers() {
  const current = context.getStore();
  if (!current) throw new Error("Request header context is unavailable.");
  return new Headers(
    Object.entries(current.request.headers).flatMap(([key, value]) => {
      if (value === undefined) return [];
      return [[key, Array.isArray(value) ? value.join(",") : value]];
    }),
  );
}

export function getRequestContext(): RequestContext | undefined {
  return context.getStore();
}

export function getRequestOrigin(): string {
  return getTrustedRequestOrigin();
}

/** Public links must use a platform-configured domain, never client-supplied Host headers. */
export function getTrustedRequestOrigin(_request?: Request): string {
  const configured =
    normalizePublicOrigin(process.env.APP_PUBLIC_ORIGIN ?? "") ??
    normalizePublicOrigin(
      process.env.REPLIT_DOMAINS?.split(",")[0]?.trim()
        ? `https://${process.env.REPLIT_DOMAINS!.split(",")[0]!.trim()}`
        : "",
    ) ??
    normalizePublicOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (!configured) {
    throw new Error(
      "APP_PUBLIC_ORIGIN, REPLIT_DOMAINS, or NEXT_PUBLIC_SITE_URL must be configured.",
    );
  }
  return configured;
}

/** Origin for adapting Express requests to Web handlers (cookies, path). Not for public URLs. */
export function getInboundRequestOrigin(request: Request): string {
  const forwardedProto = request.headers["x-forwarded-proto"]
    ?.toString()
    .split(",")[0]
    ?.trim();
  const forwardedHost = request.headers["x-forwarded-host"]
    ?.toString()
    .split(",")[0]
    ?.trim();
  const proto = forwardedProto || request.protocol || "http";
  const host = forwardedHost || request.headers.host;
  if (host) return `${proto}://${host}`;
  return getInternalApiOrigin();
}

/** Secret-bearing dispatches never leave this process's loopback interface. */
export function getInternalApiOrigin(): string {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("A valid PORT is required for internal dispatch.");
  }
  return `http://127.0.0.1:${port}`;
}

export function setResponseCookie(
  name: string,
  value: string,
  options?: CookieOptions,
): void {
  const current = context.getStore();
  if (!current) throw new Error("Response cookie context is unavailable.");
  current.response.cookie(name, value, expressCookieOptions(options));
}

export type { CookieValue };