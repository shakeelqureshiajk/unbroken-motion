---
{
  "id": "brand-template",
  "name": "Example Brand",
  "colors": {
    "background": "#0B0F17",
    "surface": "#131A26",
    "surfaceElevated": "#1C2638",
    "primary": "#38BDF8",
    "secondary": "#818CF8",
    "accent": "#22D3EE",
    "textPrimary": "#F8FAFC",
    "textMuted": "#94A3B8",
    "border": "#2A364C",
    "onPrimary": "#06101B"
  },
  "typography": {
    "headingFont": "Segoe UI, Inter, system-ui, sans-serif",
    "bodyFont": "Segoe UI, Inter, system-ui, sans-serif",
    "monoFont": "Consolas, JetBrains Mono, monospace",
    "headingWeight": 700,
    "bodyWeight": 500
  },
  "geometry": {
    "radiusSm": 8,
    "radiusMd": 14,
    "radiusLg": 22,
    "borderWidth": 2
  },
  "logo": {
    "wordmark": "BrandName",
    "tagline": "Short brand promise",
    "markShape": "prism",
    "minClearSpaceRatio": 0.25
  },
  "motionPersonality": {
    "style": "snappy",
    "defaultCurve": "snappy",
    "cameraFloatIntensity": 0.35
  },
  "forbiddenColors": [
    "#FBF7F0",
    "#D96B43"
  ]
}
---

# Brand Guidelines: `<Brand Name>`

Copy this template to `references/brands/<brand-id>.md`. Keep the JSON frontmatter valid against `schema/brand.schema.json`.

## Rules
1. Never mix colors, fonts, logos, or corner radii from another brand file.
2. Add competing or foreign brand hex codes to `forbiddenColors` so Gate G7 catches accidental token leaks.
3. Keep `wordmark` clear space at least `minClearSpaceRatio * markWidth` around all four sides.
