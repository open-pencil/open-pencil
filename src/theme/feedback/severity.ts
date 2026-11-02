/** The icon colour of a problem's severity, shared by the design check and property limits. */
export default {
  base: 'size-3 shrink-0',
  variants: {
    severity: {
      error: 'text-error',
      warning: 'text-warning',
      info: 'text-muted'
    }
  }
} as const
