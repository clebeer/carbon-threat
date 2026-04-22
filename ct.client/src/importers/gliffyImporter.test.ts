import { describe, it, expect } from 'vitest';
import { convertGliffyToReactFlow, isGliffyDiagram } from './gliffyImporter';

describe('isGliffyDiagram', () => {
  it('returns true for valid Gliffy JSON with contentType', () => {
    const json = { contentType: 'gliffy', objects: [] };
    expect(isGliffyDiagram(json)).toBe(true);
  });

  it('returns true for object with objects array', () => {
    const json = { objects: [{ id: 1, type: 'shape', x: 0, y: 0, width: 100, height: 50 }] };
    expect(isGliffyDiagram(json)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isGliffyDiagram(null)).toBe(false);
  });

  it('returns false for arrays', () => {
    expect(isGliffyDiagram([1, 2, 3])).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isGliffyDiagram({})).toBe(false);
  });

  it('returns false for string', () => {
    expect(isGliffyDiagram('not a diagram')).toBe(false);
  });
});

describe('convertGliffyToReactFlow', () => {
  it('throws on null input', () => {
    expect(() => convertGliffyToReactFlow(null)).toThrow('Invalid Gliffy diagram');
  });

  it('throws on empty object without objects', () => {
    expect(() => convertGliffyToReactFlow({})).toThrow('no objects found');
  });

  it('converts basic shapes to nodes', () => {
    const gliffy = {
      contentType: 'gliffy',
      objects: [
        { id: 1, type: 'shape', x: 100, y: 200, width: 120, height: 60, text: 'Web Server' },
        { id: 2, type: 'shape', x: 300, y: 200, width: 80, height: 80, text: 'Database' },
      ],
    };

    const result = convertGliffyToReactFlow(gliffy);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].id).toBe('gliffy-1');
    expect(result.nodes[0].type).toBe('cyber');
    expect(result.nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(result.nodes[0].data.label).toBe('Web Server');
    expect(result.nodes[0].data.kind).toBe('server'); // text contains "server"
    expect(result.nodes[1].data.kind).toBe('db'); // text contains "database"
    expect(result.stats.shapesConverted).toBe(2);
    expect(result.stats.linesConverted).toBe(0);
  });

  it('maps shape types to correct kinds', () => {
    const gliffy = {
      contentType: 'gliffy',
      objects: [
        { id: 1, type: 'shape', x: 0, y: 0, width: 50, height: 50, graphic: { type: 'Shape', shape: { type: 'cylinder' } } },
        { id: 2, type: 'shape', x: 100, y: 0, width: 50, height: 50, graphic: { type: 'Shape', shape: { type: 'ellipse' } } },
        { id: 3, type: 'shape', x: 200, y: 0, width: 50, height: 50, graphic: { type: 'Shape', shape: { type: 'diamond' } } },
      ],
    };

    const result = convertGliffyToReactFlow(gliffy);

    expect(result.nodes[0].data.kind).toBe('db');       // cylinder → db
    expect(result.nodes[1].data.kind).toBe('cloud');    // ellipse → cloud
    expect(result.nodes[2].data.kind).toBe('fw');       // diamond → fw
  });

  it('strips HTML from labels', () => {
    const gliffy = {
      contentType: 'gliffy',
      objects: [
        { id: 1, type: 'shape', x: 0, y: 0, width: 50, height: 50, text: '<b>Bold</b> <i>Label</i>&nbsp;Text' },
      ],
    };

    const result = convertGliffyToReactFlow(gliffy);
    expect(result.nodes[0].data.label).toBe('Bold Label Text');
  });

  it('handles Confluence export wrapper', () => {
    const confluenceExport = {
      diagram: {
        contentType: 'gliffy',
        objects: [
          { id: 1, type: 'shape', x: 0, y: 0, width: 50, height: 50, text: 'My Server' },
        ],
      },
    };

    const result = convertGliffyToReactFlow(confluenceExport);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].data.label).toBe('My Server');
  });

  it('skips groups with warning', () => {
    const gliffy = {
      contentType: 'gliffy',
      objects: [
        { id: 1, type: 'group', x: 0, y: 0, width: 200, height: 200, children: [2, 3] },
        { id: 2, type: 'shape', x: 10, y: 10, width: 50, height: 50, text: 'Server' },
      ],
    };

    const result = convertGliffyToReactFlow(gliffy);
    expect(result.nodes).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('group');
    expect(result.stats.skipped).toBe(1);
  });

  it('skips lines that cannot resolve source/target', () => {
    const gliffy = {
      contentType: 'gliffy',
      objects: [
        { id: 1, type: 'shape', x: 100, y: 200, width: 50, height: 50, text: 'Server' },
        { id: 99, type: 'line', x: 500, y: 500, width: 10, height: 10 }, // far from any shape
      ],
    };

    const result = convertGliffyToReactFlow(gliffy);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.stats.skipped).toBe(1);
  });

  it('converts lines to edges when near nodes', () => {
    const gliffy = {
      contentType: 'gliffy',
      objects: [
        { id: 1, type: 'shape', x: 0, y: 0, width: 50, height: 50, text: 'Server A' },
        { id: 2, type: 'shape', x: 200, y: 0, width: 50, height: 50, text: 'Server B' },
        { id: 3, type: 'line', x: 0, y: 0, width: 200, height: 0 },
      ],
    };

    const result = convertGliffyToReactFlow(gliffy);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('gliffy-1');
    expect(result.edges[0].target).toBe('gliffy-2');
    expect(result.stats.linesConverted).toBe(1);
  });

  it('defaults to server kind for unknown shapes', () => {
    const gliffy = {
      contentType: 'gliffy',
      objects: [
        { id: 1, type: 'shape', x: 0, y: 0, width: 50, height: 50 }, // no text, no shape type
      ],
    };

    const result = convertGliffyToReactFlow(gliffy);
    expect(result.nodes[0].data.kind).toBe('server');
  });

  it('uses text-based kind detection as fallback', () => {
    const gliffy = {
      contentType: 'gliffy',
      objects: [
        { id: 1, type: 'shape', x: 0, y: 0, width: 50, height: 50, text: 'Redis Cache Layer' },
        { id: 2, type: 'shape', x: 100, y: 0, width: 50, height: 50, text: 'Kafka Message Queue' },
        { id: 3, type: 'shape', x: 200, y: 0, width: 50, height: 50, text: 'VPN Tunnel' },
      ],
    };

    const result = convertGliffyToReactFlow(gliffy);
    expect(result.nodes[0].data.kind).toBe('cache');   // text contains "cache" + "redis"
    expect(result.nodes[1].data.kind).toBe('queue');   // text contains "queue" + "kafka"
    expect(result.nodes[2].data.kind).toBe('vpn');     // text contains "vpn"
  });
});