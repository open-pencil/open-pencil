## Context

OpenPencil is a design editor built with Vue 3 + Tauri. Currently, all UI text is hardcoded in components. We need to introduce an internationalization framework to support 9 languages, with automatic language detection and manual user switching.

**Current Constraints:**
- Vue 3 Composition API + `<script setup>`
- Using TypeScript
- Supports both Tauri desktop and browser environments
- Existing localStorage storage mechanism (e.g., auto-save settings)

**Stakeholders:**
- Global users (non-native English speakers)
- Developers (need to maintain translation files)

## Goals / Non-Goals

**Goals:**
- Support 9 languages: en, zh-CN, zh-TW, fr, ko, ja, de, it, ru
- Automatically detect system/browser language, default to English
- Allow users to manually switch languages with persistent preference
- Translate all UI text (menus, panels, dialogs, tooltips, etc.)
- Make translation files easy to maintain and extend

**Non-Goals:**
- Do not translate user-created design content (e.g., text node content)
- Do not translate code generation output
- Do not implement RTL (right-to-left) layout support
- Do not add translation management platform integration

## Decisions

### 1. Internationalization Framework Selection: vue-i18n

**Choice**: vue-i18n

**Rationale**:
- Official Vue 3 recommended i18n solution
- Supports both Composition API and Options API
- Built-in pluralization, date, and number formatting
- Supports lazy loading of translation files
- Actively maintained with mature community

**Alternatives**:
- `intlify` (vue-i18n core): Too low-level, requires more configuration
- Custom solution: Reinventing the wheel, lacks advanced features like pluralization

### 2. Translation File Organization: Split by Language

**Choice**: One JSON file per language

```
src/locales/
├── en.json        # English (base translation)
├── zh-CN.json     # Simplified Chinese
├── zh-TW.json     # Traditional Chinese
├── fr.json        # French
├── ko.json        # Korean
├── ja.json        # Japanese
├── de.json        # German
├── it.json        # Italian
└── ru.json        # Russian
```

**Rationale**:
- Translators can focus on a single file
- Easy to add new languages (just add a new file)
- Flat file structure, easy to maintain

**Alternatives**:
- Split by feature module (e.g., `menu.json`, `toolbar.json`): Increases management complexity, language files scattered
- YAML format: JSON integrates better with Vue ecosystem

### 3. Translation Key Naming Convention

**Choice**: Hierarchical naming based on component path

```json
{
  "menu": {
    "file": {
      "new": "New",
      "open": "Open…",
      "save": "Save"
    }
  },
  "toolbar": {
    "tool": {
      "select": "Move",
      "frame": "Frame"
    }
  },
  "properties": {
    "design": "Design",
    "code": "Code",
    "ai": "AI"
  }
}
```

**Rationale**:
- Clear semantics, easy to locate
- Avoids naming conflicts
- Supports batch loading (e.g., `$t('menu.file')`)

### 4. Language Detection Strategy

**Choice**: System language priority with user preference persistence

1. First check localStorage `openpencil-language`
2. If not found, detect `navigator.language` (browser) or Tauri system language
3. Map to supported language list, default to `en` if no match
4. Language mapping rules:
   - `zh`, `zh-CN`, `zh-Hans` → `zh-CN`
   - `zh-TW`, `zh-HK`, `zh-Hant` → `zh-TW`
   - Others match exactly (e.g., `ja` → `ja`)

**Rationale**:
- User choice takes priority (respect personal preference)
- Auto-adapts to system (good first-time experience)
- Language mapping handles variants (e.g., Simplified/Traditional Chinese conversion)

### 5. Language Switching UI

**Choice**: Add "Language" submenu in AppMenu

**Rationale**:
- Menu is the natural location for settings options
- Doesn't occupy toolbar space
- Matches desktop application conventions

**Alternatives**:
- Settings dialog: Adds interaction hierarchy
- Toolbar button: Takes up design space

### 6. Type Safety

**Choice**: Use `vue-i18n` Schema types + TypeScript

```typescript
// Type for src/locales/en.json
export interface LocaleSchema {
  menu: {
    file: { new: string; open: string; ... }
    ...
  }
  ...
}
```

**Rationale**:
- Compile-time check for translation key existence
- IDE autocomplete support
- Refactoring safety

## Risks / Trade-offs

**[Risk] Translation file bloat** → On-demand loading
- Large application translation files can reach hundreds of KB
- Mitigation: vue-i18n supports lazy loading, can optimize later

**[Risk] Incomplete translations** → Fallback mechanism
- Some languages may lack translations
- Mitigation: vue-i18n supports fallback to English (`fallbackLocale: 'en'`)

**[Risk] Translation maintenance cost** → Automated detection
- New UI text may be added without translations
- Mitigation: Add lint rules to detect missing keys (future)

**[Risk] Language switching timing** → Immediate effect
- Language switch requires re-rendering all text
- Mitigation: Vue reactivity system handles this automatically, acceptable performance

**[Trade-off] Not using online translation platform**
- Cannot collaborate on translations, no version management
- Accepted: Not needed at current scale, can migrate to Crowdin/Transifex in the future