/**
 * Legacy Google AI entrypoint — re-exports the provider-agnostic orchestrator.
 * Prefer importing from `@/lib/ai/orchestrator` in new code.
 */
export {
  generateObjectWithFallback,
  generateTextWithFallback,
  getAiCandidateModels,
  getAiCandidateModels as getGeminiCandidateModels,
  isAiCapacityError,
  isAiCapacityError as isGeminiCapacityError,
  parseAiModelToken,
  type AiModelRef,
  type AiProvider,
} from "@/lib/ai/orchestrator"
