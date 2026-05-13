# Feature Spec: Asset Library Import

**Date:** 2026-05-13  
**Status:** Implemented  
**Phase:** 3

## Summary

Allow users to bulk-import asset definitions from JSON or CSV files into a reusable asset library. Imported assets can then be used across threat models.

## Backend

### Migration `013_asset_library.js`

Creates `assets_library` table:

| Column | Type |
|---|---|
| id | UUID PK |
| org_id | UUID |
| name | string NOT NULL |
| kind | string NOT NULL |
| description | text |
| properties | JSONB |
| created_by | UUID FK → users |
| created_at / updated_at | timestamp |

### Controller `assetLibraryController.js`

- **`POST /api/assets/import`** — Accepts `{data: string, format: 'json'|'csv'}`. Parses input, validates each row against stencil kinds, batch inserts valid assets, returns `{imported, skipped, errors}`.
- **`GET /api/assets/library`** — Lists all library assets for the org.
- **`DELETE /api/assets/library/:id`** — Deletes a single library asset.

### Valid Kinds

~40 stencil kinds defined in `ct.client/src/components/Canvas/assets/stencil.ts` (server, db, fw, lb, waf, cdn, oci-instance, oci-db, oci-bucket, alibaba-ecs, trust-boundary, etc.)

## Frontend

### Importer `assetListImporter.ts`

- `parseAssetJSON(text)` — Parses JSON array of objects, validates name/kind fields.
- `parseAssetCSV(text)` — Parses CSV with `name,kind,description` columns.
- Both return `ImportAssetsResult { assets, stats: {valid, skipped}, warnings }`.

### API Client `api/assets.ts`

- `importAssets(data, format)` — POST to `/api/assets/import`
- `getAssetLibrary()` — GET `/api/assets/library`
- `deleteAsset(id)` — DELETE `/api/assets/library/:id`

### Component `AssetImportModal.tsx`

Modal with:
- Drag-and-drop file upload zone
- JSON/CSV format toggle
- Text area for paste input
- Preview table showing parsed assets with warnings
- Import button with loading state