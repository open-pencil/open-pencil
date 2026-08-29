import { readFileSync } from 'node:fs'

export interface VisualOracleTarget {
  page: string
  node: string
  figmaNodeId: string
  openPencilNodeId?: string
  scale?: number
  fuzz?: string
  maximumDifferentPercent?: number
  expectedWidth?: number
  expectedHeight?: number
  minimumPageRoots?: number
}

export interface VisualOracleManifest {
  document: string
  appURL: string
  output?: string
  targets: VisualOracleTarget[]
}

const OPTIONAL_STRING_FIELDS = ['openPencilNodeId', 'fuzz'] as const
const OPTIONAL_NUMBER_FIELDS = [
  'scale',
  'maximumDifferentPercent',
  'expectedWidth',
  'expectedHeight',
  'minimumPageRoots'
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requiredString(record: Record<string, unknown>, field: string, context: string): string {
  const value = record[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${context} requires a non-empty ${field} string`)
  }
  return value
}

function parseTarget(value: unknown, index: number): VisualOracleTarget {
  if (!isRecord(value)) throw new Error(`Visual oracle target ${index} must be an object`)
  const target: VisualOracleTarget = {
    page: requiredString(value, 'page', `Visual oracle target ${index}`),
    node: requiredString(value, 'node', `Visual oracle target ${index}`),
    figmaNodeId: requiredString(value, 'figmaNodeId', `Visual oracle target ${index}`)
  }
  for (const field of OPTIONAL_STRING_FIELDS) {
    const fieldValue = value[field]
    if (fieldValue === undefined) continue
    if (typeof fieldValue !== 'string') throw new TypeError(`${field} must be a string`)
    target[field] = fieldValue
  }
  for (const field of OPTIONAL_NUMBER_FIELDS) {
    const fieldValue = value[field]
    if (fieldValue === undefined) continue
    if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) {
      throw new TypeError(`${field} must be a finite number`)
    }
    target[field] = fieldValue
  }
  return target
}

export function readVisualOracleManifest(path: string): VisualOracleManifest {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!isRecord(parsed)) throw new TypeError('Visual oracle manifest must be an object')
  const targets = parsed.targets
  if (!Array.isArray(targets)) {
    throw new TypeError('Visual oracle manifest requires a targets array')
  }
  const manifest: VisualOracleManifest = {
    document: requiredString(parsed, 'document', 'Visual oracle manifest'),
    appURL: requiredString(parsed, 'appURL', 'Visual oracle manifest'),
    targets: targets.map(parseTarget)
  }
  if (parsed.output !== undefined) {
    if (typeof parsed.output !== 'string') throw new TypeError('output must be a string')
    manifest.output = parsed.output
  }
  return manifest
}
