import { AI_PROVIDERS, type AIProviderID, type ModelOption } from '@open-pencil/core/constants'

import { modelProviderName } from '@/app/ai/models/provider-name'
import type { AIModelCapability, AIModelProfileId, AIModelRole } from '@/app/ai/models/types'

/** Roles onboarding asks about; review and fast stay in the advanced settings. */
export const ONBOARDING_GOALS = ['design', 'vision'] as const
export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number]

/** Coding agents that run on this computer and bring their own subscription and model. */
export const ONBOARDING_AGENTS = [
  'acp:claude-code',
  'acp:codex',
  'acp:gemini-cli',
  'harness:pi'
] as const
/** API accounts, in the order onboarding prefers them when several are available. */
export const ONBOARDING_API_PROVIDERS = ['anthropic', 'openai', 'google', 'openrouter'] as const
/** Further API accounts the catalog supports, offered behind "More providers". */
export const ONBOARDING_MORE_API_PROVIDERS = ['deepseek', 'zai', 'minimax'] as const
/** A local model server or a company proxy that speaks the OpenAI API. */
export const ONBOARDING_SERVER_PROVIDER = 'openai-compatible'
/** One account for models from several vendors, recommended when no API account exists yet. */
export const ONBOARDING_METERED_PROVIDER = 'openrouter'

export type OnboardingAccess =
  | (typeof ONBOARDING_AGENTS)[number]
  | (typeof ONBOARDING_API_PROVIDERS)[number]
  | (typeof ONBOARDING_MORE_API_PROVIDERS)[number]
  | typeof ONBOARDING_SERVER_PROVIDER

const ONBOARDING_ACCESS = new Set<string>([
  ...ONBOARDING_AGENTS,
  ...ONBOARDING_API_PROVIDERS,
  ...ONBOARDING_MORE_API_PROVIDERS,
  ONBOARDING_SERVER_PROVIDER
])

export function isOnboardingAccess(providerID: string): providerID is OnboardingAccess {
  return ONBOARDING_ACCESS.has(providerID)
}

export type OnboardingSpending = 'existing' | 'metered'

export interface OnboardingAnswers {
  goals: OnboardingGoal[]
  access: OnboardingAccess[]
  /** `metered` lets setup add OpenRouter for goals nothing selected covers. */
  spending: OnboardingSpending
  /** The person says their server's model can read images. */
  serverVision?: boolean
}

export interface PlannedModel {
  providerID: AIProviderID
  /** Catalog model ID; empty when the connection supplies its own model (server, agent). */
  modelID: string
  name: string
  capabilities: AIModelCapability[]
  /** Set when the plan keeps a model that is already configured. */
  profileId?: AIModelProfileId
}

/** A model for a role, the design model (`'design'`), or nothing. */
export type PlannedRole = PlannedModel | 'design' | null

/** Roles in the order setup shows them. */
export const ONBOARDING_ROLES = [
  'design',
  'vision',
  'review',
  'fast'
] as const satisfies readonly AIModelRole[]

export interface OnboardingPlan {
  /** `null` keeps the design model that is configured now. */
  design: PlannedModel | null
  vision: PlannedRole
  review: PlannedRole
  fast: PlannedRole
  /** Providers to connect before the plan can be applied, in the order they are used. */
  connections: OnboardingAccess[]
}

/** The models currently assigned to each role. */
export interface CurrentOnboardingModels {
  /** False for a fresh install, whose empty roles are not choices to keep. */
  configured: boolean
  design: PlannedModel | null
  vision: PlannedRole
  review: PlannedRole
  fast: PlannedRole
}

export interface PlanOptions {
  /** Agents run as local processes, so only the desktop app can use them. */
  agentsAvailable: boolean
  current?: CurrentOnboardingModels
}

const NO_CURRENT: CurrentOnboardingModels = {
  configured: false,
  design: null,
  vision: null,
  review: null,
  fast: null
}

/** ACP agents and Pi, which run on this computer and choose their own model. */
export function isOnboardingAgent(providerID: string): boolean {
  return providerID.startsWith('acp:') || providerID === 'harness:pi'
}

function isAgentModel(model: PlannedModel | null): boolean {
  return Boolean(model && isOnboardingAgent(model.providerID))
}

function catalogModels(providerID: AIProviderID): ModelOption[] {
  return AI_PROVIDERS.find((definition) => definition.id === providerID)?.models ?? []
}

function fromCatalog(providerID: AIProviderID, model: ModelOption): PlannedModel {
  return {
    providerID,
    modelID: model.id,
    name: model.name,
    capabilities: model.capabilities ? [...model.capabilities] : ['tools']
  }
}

function plannedModel(providerID: OnboardingAccess, serverVision = false): PlannedModel {
  if (providerID === ONBOARDING_SERVER_PROVIDER) {
    return {
      providerID,
      modelID: '',
      name: modelProviderName(providerID),
      capabilities: serverVision ? ['tools', 'vision'] : ['tools']
    }
  }
  if (isOnboardingAgent(providerID)) {
    return { providerID, modelID: '', name: modelProviderName(providerID), capabilities: ['tools'] }
  }
  const defaultID = AI_PROVIDERS.find((definition) => definition.id === providerID)?.defaultModel
  const model = catalogModels(providerID).find((candidate) => candidate.id === defaultID)
  return model
    ? fromCatalog(providerID, model)
    : { providerID, modelID: '', name: modelProviderName(providerID), capabilities: ['tools'] }
}

/** The provider's model tagged as fast, for low-cost background work. */
function fastModel(providerID: AIProviderID): PlannedModel | null {
  const model = catalogModels(providerID).find(
    (candidate) => candidate.tag === 'Fast' && candidate.capabilities?.includes('tools')
  )
  return model ? fromCatalog(providerID, model) : null
}

function hasVision(model: PlannedModel): boolean {
  return model.capabilities.includes('vision')
}

function availableAccess(answers: OnboardingAnswers, options: PlanOptions): OnboardingAccess[] {
  return answers.access.filter((access) => options.agentsAvailable || !isOnboardingAgent(access))
}

/** A configured model stays while its access is still selected or onboarding cannot offer it. */
function keepable(model: PlannedModel | null, access: OnboardingAccess[]): model is PlannedModel {
  if (!model) return false
  return !isOnboardingAccess(model.providerID) || access.includes(model.providerID)
}

/** Whether a role may follow the design model: agents cannot, and vision needs image input. */
export function canFollowDesign(role: AIModelRole, design: PlannedModel | null): boolean {
  if (!design || isAgentModel(design)) return false
  return role !== 'vision' || hasVision(design)
}

function planDesign(
  answers: OnboardingAnswers,
  access: OnboardingAccess[],
  current: PlannedModel | null
) {
  if (keepable(current, access)) return current
  const preferred: OnboardingAccess[] = [
    ...ONBOARDING_AGENTS,
    ...ONBOARDING_API_PROVIDERS,
    ...ONBOARDING_MORE_API_PROVIDERS,
    ONBOARDING_SERVER_PROVIDER
  ]
  const existing = preferred.find((providerID) => access.includes(providerID))
  if (existing) return plannedModel(existing, answers.serverVision)
  return answers.spending === 'metered' ? plannedModel(ONBOARDING_METERED_PROVIDER) : null
}

function planVision(
  answers: OnboardingAnswers,
  design: PlannedModel | null,
  access: OnboardingAccess[],
  current: PlannedRole
): PlannedRole {
  if (current !== null && current !== 'design' && keepable(current, access)) return current
  if (canFollowDesign('vision', design)) return 'design'
  // A local server that reads images is preferred over a paid account.
  const candidates: OnboardingAccess[] = [
    ONBOARDING_SERVER_PROVIDER,
    ...ONBOARDING_API_PROVIDERS,
    ...ONBOARDING_MORE_API_PROVIDERS
  ]
  const existing = candidates
    .filter((providerID) => access.includes(providerID))
    .map((providerID) => plannedModel(providerID, answers.serverVision))
    .find(hasVision)
  if (existing) return existing
  const metered = plannedModel(ONBOARDING_METERED_PROVIDER)
  if (answers.spending === 'metered' && hasVision(metered)) return metered
  // Nothing new covers visual review, so a configured vision model stays as it is; inheriting
  // from a design model that cannot accept images is not possible.
  return current === 'design' ? null : current
}

/**
 * Review and fast work are never asked about, so a configured choice stays, including none,
 * unless it follows a design model it can no longer follow.
 */
function keepRole(
  current: CurrentOnboardingModels,
  role: 'review' | 'fast',
  design: PlannedModel | null
) {
  const choice = current[role]
  if (!current.configured) return false
  if (choice === 'design') return canFollowDesign(role, design)
  return !isAgentModel(choice)
}

/** Review follows the design model, or uses the API model chosen for vision behind an agent. */
function planReview(
  design: PlannedModel | null,
  vision: PlannedRole,
  current: CurrentOnboardingModels
): PlannedRole {
  if (keepRole(current, 'review', design)) return current.review
  if (canFollowDesign('review', design)) return 'design'
  return vision !== 'design' && vision?.capabilities.includes('tools') ? vision : null
}

/** Fast work uses the provider's fast model when it has one, otherwise the design model. */
function planFast(
  design: PlannedModel | null,
  vision: PlannedRole,
  current: CurrentOnboardingModels
): PlannedRole {
  if (keepRole(current, 'fast', design)) return current.fast
  const apiVision = vision === 'design' ? null : vision
  const base = canFollowDesign('fast', design) ? design : apiVision
  const fast = base ? fastModel(base.providerID) : null
  if (fast && fast.modelID !== base?.modelID) return fast
  if (canFollowDesign('fast', design)) return 'design'
  return base
}

function roleModels(plan: Omit<OnboardingPlan, 'connections'>): PlannedModel[] {
  return [plan.design, plan.vision, plan.review, plan.fast].filter(
    (model): model is PlannedModel => model !== null && model !== 'design'
  )
}

/**
 * Proposes a model for each role, preferring what is already configured and then access the
 * person already has. Agents choose their own model and cannot take the other roles, so those
 * fall back to an API model. Roles the person did not ask about keep their configuration.
 */
export function planOnboarding(answers: OnboardingAnswers, options: PlanOptions): OnboardingPlan {
  const access = availableAccess(answers, options)
  const current = options.current ?? NO_CURRENT
  const design = answers.goals.includes('design')
    ? planDesign(answers, access, current.design)
    : current.design
  const vision = answers.goals.includes('vision')
    ? planVision(answers, design, access, current.vision)
    : current.vision
  const roles = {
    design,
    vision,
    review: planReview(design, vision, current),
    fast: planFast(design, vision, current)
  }
  return { ...roles, connections: planConnections(roles) }
}

/** Providers the planned models need connected, skipping models that are already configured. */
export function planConnections(roles: Omit<OnboardingPlan, 'connections'>): OnboardingAccess[] {
  const providers = roleModels(roles)
    .filter((model) => !model.profileId)
    .map((model) => model.providerID)
    .filter(isOnboardingAccess)
  return [...new Set(providers)]
}

/** Whether every role the person asked about has a model. */
export function coversGoals(plan: OnboardingPlan, goals: OnboardingGoal[]): boolean {
  return goals.every((goal) => plan[goal] !== null)
}

/** Requested goals that the access the person selected cannot cover without OpenRouter. */
export function uncoveredGoals(answers: OnboardingAnswers, options: PlanOptions): OnboardingGoal[] {
  const plan = planOnboarding({ ...answers, spending: 'existing' }, options)
  return answers.goals.filter((goal) => plan[goal] === null)
}

export const SAME_AS_DESIGN = '__design__'
export const NO_MODEL = '__none__'

/** A stable key for a role choice, used as the value of the role's picker. */
export function roleChoiceKey(choice: PlannedRole): string {
  if (choice === 'design') return SAME_AS_DESIGN
  if (choice === null) return NO_MODEL
  return choice.profileId ?? `${choice.providerID}::${choice.modelID}`
}

/**
 * Choices for a role: configured models, every suitable catalog model of a connected provider,
 * an agent or server for the design role, and for the other roles the design model or nothing.
 */
export function roleOptions(
  role: AIModelRole,
  plan: OnboardingPlan,
  configured: PlannedModel[]
): PlannedRole[] {
  const needs: AIModelCapability = role === 'vision' ? 'vision' : 'tools'
  // Planned models come first so a provider whose catalog lists no capabilities still offers one.
  const candidates: PlannedModel[] = [...configured, ...roleModels(plan)]
  for (const providerID of plan.connections) {
    if (isOnboardingAgent(providerID) || providerID === ONBOARDING_SERVER_PROVIDER) {
      candidates.push(
        roleModels(plan).find((model) => model.providerID === providerID) ??
          plannedModel(providerID)
      )
    } else {
      candidates.push(
        ...catalogModels(providerID)
          .filter((model) => model.capabilities)
          .map((model) => fromCatalog(providerID, model))
      )
    }
  }
  const suitable = candidates.filter(
    (model) => model.capabilities.includes(needs) && (role === 'design' || !isAgentModel(model))
  )
  const unique = new Map(suitable.map((model) => [roleChoiceKey(model), model]))
  const models = [...unique.values()]
  if (role === 'design') return models
  return [...(canFollowDesign(role, plan.design) ? (['design'] as const) : []), null, ...models]
}
