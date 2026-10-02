import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import mediaProxyRouter from "./routes/media-proxy";
import portedRouter from "./routes/ported";

const app: Express = express();
app.set("trust proxy", true);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Meta webhooks require the raw JSON body for X-Hub-Signature-256 verification.
app.use(
  "/api/webhooks/meta-sentiment",
  express.raw({ type: "application/json", limit: "1mb" }),
);
// Imported media inspection and document actions submit encoded files as JSON.
// Keep a bounded payload allowance for those routes without raising every endpoint's limit.
app.use(["/api/actions/uploadEntityDocument", "/api/media/inspect", "/api/media/remove-bg", "/api/media/upload-cutout"], express.json({ limit: "30mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(mediaProxyRouter);
app.use(portedRouter);
app.use("/api", router);

export default app;
