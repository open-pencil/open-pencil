import { CLOUD_PROTOCOL_MAX_UPLOAD_BYTES } from '#cloud/server/config'
import {
  DefaultLogger,
  TypedInMemoryProvider,
  type EvaluationContext,
  type Provider,
  type ResolutionDetails
} from '@openfeature/server-sdk'

import { CLOUD_FEATURE_KEYS, type CloudPolicyContext } from './keys'

const DEFAULT_FLAGS = {
  [CLOUD_FEATURE_KEYS.links]: {
    variants: { enabled: true, disabled: false },
    defaultVariant: 'enabled',
    disabled: false
  },
  [CLOUD_FEATURE_KEYS.guestView]: {
    variants: { enabled: true, disabled: false },
    defaultVariant: 'enabled',
    disabled: false
  },
  [CLOUD_FEATURE_KEYS.guestEdit]: {
    variants: { enabled: true, disabled: false },
    defaultVariant: 'enabled',
    disabled: false
  },
  [CLOUD_FEATURE_KEYS.guestPresence]: {
    variants: { enabled: true, disabled: false },
    defaultVariant: 'enabled',
    disabled: false
  },
  [CLOUD_FEATURE_KEYS.collaboration]: {
    variants: { enabled: true, disabled: false },
    defaultVariant: 'enabled',
    disabled: false
  },
  [CLOUD_FEATURE_KEYS.serverEnforcedWrites]: {
    variants: { enabled: false, disabled: false },
    defaultVariant: 'disabled',
    disabled: false
  },
  [CLOUD_FEATURE_KEYS.revisionHistory]: {
    variants: { enabled: true, disabled: false },
    defaultVariant: 'enabled',
    disabled: false
  },
  [CLOUD_FEATURE_KEYS.maximumFileBytes]: {
    variants: { default: CLOUD_PROTOCOL_MAX_UPLOAD_BYTES },
    defaultVariant: 'default',
    disabled: false
  }
} as const

function evaluationContext(context: CloudPolicyContext): EvaluationContext {
  const evaluation: EvaluationContext = {
    targetingKey: context.targetingKey,
    deploymentMode: context.deploymentMode
  }
  if (context.actorId) evaluation.actorId = context.actorId
  if (context.workspaceId) evaluation.workspaceId = context.workspaceId
  if (context.organizationId) evaluation.organizationId = context.organizationId
  if (context.documentId) evaluation.documentId = context.documentId
  return evaluation
}

const logger = new DefaultLogger()

/** A flag's value, or the default when the provider failed or reported an error, as a client does. */
async function resolved<T>(evaluation: () => Promise<ResolutionDetails<T>>, defaultValue: T) {
  try {
    const details = await evaluation()
    return details.errorCode ? defaultValue : details.value
  } catch {
    return defaultValue
  }
}

/**
 * Answers entitlement questions from one OpenFeature provider. It asks the provider directly
 * rather than through the global `OpenFeature` API: each app has its own provider, and the API
 * keeps every provider registered under a domain reachable for the life of the process, with the
 * database its entitlement source holds.
 */
export class CloudPolicy {
  constructor(private readonly provider: Provider) {}

  boolean(key: string, defaultValue: boolean, context: CloudPolicyContext): Promise<boolean> {
    return resolved(
      () =>
        this.provider.resolveBooleanEvaluation(
          key,
          defaultValue,
          evaluationContext(context),
          logger
        ),
      defaultValue
    )
  }

  number(key: string, defaultValue: number, context: CloudPolicyContext): Promise<number> {
    return resolved(
      () =>
        this.provider.resolveNumberEvaluation(
          key,
          defaultValue,
          evaluationContext(context),
          logger
        ),
      defaultValue
    )
  }
}

export function createDefaultCloudPolicy(provider?: Provider): CloudPolicy {
  return new CloudPolicy(provider ?? new TypedInMemoryProvider(DEFAULT_FLAGS))
}
