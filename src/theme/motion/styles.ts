export const motionStyles = {
  overlay:
    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-180 data-[state=open]:ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-120 data-[state=closed]:ease-in motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none',
  popup: 'animate-in fade-in zoom-in-95 motion-reduce:animate-none',
  /**
   * Menus, selects, and popovers grow out of their trigger's side. They close at once: while an
   * exit animation ran, the closing content kept focus and swallowed shortcuts such as undo.
   */
  floating:
    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-150 data-[state=open]:ease-out data-[side=bottom]:origin-top data-[side=bottom]:slide-in-from-top-1 data-[side=top]:origin-bottom data-[side=top]:slide-in-from-bottom-1 data-[side=left]:origin-right data-[side=left]:slide-in-from-right-1 data-[side=right]:origin-left data-[side=right]:slide-in-from-left-1 motion-reduce:data-[state=open]:animate-none',
  spinner: 'animate-spin motion-reduce:animate-none',
  pulse: 'animate-pulse motion-reduce:animate-none'
} as const

export const feedbackTransition = {
  enterActiveClass: 'animate-in fade-in duration-150 motion-reduce:animate-none',
  leaveActiveClass: 'animate-out fade-out duration-150 motion-reduce:animate-none'
} as const
