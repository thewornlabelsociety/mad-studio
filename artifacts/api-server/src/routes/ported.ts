import { Router, type Request as ExpressRequest, type Response as ExpressResponse } from "express";
import { Readable } from "node:stream";
import type { WebRequest } from "../lib/http-response";
import { getTrustedRequestOrigin, withRequestContext } from "../lib/request-context";
import * as analyticsLog from "../ported/app/api/analytics/log/route";
import * as apiSignout from "../ported/app/api/auth/signout/route";
import * as dataDeletion from "../ported/app/api/auth/data-deletion/route";
import * as metaStart from "../ported/app/api/auth/meta/route";
import * as metaCallback from "../ported/app/api/auth/meta/callback/route";
import * as tiktokStart from "../ported/app/api/auth/tiktok/route";
import * as tiktokCallback from "../ported/app/api/auth/tiktok/callback/route";
import * as brainChat from "../ported/app/api/brain/chat/route";
import * as brainMemory from "../ported/app/api/brain/memory/route";
import * as brainSuggest from "../ported/app/api/brain/suggest/route";
import * as postMortem from "../ported/app/api/campaigns/post-mortem/route";
import * as dispatch from "../ported/app/api/cron/dispatch/route";
import * as dispatchScheduled from "../ported/app/api/cron/dispatch-scheduled/route";
import * as syncMetrics from "../ported/app/api/cron/sync-metrics/route";
import * as scrape from "../ported/app/api/entities/scrape/route";
import * as generatePack from "../ported/app/api/generate/pack/route";
import * as imageProxy from "../ported/app/api/media/image-proxy/route";
import * as inspect from "../ported/app/api/media/inspect/route";
import * as removeBackground from "../ported/app/api/media/remove-bg/route";
import * as uploadCutout from "../ported/app/api/media/upload-cutout/route";
import * as publish from "../ported/app/api/social/publish/route";
import * as verifySocial from "../ported/app/api/social/verify/route";
import * as pullArrivals from "../ported/app/api/sync/pull-new-arrivals/route";
import * as syncWebsite from "../ported/app/api/sync/website/route";
import * as authCallback from "../ported/app/auth/callback/route";
import * as authConfirm from "../ported/app/auth/confirm/route";
import * as shortLink from "../ported/app/r/[slug]/route";

type WebHandler = (request: globalThis.Request, ...args: any[]) => Promise<globalThis.Response>;
const router = Router();

function webHandler(handler: WebHandler, bodyExpected = true) {
  return async (req: ExpressRequest, res: ExpressResponse): Promise<void> => {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      let body: RequestInit["body"];
      if (bodyExpected && !["GET", "HEAD"].includes(req.method)) {
        if (req.body !== undefined && Object.keys(req.body ?? {}).length > 0) {
          body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
          if (!headers.has("content-type")) headers.set("content-type", "application/json");
        } else if (headers.get("content-type")?.includes("multipart/form-data")) {
          body = req as unknown as RequestInit["body"];
        } else {
          body = undefined;
        }
      }
      const init: RequestInit & { duplex?: "half" } = {
        method: req.method,
        headers,
        ...(body === undefined ? {} : { body }),
        ...(body !== undefined && headers.get("content-type")?.includes("multipart/form-data")
          ? { duplex: "half" as const }
          : {}),
      };
      const origin = getTrustedRequestOrigin(req);
      const webRequest = new Request(
        `${origin}${req.originalUrl}`,
        init,
      ) as WebRequest;
      Object.defineProperty(webRequest, "cookies", {
        value: {
          getAll() {
            return (req.headers.cookie ?? "").split(";").flatMap((part) => {
              const index = part.indexOf("=");
              return index < 0 ? [] : [{
                name: part.slice(0, index).trim(),
                value: decodeURIComponent(part.slice(index + 1).trim()),
              }];
            });
          },
        },
      });
      Object.defineProperty(webRequest, "nextUrl", {
        value: new URL(webRequest.url),
      });
      await withRequestContext(req, res, async () => {
        const response = await handler(webRequest, { params: Promise.resolve(req.params) });
        res.status(response.status);
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "set-cookie") res.setHeader(key, value);
        });
        const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
        for (const cookie of getSetCookie?.call(response.headers) ?? []) res.append("Set-Cookie", cookie);
        if (!response.body) {
          res.end();
          return;
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("text/event-stream")) {
          Readable.fromWeb(response.body as import("node:stream/web").ReadableStream).pipe(res);
          return;
        }
        res.send(Buffer.from(await response.arrayBuffer()));
      });
    } catch (error) {
      req.log.error({ err: error }, "Imported route failed");
      res.status(500).json({ error: error instanceof Error ? error.message : "Request failed." });
    }
  };
}

const method = (mod: Record<string, unknown>, verb: string) =>
  mod[verb] as WebHandler;

router.post("/api/analytics/log", webHandler(method(analyticsLog, "POST")));
router.post("/api/auth/signout", webHandler(method(apiSignout, "POST")));
router.get("/api/auth/data-deletion", webHandler(method(dataDeletion, "GET"), false));
router.post("/api/auth/data-deletion", webHandler(method(dataDeletion, "POST")));
router.get("/api/auth/meta", webHandler(method(metaStart, "GET"), false));
router.get("/api/auth/meta/callback", webHandler(method(metaCallback, "GET"), false));
router.get("/api/auth/tiktok", webHandler(method(tiktokStart, "GET"), false));
router.get("/api/auth/tiktok/callback", webHandler(method(tiktokCallback, "GET"), false));
router.post("/api/brain/chat", webHandler(method(brainChat, "POST")));
router.post("/api/brain/memory", webHandler(method(brainMemory, "POST")));
router.post("/api/brain/suggest", webHandler(method(brainSuggest, "POST")));
router.post("/api/campaigns/post-mortem", webHandler(method(postMortem, "POST")));
router.get("/api/cron/dispatch", webHandler(method(dispatch, "GET"), false));
router.post("/api/cron/dispatch", webHandler(method(dispatch, "POST")));
router.get("/api/cron/dispatch-scheduled", webHandler(method(dispatchScheduled, "GET"), false));
router.post("/api/cron/dispatch-scheduled", webHandler(method(dispatchScheduled, "POST")));
router.get("/api/cron/sync-metrics", webHandler(method(syncMetrics, "GET"), false));
router.post("/api/cron/sync-metrics", webHandler(method(syncMetrics, "POST")));
router.post("/api/entities/scrape", webHandler(method(scrape, "POST")));
router.post("/api/generate/pack", webHandler(method(generatePack, "POST")));
router.get("/api/media/image-proxy", webHandler(method(imageProxy, "GET"), false));
router.post("/api/media/inspect", webHandler(method(inspect, "POST")));
router.post("/api/media/remove-bg", webHandler(method(removeBackground, "POST")));
router.post("/api/media/upload-cutout", webHandler(method(uploadCutout, "POST")));
router.post("/api/social/publish", webHandler(method(publish, "POST")));
router.get("/api/social/verify", webHandler(method(verifySocial, "GET"), false));
router.post("/api/sync/pull-new-arrivals", webHandler(method(pullArrivals, "POST")));
router.post("/api/sync/website", webHandler(method(syncWebsite, "POST")));
router.get("/auth/callback", webHandler(method(authCallback, "GET"), false));
router.get("/auth/confirm", webHandler(method(authConfirm, "GET"), false));
router.get("/r/:slug", webHandler(method(shortLink, "GET"), false));
router.get("/api/auth/callback", webHandler(method(authCallback, "GET"), false));
router.get("/api/auth/confirm", webHandler(method(authConfirm, "GET"), false));
router.get("/api/r/:slug", webHandler(method(shortLink, "GET"), false));

export default router;