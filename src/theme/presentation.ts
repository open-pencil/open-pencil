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
    /**
     * Full-bleed bar across the top edge, not a floating chip — matches how Figma frames a
     * presentation.
     *
     * Taller than Figma's, and its content sits at the bottom, because reaching for this
     * bar in macOS fullscreen also summons the system menu bar and the browser's toolbar
     * over the top of the screen — about 42px between them. A bar the height of Figma's
     * would be entirely hidden underneath at the moment you went looking for it.
     */
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
    /**
     * Driving controls in the presenter's own window, floated over the canvas above the
     * toolbar. The editor behind them is already the presenter layout — filmstrip, slide
     * and notes — so this adds only the controls and the way out.
     */
    presenterBar:
      'absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-[#1e1e1e] px-1.5 py-1 shadow-lg',
    presenterDivider: 'mx-1 h-5 w-px bg-white/15',
    // Replaces the properties panel while presenting: notes for the slide the audience sees.
    presenterPanel: 'flex min-h-0 flex-1 flex-col',
    presenterPanelBody: 'scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4',
    presenterNotesText: 'text-[13px] leading-relaxed whitespace-pre-wrap text-surface',
    presenterNotesEmpty: 'text-[15px] leading-relaxed text-muted',
    presenterPanelFooter: 'flex shrink-0 items-center justify-between border-t border-border p-2',
    presenterEdit:
      'flex h-7 cursor-pointer items-center gap-1.5 rounded border border-border bg-transparent px-2 text-[11px] font-medium text-surface outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-accent',
    // Mode picker. Two equal columns so neither mode reads as the secondary one.
    pickerContent: 'z-[100] grid w-[34rem] grid-cols-2 gap-px overflow-hidden rounded-xl bg-border',
    pickerOption:
      'flex cursor-pointer flex-col items-start gap-2 border-none bg-panel p-4 text-left outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-inset disabled:cursor-default disabled:opacity-50',
    pickerTitle: 'text-[13px] font-semibold text-surface',
    pickerShortcut: 'text-[11px] text-muted',
    pickerDescription: 'text-[11px] leading-snug text-muted',
    /**
     * Preview of the arrangement, not of the deck: one screen, or two.
     *
     * Composed from elements rather than an SVG or a bitmap — steiger rejects raw SVG in
     * app components, and a screenshot would go stale the moment the chrome changed.
     */
    pickerPreview:
      'relative mb-1 flex h-24 w-full items-center justify-center rounded-lg bg-canvas',
    pickerScreen: 'rounded-[3px] border border-border bg-surface/90 shadow-sm',
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
