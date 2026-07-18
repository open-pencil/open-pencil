const collaborationTheme = {
  slots: {
    avatar:
      'flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white',
    peerAvatar: 'cursor-pointer transition-all',
    shareButton:
      'flex h-7 cursor-pointer items-center gap-1.5 rounded border-none px-3 text-[11px] font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent',
    presenceTrigger:
      'flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-panel/70 px-3 shadow-md backdrop-blur-xl outline-none select-none active:bg-hover focus-visible:ring-1 focus-visible:ring-accent',
    presenceDot: 'size-2 rounded-full bg-green-500',
    presenceContent: 'z-50 w-56 rounded-xl bg-panel p-3 shadow-[0_8px_30px_rgb(0_0_0/0.4)]',
    peerRow:
      'flex cursor-pointer items-center gap-2 rounded-md px-0.5 py-0.5 outline-none select-none active:bg-hover focus-visible:ring-1 focus-visible:ring-accent',
    disconnect:
      'mt-3 flex h-7 w-full cursor-pointer items-center justify-center rounded border border-border bg-transparent text-xs text-muted outline-none select-none active:bg-hover focus-visible:ring-1 focus-visible:ring-accent'
  },
  variants: {
    following: {
      true: { avatar: 'ring-2 ring-white/40' },
      false: {}
    },
    bordered: {
      true: { avatar: 'border-2 border-panel' },
      false: {}
    },
    connection: {
      idle: { shareButton: 'bg-accent text-white hover:bg-accent/90' },
      joining: {
        shareButton:
          'animate-pulse border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
      },
      connected: {
        shareButton:
          'bg-[var(--color-success-bg)] text-white hover:bg-[var(--color-success-bg-hover)]'
      }
    },
    size: {
      sm: { avatar: 'size-6' },
      md: { avatar: 'size-7' }
    }
  },
  compoundVariants: [
    {
      following: true,
      bordered: true,
      class: { avatar: 'border-white' }
    }
  ],
  defaultVariants: {
    following: false,
    bordered: false,
    connection: 'idle' as const,
    size: 'sm' as const
  }
}

export type CollaborationTheme = typeof collaborationTheme
export default collaborationTheme
