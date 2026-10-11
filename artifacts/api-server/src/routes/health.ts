import { Router, type IRouter } from "express";

import { getRegisteredServerActionNames } from "./actions";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const serverActions = getRegisteredServerActionNames();
  res.json({
    status: "ok",
    madApiBuildId: process.env.MAD_API_BUILD_ID ?? null,
    hasCampaignProgramsRoute: true,
    serverActionCount: serverActions.length,
    hasCreateFudiFeedCarousel: serverActions.includes("createFudiFeedCarousel"),
    hasPatchDropWorkbenchDraft: serverActions.includes("patchDropWorkbenchDraft"),
  });
});

export default router;
