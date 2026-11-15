import { CLOUD_PROTOCOL_MAX_UPLOAD_BYTES } from '#cloud/server/config'
import {
  DefaultLogger,
  ErrorCode,
  OpenFeatureError,
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
  evaluation.subjectType = context.subjectType
  if (context.actorId) evaluation.actorId = context.actorId
  if (context.workspaceId) evaluation.workspaceId = context.workspaceId
  if (context.organizationId) evaluation.organizationId = context.organizationId
  if (context.documentId) evaluation.documentId = context.documentId
  return evaluation
}

const logger = new DefaultLogger()

/** A flag's value, or the default when the provider failed or reported an error, as a client does. */
async function resolved<T>(evaluation: () => Promise<ResolutionDetails<T>>, defaultValue: T) {
  return (await resolution(evaluation, defaultValue)).value
}

/**
 * A flag's value, and whether the provider failed to answer. A flag it doesn't know is no failure:
 * the default stands for it, as for a plan that sets no value.
 */
async function resolution<T>(
  evaluation: () => Promise<ResolutionDetails<T>>,
  defaultValue: T
): Promise<{ value: T; failed: boolean }> {
  try {
    const details = await evaluation()
    if (!details.errorCode) return { value: details.value, failed: false }
    return { value: defaultValue, failed: details.errorCode !== ErrorCode.FLAG_NOT_FOUND }
  } catch (error) {
    const unknown = error instanceof OpenFeatureError && error.code === ErrorCode.FLAG_NOT_FOUND
    return { value: defaultValue, failed: !unknown }
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
    return resolved(() => this.evaluateNumber(key, defaultValue, context), defaultValue)
  }

  /**
   * Like `number`, and says whether the provider failed to answer, for a caller that must not
   * take the default for an answer, such as one that undoes something when a limit is gone.
   */
  numberResolution(
    key: string,
    defaultValue: number,
    context: CloudPolicyContext
  ): Promise<{ value: number; failed: boolean }> {
    return resolution(() => this.evaluateNumber(key, defaultValue, context), defaultValue)
  }

  private evaluateNumber(key: string, defaultValue: number, context: CloudPolicyContext) {
    return this.provider.resolveNumberEvaluation(
      key,
      defaultValue,
      evaluationContext(context),
      logger
    )
  }
}

export function createDefaultCloudPolicy(provider?: Provider): CloudPolicy {
  return new CloudPolicy(provider ?? new TypedInMemoryProvider(DEFAULT_FLAGS))
}
