export const DESIGN_JSX_MAX_SOURCE_BYTES = 256_000
export const DESIGN_JSX_MAX_OUTPUT_BYTES = 2_000_000
export const DESIGN_JSX_MAX_ELEMENTS = 5_000
export const DESIGN_JSX_MAX_DEPTH = 100
export const DESIGN_JSX_DEFAULT_TIMEOUT_MS = 1_000

export type DesignJSXSandboxLimits = {
  sourceBytes?: number
  outputBytes?: number
  elements?: number
  depth?: number
  timeoutMs?: number
}

export type DesignJSXSandboxResult = { ok: true; roots: unknown[] } | { ok: false; error: string }
