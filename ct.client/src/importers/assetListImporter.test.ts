/**
 * Tests for Asset List Importer (JSON/CSV)
 */
import { describe, it, expect } from 'vitest';
import { parseAssetJSON, parseAssetCSV } from './assetListImporter';

// ── parseAssetJSON ──────────────────────────────────────────────────────────

describe('parseAssetJSON', () => {
  it('parses a JSON array of assets', () => {
    const input = JSON.stringify([
      { name: 'Web Server', kind: 'server', description: 'Main web server' },
      { name: 'Postgres DB', kind: 'db', description: 'Primary database' },
    ]);

    const result = parseAssetJSON(input);
    expect(result.assets).toHaveLength(2);
    expect(result.stats.total).toBe(2);
    expect(result.stats.valid).toBe(2);
    expect(result.stats.skipped).toBe(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.assets[0].name).toBe('Web Server');
    expect(result.assets[0].kind).toBe('server');
    expect(result.assets[1].name).toBe('Postgres DB');
    expect(result.assets[1].kind).toBe('db');
  });

  it('parses an object with "assets" key', () => {
    const input = JSON.stringify({
      assets: [
        { name: 'Firewall', kind: 'fw' },
      ],
    });

    const result = parseAssetJSON(input);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].name).toBe('Firewall');
  });

  it('supports alternative field names (Name, Kind, label, Type)', () => {
    const input = JSON.stringify([
      { Name: 'Asset A', Kind: 'server' },
      { label: 'Asset B', Type: 'db' },
    ]);

    const result = parseAssetJSON(input);
    expect(result.assets).toHaveLength(2);
    expect(result.assets[0].name).toBe('Asset A');
    expect(result.assets[0].kind).toBe('server');
    expect(result.assets[1].name).toBe('Asset B');
    expect(result.assets[1].kind).toBe('db');
  });

  it('defaults kind to "server" when not specified', () => {
    const input = JSON.stringify([
      { name: 'Mystery Asset' },
    ]);

    const result = parseAssetJSON(input);
    expect(result.assets[0].kind).toBe('server');
  });

  it('supports description via "desc" and "Description"', () => {
    const input = JSON.stringify([
      { name: 'A', desc: 'Short desc' },
      { name: 'B', Description: 'Long desc' },
    ]);

    const result = parseAssetJSON(input);
    expect(result.assets[0].description).toBe('Short desc');
    expect(result.assets[1].description).toBe('Long desc');
  });

  it('preserves properties/metadata objects', () => {
    const input = JSON.stringify([
      { name: 'S1', properties: { ip: '10.0.0.1', port: 443 } },
      { name: 'S2', metadata: { region: 'us-east-1' } },
    ]);

    const result = parseAssetJSON(input);
    expect(result.assets[0].properties).toEqual({ ip: '10.0.0.1', port: 443 });
    expect(result.assets[1].properties).toEqual({ region: 'us-east-1' });
  });

  it('skips rows with missing name and adds warning', () => {
    const input = JSON.stringify([
      { kind: 'server' },
      { name: 'Valid', kind: 'db' },
    ]);

    const result = parseAssetJSON(input);
    expect(result.assets).toHaveLength(1);
    expect(result.stats.total).toBe(2);
    expect(result.stats.valid).toBe(1);
    expect(result.stats.skipped).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Row 1');
  });

  it('returns warning for non-array non-object JSON', () => {
    const input = '"just a string"';
    const result = parseAssetJSON(input);
    expect(result.assets).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('array');
  });

  it('returns warning for invalid JSON', () => {
    const result = parseAssetJSON('{ not valid json }}}');
    expect(result.assets).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Invalid JSON');
  });

  it('handles empty array', () => {
    const result = parseAssetJSON('[]');
    expect(result.assets).toHaveLength(0);
    expect(result.stats.total).toBe(0);
  });
});

// ── parseAssetCSV ───────────────────────────────────────────────────────────

describe('parseAssetCSV', () => {
  it('parses a simple CSV with headers', () => {
    const csv = `name,kind,description
"Web Server",server,"Main web server"
"Postgres DB",db,"Primary database"`;

    const result = parseAssetCSV(csv);
    expect(result.assets).toHaveLength(2);
    expect(result.stats.total).toBe(2);
    expect(result.stats.valid).toBe(2);
    expect(result.assets[0].name).toBe('Web Server');
    expect(result.assets[0].kind).toBe('server');
    expect(result.assets[0].description).toBe('Main web server');
    expect(result.assets[1].name).toBe('Postgres DB');
  });

  it('supports label/type alternative headers', () => {
    const csv = `label,type
"Asset A",fw`;

    const result = parseAssetCSV(csv);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].name).toBe('Asset A');
    expect(result.assets[0].kind).toBe('fw');
  });

  it('defaults kind to "server" when column missing', () => {
    const csv = `name
Unnamed`;

    const result = parseAssetCSV(csv);
    expect(result.assets[0].kind).toBe('server');
  });

  it('handles quoted CSV values', () => {
    const csv = `name,kind,description
"Web Server","server","A, B, C description"`;

    const result = parseAssetCSV(csv);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].name).toBe('Web Server');
    expect(result.assets[0].description).toBe('A, B, C description');
  });

  it('handles Windows-style CRLF line endings', () => {
    const csv = `name,kind\r\nServer1,server\r\nServer2,db\r\n`;
    const result = parseAssetCSV(csv);
    expect(result.assets).toHaveLength(2);
  });

  it('skips blank lines', () => {
    const csv = `name,kind

Server1,server

Server2,db`;
    const result = parseAssetCSV(csv);
    expect(result.assets).toHaveLength(2);
  });

  it('handles empty CSV input', () => {
    const result = parseAssetCSV('');
    expect(result.assets).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });

  it('handles desc header as description', () => {
    const csv = `name,desc
"Asset X","Some description"`;
    const result = parseAssetCSV(csv);
    expect(result.assets[0].description).toBe('Some description');
  });

  it('returns warning for CSV with only headers', () => {
    const csv = `name,kind,description`;
    const result = parseAssetCSV(csv);
    expect(result.assets).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('header');
  });
});