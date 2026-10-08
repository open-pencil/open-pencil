import { tv } from 'tailwind-variants'

/** The icon colour of a problem's severity, shared by the design check and property limits. */
export const severityIcon = tv({
  base: 'size-3 shrink-0',
  variants: {
    severity: {
      error: 'text-issue-error',
      warning: 'text-issue-warning',
      info: 'text-issue-info'
    }
  }
})
