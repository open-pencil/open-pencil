import { CLOUD_PROTOCOL_MAX_UPLOAD_BYTES } from '#cloud/server/config'
import {
  OpenFeature,
  TypedInMemoryProvider,
  type Client,
  type EvaluationContext,
  type Provider
} from '@openfeature/server-sdk'

import { CLOUD_FEATURE_KEYS, type CloudPolicyContext } from './keys'

const DEFAULT_FLAGS = {
  [CLOUD_FEATURE_KEYS.capabilityLinks]: {
    variants: { enabled: true, disabled: false },
    defaultVariant: 'enabled',
    disabled: false
  },
  [CLOUD_FEATURE_KEYS.anonymousView]: {
    variants: { enabled: true, disabled: false },
    defaultVariant: 'enabled',
    disabled: false
  },
  [CLOUD_FEATURE_KEYS.anonymousEdit]: {
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

export class CloudPolicy {
  constructor(private readonly client: Client) {}

  boolean(key: string, defaultValue: boolean, context: CloudPolicyContext): Promise<boolean> {
    return this.client.getBooleanValue(key, defaultValue, evaluationContext(context))
  }

  number(key: string, defaultValue: number, context: CloudPolicyContext): Promise<number> {
    return this.client.getNumberValue(key, defaultValue, evaluationContext(context))
  }
}

export function createDefaultCloudPolicy(provider?: Provider): CloudPolicy {
  const domain = `openpencil-cloud-${crypto.randomUUID()}`
  OpenFeature.setProvider(domain, provider ?? new TypedInMemoryProvider(DEFAULT_FLAGS))
  return new CloudPolicy(OpenFeature.getClient(domain))
}
