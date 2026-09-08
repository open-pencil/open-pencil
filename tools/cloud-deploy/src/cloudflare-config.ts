import { parse as parseJSONC, type ParseError, printParseErrorCode } from 'jsonc-parser'

import type { CloudDeploymentConfig } from '@open-pencil/cloud/server'

type JSONObject = { [key: string]: JSONValue }
type JSONValue = boolean | number | string | null | JSONValue[] | JSONObject

function isJSONObject(value: unknown): value is JSONObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseWrangler(source: string): JSONObject {
  const errors: ParseError[] = []
  const parsed: unknown = parseJSONC(source, errors, { allowTrailingComma: true })
  if (errors.length > 0) {
    const first = errors[0]
    throw new Error(
      `Invalid Wrangler JSONC: ${first ? printParseErrorCode(first.error) : 'unknown error'}`
    )
  }
  if (!isJSONObject(parsed)) throw new Error('Wrangler configuration must be an object')
  return parsed
}

function deploymentJSON(config: CloudDeploymentConfig): JSONObject {
  const value: unknown = structuredClone(config)
  if (!isJSONObject(value)) throw new Error('Deployment configuration is not serializable')
  return value
}

export function generateCloudflareConfig(
  deployment: CloudDeploymentConfig,
  wranglerSource: string,
  environmentName: string
): JSONObject {
  const wrangler = parseWrangler(wranglerSource)
  const environments = wrangler.env
  if (!isJSONObject(environments)) {
    throw new Error('Wrangler configuration does not define environments')
  }
  const target = environments[environmentName]
  if (!isJSONObject(target)) {
    throw new Error(`Wrangler environment is unavailable: ${environmentName}`)
  }
  const generated = structuredClone(wrangler)
  const generatedEnvironments = generated.env
  if (!isJSONObject(generatedEnvironments)) {
    throw new Error('Generated Wrangler environments are invalid')
  }
  generatedEnvironments[environmentName] = {
    ...target,
    vars: { OPENPENCIL_CLOUD_CONFIG: deploymentJSON(deployment) }
  }
  return generated
}
