# vitepress-docs — delta spec (seo-meta-og)

## Requirement: Open Graph image metadata

The docs site SHALL include `og:image`, `og:image:width`, `og:image:height`, and `og:image:alt` globally, pointing to `https://openpencil.dev/screenshot.png`.

### Scenario: OG image tag present on any page
- **WHEN** a crawler fetches any page on `openpencil.dev`
- **THEN** `<meta property="og:image" content="https://openpencil.dev/screenshot.png">` is in `<head>`

## Requirement: Twitter/X Card metadata

The docs site SHALL include `twitter:card` (value: `summary_large_image`), `twitter:site`, and `twitter:image` globally. Per-page `twitter:title` and `twitter:description` SHALL be injected from the page title and description.

### Scenario: Twitter card renders with large image
- **WHEN** a `openpencil.dev` URL is shared on X/Twitter
- **THEN** a large-image card is shown with the screenshot preview

## Requirement: og:site_name

The docs site SHALL include `<meta property="og:site_name" content="OpenPencil">` globally.

## Requirement: hreflang alternate links on every page

Every page SHALL include `<link rel="alternate" hreflang="...">` tags for all 6 language variants (en, de, fr, es, it, pl) plus `hreflang="x-default"` pointing to the EN version. The `x-default` href SHALL point to the English URL.

### Scenario: EN content page has all hreflang links
- **WHEN** crawler fetches `/guide/features`
- **THEN** hreflang links for en/de/fr/es/it/pl and x-default are all present in `<head>`

### Scenario: DE content page has correct hreflang
- **WHEN** crawler fetches `/de/guide/features`
- **THEN** hreflang links point to their respective locale URLs (e.g. de → `/de/guide/features`, en → `/guide/features`)

### Scenario: x-default always points to EN
- **WHEN** crawler fetches any locale page
- **THEN** `hreflang="x-default"` href is the English URL (no locale prefix)

## Requirement: og:locale and og:locale:alternate

Every page SHALL include `og:locale` matching the page language (e.g. `de_DE` for DE pages). All other locales SHALL be listed as `og:locale:alternate`.

### Scenario: DE page has correct og:locale
- **WHEN** crawler fetches `/de/guide/features`
- **THEN** `og:locale` is `de_DE` and other locales appear as `og:locale:alternate`

## Requirement: Per-page canonical URL

Every page SHALL have `<link rel="canonical">` with the full `https://openpencil.dev/<locale-prefix>/<slug>` URL. The canonical SHALL be locale-specific (DE pages have DE canonical).

### Scenario: DE page canonical is locale-specific
- **WHEN** crawler fetches `/de/guide/features`
- **THEN** canonical is `https://openpencil.dev/de/guide/features` (not the EN URL)

## Requirement: Per-page og:url

Every page SHALL have `<meta property="og:url">` matching the page's canonical URL.

## Requirement: Per-page og:title and og:description

Pages with a title SHALL have `og:title` set to `{title} — OpenPencil`. Pages with `description` frontmatter SHALL have `og:description`, `twitter:description`, and `meta name="description"` from it.

### Scenario: Content page OG title
- **WHEN** crawler fetches `/user-guide/canvas-navigation`
- **THEN** `og:title` is `Canvas Navigation — OpenPencil`

## Requirement: Sitemap with locale alternates

The docs site SHALL generate `sitemap.xml` with `<xhtml:link rel="alternate">` entries for all locale variants of each page.

### Scenario: Sitemap generated with alternates
- **WHEN** `bun run docs:build` completes
- **THEN** `sitemap.xml` exists and each URL entry contains `<xhtml:link>` alternates for all 6 locales

## Requirement: JSON-LD SoftwareApplication schema on EN homepage

The EN homepage SHALL include a `<script type="application/ld+json">` with `SoftwareApplication` schema: name, applicationCategory, operatingSystem, offers (free), url, description, screenshot, license. It SHALL NOT appear on locale homepages to avoid duplicate schema.

### Scenario: Structured data on EN homepage
- **WHEN** crawler fetches `https://openpencil.dev/`
- **THEN** a valid `SoftwareApplication` JSON-LD block is present

### Scenario: No duplicate schema on locale homepage
- **WHEN** crawler fetches `https://openpencil.dev/de/`
- **THEN** NO `SoftwareApplication` JSON-LD block is present

## Requirement: Translated title on locale homepages

Each locale homepage `index.md` SHALL have a translated `title` frontmatter field so the `<title>` tag is in the correct language.

### Scenario: DE homepage title in German
- **WHEN** browser opens `https://openpencil.dev/de/`
- **THEN** `<title>OpenPencil — KI-nativer Design-Editor | OpenPencil</title>` (or equivalent) is in `<head>`
