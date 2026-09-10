export const modelPanelTransition = {
  enterActiveClass:
    'transition-[opacity,translate] duration-150 ease-out motion-reduce:transition-none',
  enterFromClass: 'opacity-0 translate-x-1 motion-reduce:translate-x-0',
  leaveActiveClass: 'transition-opacity duration-100 ease-in motion-reduce:transition-none',
  leaveToClass: 'opacity-0'
} as const
