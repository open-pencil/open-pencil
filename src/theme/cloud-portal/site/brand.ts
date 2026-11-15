/** The site's name with its mark, or a self-hosted operator's logo, as openpencil.dev shows it. */
export default {
  slots: {
    root: 'flex min-w-0 items-center gap-2',
    mark: 'size-6 shrink-0',
    logo: 'h-7 w-auto max-w-40 shrink-0 object-contain',
    name: 'min-w-0 truncate text-base font-semibold tracking-tight'
  }
} as const
