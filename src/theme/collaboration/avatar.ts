import { tv } from 'tailwind-variants'

/** A person's initials on their color, in the avatar stack, presence lists, and mobile HUD. */
export const avatar = tv({
  base: 'flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white',
  variants: {
    size: { sm: 'size-6', md: 'size-7' },
    bordered: { true: 'border-2 border-panel', false: '' },
    following: { true: 'ring-2 ring-white/40', false: '' },
    /** A collaborator's avatar, which follows them when clicked. */
    interactive: { true: 'cursor-pointer transition-all', false: '' },
    /** In the voice call, and lit while speaking. */
    voice: {
      none: '',
      listening: 'ring-2 ring-success/45',
      speaking: 'ring-2 ring-success'
    }
  },
  compoundVariants: [{ following: true, bordered: true, class: 'border-white' }],
  defaultVariants: {
    size: 'sm',
    bordered: false,
    following: false,
    interactive: false,
    voice: 'none'
  }
})
