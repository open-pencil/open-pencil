## ADDED Requirements

### Requirement: Documentation available in 5 additional languages

The docs site SHALL provide translations of user-facing pages in German (de), Italian (it), French (fr), Spanish (es), and Polish (pl).

#### Scenario: Navigating to German docs
- **WHEN** user selects "Deutsch" from language switcher
- **THEN** site displays translated pages under `/de/` path

#### Scenario: Translated landing page
- **WHEN** user visits `/fr/`
- **THEN** French landing page with translated hero text and feature cards is shown

#### Scenario: Translated user guide
- **WHEN** user navigates to `/es/user-guide/`
- **THEN** Spanish translations of all user guide articles are available

### Requirement: Directory-per-locale structure

Each locale SHALL have its own directory under `packages/docs/` mirroring the English page structure.

#### Scenario: Locale directories exist
- **WHEN** build runs
- **THEN** `packages/docs/de/`, `it/`, `fr/`, `es/`, `pl/` directories contain translated .md files

### Requirement: VitePress locale configuration

The `.vitepress/config.ts` SHALL define locales with translated labels, nav, and sidebar.

#### Scenario: Language switcher visible
- **WHEN** user opens any docs page
- **THEN** a language dropdown appears in the nav with English, Deutsch, Italiano, Français, Español, Polski

#### Scenario: Sidebar translated
- **WHEN** user browses German docs
- **THEN** sidebar group labels and item names are in German
