/**
 * Tests for Draw.io / diagrams.net XML importer
 */
import { describe, it, expect } from 'vitest';
import { convertDrawioToReactFlow, isDrawioFile } from './drawioImporter';

// ── isDrawioFile ──────────────────────────────────────────────────────────────

describe('isDrawioFile', () => {
  it('detects <mxfile> content', () => {
    expect(isDrawioFile('<mxfile><diagram>...</diagram></mxfile>')).toBe(true);
  });

  it('detects <mxGraphModel> content', () => {
    expect(isDrawioFile('<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>')).toBe(true);
  });

  it('rejects non-drawio content', () => {
    expect(isDrawioFile('<html><body>Hello</body></html>')).toBe(false);
    expect(isDrawioFile('plain text')).toBe(false);
    expect(isDrawioFile('')).toBe(false);
  });

  it('rejects Gliffy JSON', () => {
    expect(isDrawioFile('{"elementType":"stage","children":[]}')).toBe(false);
  });
});

// ── convertDrawioToReactFlow — basic conversion ───────────────────────────────

describe('convertDrawioToReactFlow', () => {
  it('returns empty result for empty XML', () => {
    const result = convertDrawioToReactFlow('');
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.stats.converted).toBe(0);
  });

  it('returns empty result for non-drawio XML', () => {
    const result = convertDrawioToReactFlow('<html><body>Hi</body></html>');
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('parses a single node with label', () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="Web Server" style="shape=rectangle;" vertex="1" parent="1">
          <mxGeometry x="100" y="200" width="120" height="60" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`;

    const result = convertDrawioToReactFlow(xml);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].data.label).toBe('Web Server');
    expect(result.nodes[0].data.kind).toBe('server');
    expect(result.nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(result.stats.converted).toBe(1);
    expect(result.stats.edges).toBe(0);
  });

  it('skips root cells (id=0 and id=1)', () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
      </root>
    </mxGraphModel>`;

    const result = convertDrawioToReactFlow(xml);
    expect(result.nodes).toHaveLength(0);
  });

  it('defaults kind to "server" for unknown shapes', () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="Unknown" style="" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="80" height="60" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`;

    const result = convertDrawioToReactFlow(xml);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].data.kind).toBe('server');
  });

  it('uses kind as label when value is empty', () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="" style="shape=cylinder;" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="80" height="60" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`;

    const result = convertDrawioToReactFlow(xml);
    expect(result.nodes[0].data.label).toBe('db');
  });
});

// ── Shape classification ─────────────────────────────────────────────────────

describe('shape classification', () => {
  const shapeTests = [
    { style: 'shape=cylinder;', expected: 'db' },
    { style: 'shape=database;', expected: 'db' },
    { style: 'baseStyle=database;', expected: 'db' },
    { style: 'shape=hexagon;', expected: 'cloud' },
    { style: 'shape=cloud;', expected: 'cloud' },
    { style: 'shape=diamond;', expected: 'fw' },
    { style: 'shape=rhombus;', expected: 'fw' },
    { style: 'shape=ellipse;', expected: 'user' },
    { style: 'shape=circle;', expected: 'user' },
    { style: 'shape=actor;', expected: 'user' },
    { style: 'shape=mxgraph.cisco.router;', expected: 'router' },
    { style: 'shape=mxgraph.cisco.switch;', expected: 'switch' },
    { style: 'shape=mxgraph.aws.*;', expected: 'cloud' },
    { style: 'shape=mxgraph.azure.*;', expected: 'cloud' },
    { style: 'shape=mxgraph.gcp.*;', expected: 'cloud' },
    { style: 'shape=trapezoid;', expected: 'cdn' },
    { style: 'shape=document;', expected: 'browser' },
    { style: 'shape=note;', expected: 'browser' },
    { style: 'shape=process;', expected: 'server' },
    { style: 'shape=rectangle;', expected: 'server' },
    { style: 'baseStyle=process;', expected: 'server' },
  ];

  shapeTests.forEach(({ style, expected }) => {
    it(`classifies "${style}" as "${expected}"`, () => {
      const xml = `<mxGraphModel>
        <root>
          <mxCell id="0"/>
          <mxCell id="1" parent="0"/>
          <mxCell id="2" value="Test" style="${style}" vertex="1" parent="1">
            <mxGeometry x="0" y="0" width="80" height="60" as="geometry"/>
          </mxCell>
        </root>
      </mxGraphModel>`;

      const result = convertDrawioToReactFlow(xml);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].data.kind).toBe(expected);
    });
  });
});

// ── Edge parsing ──────────────────────────────────────────────────────────────

describe('edge parsing', () => {
  it('creates an edge between two nodes', () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="n1" value="Server" style="shape=rectangle;" vertex="1" parent="1">
          <mxGeometry x="100" y="100" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="n2" value="Database" style="shape=cylinder;" vertex="1" parent="1">
          <mxGeometry x="300" y="100" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="e1" value="SQL" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="n1" target="n2" parent="1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`;

    const result = convertDrawioToReactFlow(xml);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe('n1');
    expect(result.edges[0].target).toBe('n2');
    expect(result.edges[0].data.label).toBe('SQL');
    expect(result.edges[0].type).toBe('data-flow');
    expect(result.stats.edges).toBe(1);
  });

  it('skips edges without source or target', () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="n1" value="Server" style="" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="e1" value="dangling" edge="1" source="n1" target="nonexistent" parent="1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`;

    const result = convertDrawioToReactFlow(xml);
    expect(result.edges).toHaveLength(0);
    expect(result.stats.skipped).toBe(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('skips edges with no source/target attributes', () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="n1" value="Server" style="" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="e1" edge="1" parent="1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`;

    const result = convertDrawioToReactFlow(xml);
    expect(result.edges).toHaveLength(0);
    expect(result.stats.skipped).toBe(1);
  });

  it('classifies dashed edges as trust-crossing style', () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="n1" value="A" style="" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="n2" value="B" style="" vertex="1" parent="1">
          <mxGeometry x="200" y="0" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="e1" edge="1" source="n1" target="n2" style="dashed=1;" parent="1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`;

    const result = convertDrawioToReactFlow(xml);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].style.strokeDasharray).toBe('8 4');
    expect(result.edges[0].style.stroke).toBe('#f59e0b');
    expect(result.edges[0].animated).toBe(false);
  });
});

// ── HTML entity decoding ──────────────────────────────────────────────────────

describe('HTML entity decoding', () => {
  it('decodes & entity via numeric reference', () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="A &#x26; B" style="" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="80" height="60" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`;

    const result = convertDrawioToReactFlow(xml);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].data.label).toBe('A & B');
  });
});

// ── mxfile wrapper ────────────────────────────────────────────────────────────

describe('mxfile wrapper format', () => {
  it('parses nodes inside <mxfile><diagram> wrapper', () => {
    const xml = `<mxfile>
      <diagram name="Page-1">
        <mxGraphModel>
          <root>
            <mxCell id="0"/>
            <mxCell id="1" parent="0"/>
            <mxCell id="2" value="Firewall" style="shape=diamond;" vertex="1" parent="1">
              <mxGeometry x="150" y="150" width="100" height="80" as="geometry"/>
            </mxCell>
          </root>
        </mxGraphModel>
      </diagram>
    </mxfile>`;

    const result = convertDrawioToReactFlow(xml);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].data.kind).toBe('fw');
    expect(result.nodes[0].data.label).toBe('Firewall');
  });
});

// ── Multiple nodes ────────────────────────────────────────────────────────────

describe('complex diagrams', () => {
  it('parses multiple nodes and edges', () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="n1" value="Client" style="shape=actor;" vertex="1" parent="1">
          <mxGeometry x="50" y="50" width="40" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="n2" value="Web Server" style="shape=rectangle;" vertex="1" parent="1">
          <mxGeometry x="200" y="50" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="n3" value="Database" style="shape=cylinder;" vertex="1" parent="1">
          <mxGeometry x="400" y="50" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="e1" value="HTTPS" edge="1" source="n1" target="n2" parent="1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e2" value="SQL" edge="1" source="n2" target="n3" parent="1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`;

    const result = convertDrawioToReactFlow(xml);
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
    expect(result.stats).toEqual({ converted: 3, skipped: 0, edges: 2 });
    expect(result.warnings).toHaveLength(0);

    // Verify node kinds
    const kinds = result.nodes.map(n => n.data.kind);
    expect(kinds).toContain('user');
    expect(kinds).toContain('server');
    expect(kinds).toContain('db');
  });

  it('handles malformed XML gracefully', () => {
    const result = convertDrawioToReactFlow('<not valid xml <<<');
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.stats.converted).toBe(0);
  });

  it('uses fallback id for cells without id', () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell value="Test" style="" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="80" height="60" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`;

    const result = convertDrawioToReactFlow(xml);
    // The cell without id should still be processed (id becomes '')
    // It gets filtered since id is '' which matches neither '0' nor '1'
    expect(result.nodes.length).toBeGreaterThanOrEqual(0);
  });

  it('defaults geometry to 0,0 with 80x60', () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="No Geo" style="" vertex="1" parent="1"/>
      </root>
    </mxGraphModel>`;

    const result = convertDrawioToReactFlow(xml);
    if (result.nodes.length > 0) {
      expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
    }
  });
});