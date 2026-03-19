## Why

OpenPencil currently only supports an English interface, limiting the user experience for non-English speakers. To expand the user base, especially in China, Japan, Korea, and European markets, we need to add multilingual support. Users expect to use the interface in their native language, and desktop applications should automatically adapt to the system language.

## What Changes

- Add vue-i18n internationalization framework supporting 9 languages: English (default), Simplified Chinese, Traditional Chinese, French, Korean, Japanese, German, Italian, Russian
- Create language file directory `src/locales/`, organizing translation files by language code
- Implement browser/system language auto-detection, defaulting to English
- Add language switching UI component allowing users to manually select language
- Store language preference in localStorage, automatically applied on next visit
- Translate all UI text, including:
  - Menu items and keyboard shortcut hints
  - Toolbar labels and tooltips
  - Property panel labels and input hints
  - Dialog titles, buttons, and labels
  - Page and layer panel titles
  - Toast messages and error prompts
  - AI chat interface text

## Capabilities

### New Capabilities

- `i18n-framework`: Internationalization framework integration (vue-i18n configuration, language detection, language switching, language file organization)
- `i18n-translations`: UI text translation (translation strings for all components, covering 9 languages)

### Modified Capabilities

- `editor-ui`: Existing UI components need i18n integration, replacing hardcoded strings with `$t()` calls

## Impact

**Code Impact:**
- Add `src/locales/` directory containing translation files for each language
- Add `src/composables/use-i18n.ts` internationalization composable
- Add `src/components/LanguageSelector.vue` language selection component
- Modify all Vue components, replacing hardcoded text with `$t()` calls
- Modify `src/main.ts` to integrate vue-i18n plugin

**Dependency Impact:**
- Add `vue-i18n` dependency

**Storage Impact:**
- localStorage stores user language preference (key name: `openpencil-language`)

**User Experience Impact:**
- First visit automatically detects system language
- Users can switch languages at any time with immediate effect
- Language selection persists and is automatically applied on next visit