export const DESIGN_JSX_MAX_SOURCE_BYTES = 256_000
export const DESIGN_JSX_MAX_OUTPUT_BYTES = 2_000_000
export const DESIGN_JSX_MAX_ELEMENTS = 5_000
export const DESIGN_JSX_MAX_DEPTH = 100
export const DESIGN_JSX_MAX_ARRAY_LENGTH = 5_000
export const DESIGN_JSX_MAX_OBJECT_KEYS = 1_000
export const DESIGN_JSX_MAX_STRING_LENGTH = 100_000
export const DESIGN_JSX_DEFAULT_TIMEOUT_MS = 1_000
export const DESIGN_JSX_DEFAULT_READY_TIMEOUT_MS = 5_000

export type DesignJSXValidationLimits = {
  outputBytes: number
  elements: number
  depth: number
  arrayLength: number
  objectKeys: number
  stringLength: number
}

export type DesignJSXSandboxLimits = {
  sourceBytes?: number
  outputBytes?: number
  elements?: number
  depth?: number
  arrayLength?: number
  objectKeys?: number
  stringLength?: number
  timeoutMs?: number
  readyTimeoutMs?: number
}

export function resolveDesignJSXValidationLimits(
  limits: DesignJSXSandboxLimits
): DesignJSXValidationLimits {
  return {
    outputBytes: limits.outputBytes ?? DESIGN_JSX_MAX_OUTPUT_BYTES,
    elements: limits.elements ?? DESIGN_JSX_MAX_ELEMENTS,
    depth: limits.depth ?? DESIGN_JSX_MAX_DEPTH,
    arrayLength: limits.arrayLength ?? DESIGN_JSX_MAX_ARRAY_LENGTH,
    objectKeys: limits.objectKeys ?? DESIGN_JSX_MAX_OBJECT_KEYS,
    stringLength: limits.stringLength ?? DESIGN_JSX_MAX_STRING_LENGTH
  }
}

export type DesignJSXHelperDescriptor = {
  __openPencilHelper: string
  args: unknown[]
}

export type DesignJSXSandboxResult = { ok: true; roots: unknown[] } | { ok: false; error: string }
