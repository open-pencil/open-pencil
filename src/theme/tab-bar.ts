const tabBarTheme = {
  slots: {
    root: 'flex h-10 shrink-0 items-end bg-tab-bar',
    // Figma desktop's home button: the start page, fixed at the start of the bar and never a tab.
    // As wide as the navigation rail below it, so their edges line up.
    home: 'flex h-full w-12 shrink-0 cursor-pointer touch-manipulation items-center justify-center border-r border-tab-separator transition-colors outline-none focus-visible:ring-1 focus-visible:ring-panel-focus',
    homeIcon: 'size-4',
    // Sized by its tabs until the bar runs out of room; then it scrolls and fades the clipped side.
    scroller:
      'scrollbar-none h-full min-w-0 scroll-px-8 overflow-x-auto data-overflow-end:mask-r-from-[calc(100%-2rem)] data-overflow-start:mask-l-from-[calc(100%-2rem)]',
    list: 'flex h-full items-end',
    item: 'group/tab flex h-full max-w-60 min-w-32 items-center border-r border-tab-separator pr-3',
    trigger:
      'flex h-full min-w-0 cursor-pointer touch-manipulation items-center gap-2 px-3 text-xs transition-colors outline-none select-none focus-visible:ring-1 focus-visible:ring-panel-focus',
    icon: 'size-3.5 shrink-0',
    label: 'min-w-0 flex-1 truncate',
    close:
      'flex size-6 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded transition-opacity group-hover/tab:opacity-100 hover:bg-tab-separator focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-panel-focus sm:size-5',
    closeIcon: 'size-3.5',
    dirtyDot: 'size-1.5 shrink-0 rounded-full bg-accent',
    newTab:
      'flex size-6 shrink-0 cursor-pointer touch-manipulation items-center justify-center self-center rounded text-surface/70 transition-colors outline-none hover:bg-tab-separator hover:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus ms-1.75',
    newIcon: 'size-4',
    scroll:
      'flex size-6 shrink-0 cursor-pointer touch-manipulation items-center justify-center self-center rounded text-surface/70 transition-colors outline-none hover:bg-tab-separator hover:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus mx-0.5 data-start:order-first',
    scrollIcon: 'size-3.5'
  },
  variants: {
    active: {
      true: {
        item: 'bg-panel text-surface',
        trigger: 'bg-panel text-surface',
        home: 'bg-panel text-surface',
        // Figma tints the active file's icon blue.
        icon: 'text-primary',
        close: 'opacity-100'
      },
      false: {
        item: 'text-surface/70 hover:text-surface',
        trigger: 'text-surface/70 hover:text-surface',
        home: 'text-surface/70 hover:text-surface',
        icon: 'opacity-70',
        close: 'opacity-0'
      }
    }
  },
  defaultVariants: {
    active: false
  }
}

export type TabBarTheme = typeof tabBarTheme
export default tabBarTheme
