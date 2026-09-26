import type { CookieOptions } from "express";
import { setResponseCookie } from "./request-context";

export class RedirectSignal extends Error {
  constructor(
    readonly location: string,
    readonly status = 303,
  ) {
    super("Redirect");
  }
}

export function redirect(location: string): never {
  throw new RedirectSignal(location);
}

export function revalidatePath(_path: string): void {
  // Express has no page cache; Supabase-backed reads are fresh per request.
}

export class HttpResponse extends Response {
  cookies = {
    set: (name: string, value: string, options?: CookieOptions) => {
      setResponseCookie(name, value, options);
    },
  };

  static json(body: unknown, init?: ResponseInit): HttpResponse {
    const headers = new Headers(init?.headers);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json; charset=utf-8");
    }
    return new HttpResponse(JSON.stringify(body), { ...init, headers });
  }

  static redirect(
    url: string | URL,
    init: number | ResponseInit = 307,
  ): HttpResponse {
    const status = typeof init === "number" ? init : init.status ?? 307;
    return new HttpResponse(null, {
      status,
      headers: { location: String(url) },
    });
  }
}

export type WebRequest = Request & {
  nextUrl: URL;
  cookies: { getAll(): Array<{ name: string; value: string }> };
};