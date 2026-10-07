export const motionStyles = {
  overlay:
    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-180 data-[state=open]:ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-120 data-[state=closed]:ease-in motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none',
  popup: 'animate-in fade-in zoom-in-95 motion-reduce:animate-none',
  /**
   * Popovers, menus, selects, and pickers grow in from the side they open on and close at once:
   * a fading-out modal menu would still block the canvas and shortcuts until it unmounts.
   */
  floating:
    'animate-in fade-in-0 zoom-in-95 duration-150 ease-out data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 motion-reduce:animate-none',
  spinner: 'animate-spin motion-reduce:animate-none',
  pulse: 'animate-pulse motion-reduce:animate-none'
} as const

/** A detail view sliding in over its list and back out the way it came. */
export const drillInTransition = {
  enterActiveClass:
    'transition-[opacity,translate] duration-150 ease-out motion-reduce:transition-none',
  enterFromClass: 'translate-x-3 opacity-0 motion-reduce:translate-x-0',
  leaveActiveClass:
    'transition-[opacity,translate] duration-100 ease-in motion-reduce:transition-none',
  leaveToClass: 'translate-x-3 opacity-0 motion-reduce:translate-x-0'
} as const

/** One view replacing another in place, such as an inspector switching to another item. */
export const swapTransition = {
  enterActiveClass: 'transition-opacity duration-150 ease-out motion-reduce:transition-none',
  enterFromClass: 'opacity-0',
  leaveActiveClass: 'transition-opacity duration-75 ease-in motion-reduce:transition-none',
  leaveToClass: 'opacity-0'
} as const

export const feedbackTransition = {
  enterActiveClass: 'animate-in fade-in duration-150 motion-reduce:animate-none',
  leaveActiveClass: 'animate-out fade-out duration-150 motion-reduce:animate-none'
} as const
