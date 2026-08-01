const presentationTheme = {
  slots: {
    stage: 'fixed inset-0 z-[200] flex flex-col bg-black',
    // Must be a flex container, not just `relative`: the canvas host below it sizes
    // itself with `flex-1` and its canvases are absolutely positioned, so a block
    // parent leaves it zero-height and the stage renders black.
    canvasHost: 'relative flex min-h-0 min-w-0 flex-1',
    // Transparent catcher sits above the canvas so clicks advance rather than select.
    // The cursor stays visible: it is how the presenter aims for the chrome band, and
    // it doubles as a pointer at the screen during a talk.
    catcher: 'absolute inset-0 z-10 cursor-default',
    /**
     * Full-bleed bar across the top edge, not a floating chip — matches how Figma frames a
     * presentation. The solid dark fill is measured off Figma's own bar, which reads
     * slightly lighter than the letterbox behind it rather than translucent.
     *
     * Taller than Figma's, and its content sits at the bottom, because reaching for this
     * bar in macOS fullscreen also summons the system menu bar and the browser's toolbar
     * over the top of the screen — about 42px between them. A bar the height of Figma's
     * would be entirely hidden underneath at the moment you went looking for it.
     */
    /**
     * The bar's fill is a separate element from its content, and carries the blend.
     *
     * `mix-blend-mode` applies to the whole element including its text, so the title would
     * be blended into the slide and become unreadable. It also has to sit outside a
     * `z-index`ed wrapper: an element that both creates a stacking context and blends is
     * isolated from the canvas behind it, and the blend silently does nothing.
     *
     * Multiply against a mid grey darkens whatever is underneath in proportion to itself,
     * so the slide stays visible through the bar — an image reads as a darkened image
     * rather than being covered — while a white slide still gets a clear band.
     */
    topBarFill:
      'pointer-events-none absolute inset-x-0 top-0 z-20 h-20 bg-[#4a4a4a] mix-blend-multiply transition-opacity duration-300',
    topBar:
      'pointer-events-none absolute inset-x-0 top-0 z-20 flex h-20 items-end gap-2 px-4 pb-2.5 transition-opacity duration-300',
    title: 'flex items-center gap-2 text-[12px] font-medium text-white/90',
    chrome:
      'pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-center p-4 transition-opacity duration-300',
    // Centred navigation pill, as Figma presents it: previous, position, next.
    pill: 'flex items-center gap-0.5 rounded-full bg-[#1e1e1e] px-1.5 py-1 shadow-lg',
    navButton:
      'flex size-7 cursor-pointer items-center justify-center rounded-full text-white/85 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-1 focus-visible:ring-white/60 disabled:cursor-default disabled:text-white/25 disabled:hover:bg-transparent',
    position: 'px-2 text-[12px] font-medium tabular-nums text-white/90',
    exit: 'absolute right-4 flex size-8 cursor-pointer items-center justify-center rounded-md bg-[#1e1e1e] text-white/90 outline-none hover:bg-white/15 hover:text-white focus-visible:ring-1 focus-visible:ring-white/60',
    presentButton:
      'flex h-7 cursor-pointer items-center gap-1.5 rounded border-none bg-transparent px-2 text-[11px] font-medium text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-1 focus-visible:ring-accent'
  },
  variants: {
    /**
     * The deck name, counter and exit button are presenter affordances, not part of the
     * slide. They surface together and fade together, so a projected deck is just the deck.
     * Hidden also means non-interactive — a faded control must not swallow the click that
     * should advance the slide.
     */
    chromeVisible: {
      true: {
        topBarFill: 'opacity-100',
        topBar: 'opacity-100',
        chrome: 'opacity-100',
        pill: 'pointer-events-auto',
        exit: 'pointer-events-auto'
      },
      false: {
        topBarFill: 'opacity-0',
        topBar: 'opacity-0',
        chrome: 'opacity-0',
        pill: 'pointer-events-none',
        exit: 'pointer-events-none'
      }
    }
  },
  defaultVariants: {
    chromeVisible: true
  }
}

export type PresentationTheme = typeof presentationTheme
export default presentationTheme
