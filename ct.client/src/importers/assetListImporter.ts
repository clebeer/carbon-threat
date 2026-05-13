/**
 * Asset List Importer
 *
 * Parses JSON and CSV text into a normalized asset array.
 * Follows the same pattern as drawioImporter.ts / gliffyImporter.ts.
 */

export interface ImportedAsset {
  name: string;
  kind: string;
  description: string;
  properties: Record<string, unknown>;
}

export interface ImportAssetsResult {
  assets: ImportedAsset[];
  stats: {
    total: number;
    valid: number;
    skipped: number;
  };
  warnings: string[];
}

/**
 * Parse a JSON string into an asset list.
 * Accepts:
 *   - Array of objects with name/kind/description/properties
 *   - Object with an "assets" key containing the array
 */
export function parseAssetJSON(text: string): ImportAssetsResult {
  const warnings: string[] = [];
  let raw: unknown[];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      raw = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).assets)) {
      raw = (parsed as { assets: unknown[] }).assets;
    } else {
      return { assets: [], stats: { total: 0, valid: 0, skipped: 0 }, warnings: ['JSON must be an array or object with "assets" key'] };
    }
  } catch {
    return { assets: [], stats: { total: 0, valid: 0, skipped: 0 }, warnings: ['Invalid JSON syntax'] };
  }

  const assets: ImportedAsset[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;
    const name = String(item.name || item.Name || item.label || item.Label || '').trim();

    if (!name) {
      warnings.push(`Row ${i + 1}: missing name, skipped`);
      continue;
    }

    assets.push({
      name,
      kind: String(item.kind || item.type || item.Kind || item.Type || 'server').trim(),
      description: String(item.description || item.desc || item.Description || '').trim(),
      properties: (item.properties || item.metadata || item.Properties || {}) as Record<string, unknown>,
    });
  }

  return {
    assets,
    stats: { total: raw.length, valid: assets.length, skipped: raw.length - assets.length },
    warnings,
  };
}

/**
 * Parse a CSV string into an asset list.
 * First row is treated as headers.
 * Supported headers: name/Name/label/Label, kind/type/Kind/Type, description/Description/desc, properties/metadata
 */
export function parseAssetCSV(text: string): ImportAssetsResult {
  const warnings: string[] = [];
  const lines = text.trim().split(/\r?\n/);

  if (lines.length < 2) {
    return { assets: [], stats: { total: 0, valid: 0, skipped: 0 }, warnings: ['CSV must have at least a header and one data row'] };
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const assets: ImportedAsset[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim().replace(/^"|"$/g, '');
    });

    const name = (row.name || row.label || '').trim();
    if (!name) {
      warnings.push(`Row ${i + 1}: missing name, skipped`);
      continue;
    }

    assets.push({
      name,
      kind: (row.kind || row.type || 'server').trim(),
      description: (row.description || row.desc || '').trim(),
      properties: {},
    });
  }

  return {
    assets,
    stats: { total: lines.length - 1, valid: assets.length, skipped: lines.length - 1 - assets.length },
    warnings,
  };
}