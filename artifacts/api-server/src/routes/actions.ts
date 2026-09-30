import { Router } from "express";
import * as auth from "../ported/app/actions/auth";
import * as brain from "../ported/app/actions/brain";
import * as campaigns from "../ported/app/actions/campaigns";
import * as createEntity from "../ported/app/actions/create-entity";
import * as inventory from "../ported/app/actions/inventory";
import * as scheduling from "../ported/app/actions/scheduling";
import * as socialConnections from "../ported/app/actions/social-connections";
import { RedirectSignal } from "../lib/http-response";
import { withRequestContext } from "../lib/request-context";

const router = Router();
const actions: Record<string, (...args: any[]) => Promise<unknown>> = {
  signInWithPassword: auth.signInWithPassword,
  signUpWithPassword: auth.signUpWithPassword,
  signOut: auth.signOut,
  setActiveEntity: auth.setActiveEntity,
  createInvitation: auth.createInvitation,
  acceptInvitation: auth.acceptInvitation,
  getAccessibleEntities: auth.getAccessibleEntities,
  getActiveOrganizationId: auth.getActiveOrganizationId,
  isCurrentUserOrgAdmin: auth.isCurrentUserOrgAdmin,
  claimFirstOrgAdmin: auth.claimFirstOrgAdmin,
  saveEntityDna: brain.saveEntityDna,
  saveVisualPresets: brain.saveVisualPresets,
  commitScrapedDna: brain.commitScrapedDna,
  resyncDnaFromWebsite: brain.resyncDnaFromWebsite,
  uploadEntityDocument: brain.uploadEntityDocument,
  deleteEntityDocument: brain.deleteEntityDocument,
  addCustomerQuote: brain.addCustomerQuote,
  deleteCustomerQuote: brain.deleteCustomerQuote,
  updateCampaignTakeaway: brain.updateCampaignTakeaway,
  clearCampaignTakeaway: brain.clearCampaignTakeaway,
  validateDnaShape: brain.validateDnaShape,
  getStudioPack: campaigns.getStudioPack,
  getLatestStudioDraft: campaigns.getLatestStudioDraft,
  saveCampaign: campaigns.saveCampaign,
  dispatchCampaignPack: campaigns.dispatchCampaignPack,
  createEntity: createEntity.createEntity,
  appendInventoryImage: inventory.appendInventoryImage,
  removeInventoryImage: inventory.removeInventoryImage,
  removeInventoryItem: inventory.removeInventoryItem,
  approveMarketingEntity: inventory.approveMarketingEntity,
  scheduleMarketingEntity: inventory.scheduleMarketingEntity,
  saveDropDraft: inventory.saveDropDraft,
  patchDropWorkbenchDraft: inventory.patchDropWorkbenchDraft,
  createFudiFeedCarousel: inventory.createFudiFeedCarousel,
  armMultiChannelDispatch: inventory.armMultiChannelDispatch,
  repurposeMarketingEntity: inventory.repurposeMarketingEntity,
  armCampaignMultiChannelDispatch: scheduling.armCampaignMultiChannelDispatch,
  disarmCampaignQueue: scheduling.disarmCampaignQueue,
  pushScheduledPostNow: scheduling.pushScheduledPostNow,
  rescheduleScheduledPost: scheduling.rescheduleScheduledPost,
  cancelScheduledPost: scheduling.cancelScheduledPost,
  listSocialConnections: socialConnections.listSocialConnections,
  upsertSocialConnection: socialConnections.upsertSocialConnection,
  deactivateSocialConnection: socialConnections.deactivateSocialConnection,
  getOutboundWebhook: socialConnections.getOutboundWebhook,
  upsertOutboundWebhook: socialConnections.upsertOutboundWebhook,
  testOutboundWebhook: socialConnections.testOutboundWebhook,
  ensureInventoryTrackableLink: socialConnections.ensureInventoryTrackableLink,
};

const formDataActions = new Set([
  "signInWithPassword",
  "signUpWithPassword",
  "uploadEntityDocument",
]);

function toFormData(value: unknown): FormData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("FormData action argument must be a JSON object.");
  }
  const form = new FormData();
  for (const [key, raw] of Object.entries(value)) {
    if (raw && typeof raw === "object" && "base64" in raw && typeof raw.base64 === "string") {
      const file = raw as { base64: string; name?: string; type?: string };
      const bytes = Buffer.from(file.base64, "base64");
      form.set(key, new File([bytes], file.name ?? "upload.bin", { type: file.type ?? "application/octet-stream" }));
    } else if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      form.set(key, String(raw));
    } else if (raw != null) {
      form.set(key, JSON.stringify(raw));
    }
  }
  return form;
}

router.post("/actions/:name", async (req, res): Promise<void> => {
  const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
    res.status(400).json({ error: "Invalid action name." });
    return;
  }
  const action = actions[name];
  if (!action) {
    res.status(404).json({ error: `Unknown action: ${name}` });
    return;
  }
  const body = req.body as { args?: unknown; arguments?: unknown } | undefined;
  const rawArgs = body?.args ?? body?.arguments;
  if (!Array.isArray(rawArgs) || rawArgs.length > 8) {
    res.status(400).json({ error: "Action payload must contain an args array (maximum 8 arguments)." });
    return;
  }

  const args = [...rawArgs];
  try {
    if (formDataActions.has(name)) {
      if (!args.length) {
        res.status(400).json({ error: `${name} requires a FormData argument.` });
        return;
      }
      args[0] = toFormData(args[0]);
    }
    await withRequestContext(req, res, async () => {
      try {
        const result = await action(...args);
        res.json({ result: result ?? null });
      } catch (error) {
        if (error instanceof RedirectSignal) {
          res.json({ redirect: error.location });
          return;
        }
        throw error;
      }
    });
  } catch (error) {
    req.log.error({ err: error, action: name }, "Server action failed");
    res.status(500).json({ error: error instanceof Error ? error.message : "Action failed." });
  }
});

export default router;