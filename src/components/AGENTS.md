# App UI

`src/components/ui/**` is generic, store-free design-system code grouped by family: `{button,input,select,toggle,dialog,panel,binding,feedback,overlay,menu,paint}/`. Do not create a folder named after a single component. Feature controls stay in their domain. Theme families mirror these under `src/theme/`; feature themes stay separate. Use explicit imports without old-path forwarding shims.

## Building blocks

- Use Reka UI primitives and typed Tailwind Variants themes under `src/theme/**`; merge per-instance `ui` slot overrides, expose `class` for single-root components, and do not add one-off class props. Use `UI` casing in type names. App wrappers around SDK primitives use shared UI helpers rather than scattered raw classes.
- Tailwind 4 and `tw-animate-css`; no static inline styling or component `<style>` blocks. Dynamic `:style` bindings are allowed for runtime geometry and CSS variables.
- Bind visual state through semantic `data-*` attributes. Steiger rejects template-time `use*UI()`, visual-state utility branches, and raw SVG app icons.
- `Tip`, not native `title`; Lucide/Iconify components, not raw SVG or Unicode icons; `e.code`, not `e.key`, for modified shortcuts.
- App dialogs compose the Reka-backed components under `src/components/ui/dialog/` and the typed theme in `src/theme/dialog.ts`. Do not repeat portal, overlay, content, header, or footer infrastructure in feature dialogs.
- SDK property primitives, binding fields, commands, and i18n: `packages/vue/AGENTS.md`.

## Settings

- Compose Settings sections with `SettingsSection` and its `title`, `description`, `actions`, and default content slots. It owns heading association and internal spacing; `SettingsGroup` owns bordered row grouping. Do not repeat section, header, or spacing markup per feature.
- Settings components own layout, translated copy, confirmation visibility, and emits; small presentation-only computed bindings may stay in components. Workflows, persistence, and credentials: `src/AGENTS.md`.
- `SettingsSaveFeedback` maps domain outcomes (`saved`, `failed`, `partial`) to `AppAlert`. `SettingsLink` owns external-link styling, the icon, and native opening for provider key pages and setup guides; keep arrow glyphs out of translated labels.

## Feedback and forms

- `AppAlert` (`src/components/ui/feedback/AppAlert.vue`, theme `src/theme/feedback/alert.ts`) for persistent contextual errors, warnings, recovery guidance, and informative results, with translated `heading`/`description` and an `actions` slot. Do not hand-roll alert markup or colored error paragraphs. Alerts announce changes without taking keyboard focus.
- The toast service is for transient confirmations such as copying or completing an action after its view closes. Never show a toast and an alert for the same event; partial saves and actionable failures must not disappear in a toast.
- Field validation stays inline in the shared field component with `aria-invalid`, error text before hints, and first-invalid-field focus.
- Ordinary labels such as Running/Stopped remain status text or badges. Destructive confirmation belongs in the shared confirmation dialog.

## Animations

- Tailwind transitions and `tw-animate-css` for simple state changes and enter/exit; the existing `motion-v` dependency for gesture-driven motion, coordinated layout changes, and springs. Do not add another animation library.
- Store-free presets live in `src/theme/motion/` and compose into owning themes; keep what moves, geometry, and feature-specific spring values local. Share repeated duration and easing values. Policy resolution: `src/AGENTS.md` (Shell).
- Collapsibles use Reka state attributes and measured CSS variables with `animate-collapsible-down` / `animate-collapsible-up`; keep padding and borders inside the animated height wrapper.
- Respect `prefers-reduced-motion` in CSS and Motion; simplify nonessential motion while preserving state changes and feedback. Verify opening, closing, interrupted transitions, reduced motion, and scroll behavior. Expanding historical chat content must not force the transcript to the bottom.

## Storybook

- Colocate `ComponentName.stories.ts` with `ComponentName.vue`; multipart compositions may use a descriptive family name. Preserve explicit titles and exported story names during moves. Default playgrounds stay static; interaction flows get named stories. Use deterministic fixtures and colocated Vue demos for substantial markup.
- Isolated visual states of feedback components belong in stories, not Playwright application screenshots. Do not add automated tests or snapshot baselines for CSS-only changes (spacing, sizing, colors, breakpoints); verify those visually. Settings E2E covers integration behavior: feedback appearance, validation and focus, retained drafts, successful retries.
