import { action } from "@/lib/action-client"

export type InventoryActionResult<T = any> = { ok: true; data: T } | { ok: false; error: string }
export type SocialActionResult<T = any> = InventoryActionResult<T>
export type SaveCampaignInput = any
export type SaveCampaignResult = any
export type StudioPackSnapshot = any
export type DispatchResult = any
export type CreateEntityInput = any
export type CreateEntityResult = any

export const signInWithPassword = (...args: any[]) => action("signInWithPassword", ...args)
export const signUpWithPassword = (...args: any[]) => action("signUpWithPassword", ...args)
export const signOut = (...args: any[]) => action("signOut", ...args)
export const setActiveEntity = async (entityId: string, options?: { redirectTo?: string }) => {
  const result = await action("setActiveEntity", entityId, options)
  document.cookie = `mega_entity_id=${encodeURIComponent(entityId)}; path=/; SameSite=Lax`
  const destination = options?.redirectTo?.startsWith("/") && !options.redirectTo.startsWith("//") ? options.redirectTo : "/studio"
  window.location.assign(`${destination}?eid=${encodeURIComponent(entityId)}`)
  return result
}
export const createInvitation = (...args: any[]) => action("createInvitation", ...args)
export const acceptInvitation = (...args: any[]) => action<{ entityId: string | null; error?: string }>("acceptInvitation", ...args)
export const getAccessibleEntities = (...args: any[]) => action<import("@/lib/types").AccessibleEntity[]>("getAccessibleEntities", ...args)
export const getActiveOrganizationId = (...args: any[]) => action<string | null>("getActiveOrganizationId", ...args)
export const isCurrentUserOrgAdmin = (...args: any[]) => action<boolean>("isCurrentUserOrgAdmin", ...args)
export const claimFirstOrgAdmin = async (...args: any[]) => {
  await action("claimFirstOrgAdmin", ...args)
  window.dispatchEvent(new Event("mad:refresh"))
}
export const saveEntityDna = (...args: any[]) => action("saveEntityDna", ...args)
export const saveVisualPresets = (...args: any[]) => action("saveVisualPresets", ...args)
export const commitScrapedDna = (...args: any[]) => action("commitScrapedDna", ...args)
export const resyncDnaFromWebsite = (...args: any[]) => action("resyncDnaFromWebsite", ...args)
export const uploadEntityDocument = (...args: any[]) => action("uploadEntityDocument", ...args)
export const deleteEntityDocument = (...args: any[]) => action("deleteEntityDocument", ...args)
export const addCustomerQuote = (...args: any[]) => action("addCustomerQuote", ...args)
export const deleteCustomerQuote = (...args: any[]) => action("deleteCustomerQuote", ...args)
export const updateCampaignTakeaway = (...args: any[]) => action("updateCampaignTakeaway", ...args)
export const clearCampaignTakeaway = (...args: any[]) => action("clearCampaignTakeaway", ...args)
export const validateDnaShape = (...args: any[]) => action("validateDnaShape", ...args)
export const listSocialConnections = (...args: any[]) => action("listSocialConnections", ...args)
export const upsertSocialConnection = (...args: any[]) => action("upsertSocialConnection", ...args)
export const deactivateSocialConnection = (...args: any[]) => action("deactivateSocialConnection", ...args)
export const getOutboundWebhook = (...args: any[]) => action("getOutboundWebhook", ...args)
export const upsertOutboundWebhook = (...args: any[]) => action("upsertOutboundWebhook", ...args)
export const testOutboundWebhook = (...args: any[]) => action("testOutboundWebhook", ...args)
export const ensureInventoryTrackableLink = (...args: any[]) => action("ensureInventoryTrackableLink", ...args)
export const getStudioPack = (...args: any[]) => action("getStudioPack", ...args)
export const getLatestStudioDraft = (...args: any[]) => action("getLatestStudioDraft", ...args)
export const saveCampaign = (...args: any[]) => action("saveCampaign", ...args)
export const dispatchCampaignPack = (...args: any[]) => action("dispatchCampaignPack", ...args)
export const appendInventoryImage = (...args: any[]) => action("appendInventoryImage", ...args)
export const removeInventoryImage = (...args: any[]) => action("removeInventoryImage", ...args)
export const removeInventoryItem = (...args: any[]) => action("removeInventoryItem", ...args)
export const approveMarketingEntity = (...args: any[]) => action("approveMarketingEntity", ...args)
export const archiveDailyQueueItem = (...args: any[]) =>
  action("archiveDailyQueueItem", ...args)
export const skipDailyQueueItem = (...args: any[]) =>
  action("skipDailyQueueItem", ...args)
export const markDailyQueuePublished = (...args: any[]) =>
  action("markDailyQueuePublished", ...args)
export const updateDailyQueueCopy = (...args: any[]) =>
  action("updateDailyQueueCopy", ...args)
export const scheduleMarketingEntity = (...args: any[]) => action("scheduleMarketingEntity", ...args)
export const saveDropDraft = (...args: any[]) => action("saveDropDraft", ...args)
export const patchDropWorkbenchDraft = (...args: any[]) =>
  action("patchDropWorkbenchDraft", ...args)
export const createFudiFeedCarousel = (...args: any[]) =>
  action("createFudiFeedCarousel", ...args)
export const armMultiChannelDispatch = (...args: any[]) => action("armMultiChannelDispatch", ...args)
export const repurposeMarketingEntity = (...args: any[]) => action("repurposeMarketingEntity", ...args)
export const armCampaignMultiChannelDispatch = (...args: any[]) => action("armCampaignMultiChannelDispatch", ...args)
export const disarmCampaignQueue = (...args: any[]) => action("disarmCampaignQueue", ...args)
export const pushScheduledPostNow = (...args: any[]) => action("pushScheduledPostNow", ...args)
export const rescheduleScheduledPost = (...args: any[]) => action("rescheduleScheduledPost", ...args)
export const cancelScheduledPost = (...args: any[]) => action("cancelScheduledPost", ...args)
export const createEntity = (...args: any[]) => action("createEntity", ...args)