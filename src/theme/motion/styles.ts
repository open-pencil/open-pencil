export const motionStyles = {
  overlay:
    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-180 data-[state=open]:ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-120 data-[state=closed]:ease-in motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none',
  popup: 'animate-in fade-in zoom-in-95 motion-reduce:animate-none',
  spinner: 'animate-spin motion-reduce:animate-none',
  pulse: 'animate-pulse motion-reduce:animate-none'
} as const

export const feedbackTransition = {
  enterActiveClass: 'animate-in fade-in duration-150 motion-reduce:animate-none',
  leaveActiveClass: 'animate-out fade-out duration-150 motion-reduce:animate-none'
} as const
