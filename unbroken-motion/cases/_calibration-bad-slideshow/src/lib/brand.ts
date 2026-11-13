import type { BrandTokens } from './types.ts';

/**
 * Extracts and parses the JSON frontmatter from a references/brands/<brand>.md file.
 */
export function parseBrandMarkdown(markdown: string): BrandTokens {
  const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error('Brand file is missing --- JSON frontmatter --- block.');
  }

  const parsed = JSON.parse(match[1]) as BrandTokens;
  if (!parsed.id || !parsed.colors || !parsed.typography || !parsed.geometry) {
    throw new Error('Brand frontmatter missing required token groups.');
  }
  return parsed;
}

export function collectBrandPalette(brand: BrandTokens): Set<string> {
  const palette = new Set<string>();
  for (const hex of Object.values(brand.colors)) {
    palette.add(hex.toUpperCase());
  }
  return palette;
}

export function isAllowedBrandColor(hex: string, brand: BrandTokens): boolean {
  const upper = hex.trim().toUpperCase();
  const forbidden = new Set(brand.forbiddenColors.map((c) => c.toUpperCase()));
  if (forbidden.has(upper)) return false;
  return collectBrandPalette(brand).has(upper);
}
