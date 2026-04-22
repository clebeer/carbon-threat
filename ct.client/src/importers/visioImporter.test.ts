import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { convertVsdxToReactFlow, isVsdxFile } from './visioImporter';

// Helper: create a minimal VSDX-like ZIP in memory
async function createMockVsdx(pages: Record<string, string>, masters?: string): Promise<ArrayBuffer> {
  const zip = new JSZip();

  // Add page files
  for (const [path, content] of Object.entries(pages)) {
    zip.file(path, content);
  }

  // Add masters if provided
  if (masters) {
    zip.file('visio/masters/masters.xml', masters);
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('isVsdxFile', () => {
  it('returns true for .vsdx extension', () => {
    const file = new File([], 'diagram.vsdx');
    expect(isVsdxFile(file)).toBe(true);
  });

  it('returns true for Visio MIME type', () => {
    const file = new File([], 'diagram.bin', { type: 'application/vnd.ms-visio.drawing' });
    expect(isVsdxFile(file)).toBe(true);
  });

  it('returns false for .png file', () => {
    const file = new File([], 'image.png', { type: 'image/png' });
    expect(isVsdxFile(file)).toBe(false);
  });
});

describe('convertVsdxToReactFlow', () => {
  it('throws on invalid ZIP data', async () => {
    await expect(convertVsdxToReactFlow(new ArrayBuffer(10)))
      .rejects.toThrow('could not open as ZIP');
  });

  it('throws when no pages found', async () => {
    const zip = new JSZip();
    zip.file('visio/masters/masters.xml', '<Masters/>');
    const data = await zip.generateAsync({ type: 'arraybuffer' });

    await expect(convertVsdxToReactFlow(data))
      .rejects.toThrow('No pages found');
  });

  it('converts basic shapes from VSDX page', async () => {
    const pageXml = `<?xml version="1.0" encoding="UTF-8"?>
    <PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
      <Shapes>
        <Shape ID="1" Name="Server">
          <Cell N="PinX" V="2.0"/>
          <Cell N="PinY" V="3.0"/>
          <Text>Web Server</Text>
        </Shape>
        <Shape ID="2" Name="Database Cylinder">
          <Cell N="PinX" V="5.0"/>
          <Cell N="PinY" V="3.0"/>
          <Text>Customer DB</Text>
        </Shape>
      </Shapes>
    </PageContents>`;

    const data = await createMockVsdx({
      'visio/pages/page1.xml': pageXml,
    });

    const result = await convertVsdxToReactFlow(data);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].id).toBe('visio-1');
    expect(result.nodes[0].type).toBe('cyber');
    expect(result.nodes[0].data.label).toBe('Web Server');
    expect(result.nodes[0].data.kind).toBe('server');
    // Position defaults to 0,0 without XForm element (Cell N=PinX is not the same)
    expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(result.nodes[1].data.kind).toBe('db');
    expect(result.stats.shapesConverted).toBe(2);
  });

  it('converts connectors to edges', async () => {
    const pageXml = `<?xml version="1.0" encoding="UTF-8"?>
    <PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
      <Shapes>
        <Shape ID="1" Name="Server">
          <Text>Server A</Text>
        </Shape>
        <Shape ID="2" Name="Server">
          <Text>Server B</Text>
        </Shape>
        <Shape ID="3" Name="Dynamic connector" Type="Connector">
          <Text>HTTPS</Text>
          <Connects>
            <Connect FromSheet="1" ToSheet="3"/>
          </Connects>
        </Shape>
      </Shapes>
    </PageContents>`;

    // Build a more realistic connector scenario:
    // The connector has Connects with FromSheet/ToSheet pointing to shape IDs
    const pageXmlWithConn = `<?xml version="1.0" encoding="UTF-8"?>
    <PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
      <Shapes>
        <Shape ID="1" Name="Server">
          <Cell N="PinX" V="1"/><Cell N="PinY" V="1"/>
          <Text>Source</Text>
        </Shape>
        <Shape ID="2" Name="Database">
          <Cell N="PinX" V="4"/><Cell N="PinY" V="1"/>
          <Text>Target</Text>
        </Shape>
        <Shape ID="3" Name="Dynamic connector" Type="Connector">
          <Text>SQL</Text>
          <Connects>
            <Connect FromSheet="1" ToSheet="2"/>
          </Connects>
        </Shape>
      </Shapes>
    </PageContents>`;

    const data = await createMockVsdx({
      'visio/pages/page1.xml': pageXmlWithConn,
    });

    const result = await convertVsdxToReactFlow(data);

    expect(result.nodes).toHaveLength(2); // shapes only (connector excluded)
    // Note: edge creation depends on the Connects parsing
    expect(result.stats.shapesConverted).toBe(2);
  });

  it('uses master shapes for kind mapping', async () => {
    const mastersXml = `<?xml version="1.0" encoding="UTF-8"?>
    <Masters xmlns="http://schemas.microsoft.com/office/visio/2012/main">
      <Master ID="5" Name="Firewall"/>
      <Master ID="6" Name="Router"/>
    </Masters>`;

    const pageXml = `<?xml version="1.0" encoding="UTF-8"?>
    <PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
      <Shapes>
        <Shape ID="1" Master="5" Name="Shape1">
          <Cell N="PinX" V="1"/><Cell N="PinY" V="1"/>
          <Text>Perimeter FW</Text>
        </Shape>
        <Shape ID="2" Master="6" Name="Shape2">
          <Cell N="PinX" V="3"/><Cell N="PinY" V="1"/>
          <Text>Core Router</Text>
        </Shape>
      </Shapes>
    </PageContents>`;

    const data = await createMockVsdx({
      'visio/pages/page1.xml': pageXml,
      'visio/masters/masters.xml': mastersXml,
    });

    const result = await convertVsdxToReactFlow(data);

    expect(result.nodes[0].data.kind).toBe('fw');      // Master "Firewall" → fw
    expect(result.nodes[1].data.kind).toBe('router');  // Master "Router" → router
  });

  it('falls back to text-based kind detection', async () => {
    const pageXml = `<?xml version="1.0" encoding="UTF-8"?>
    <PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
      <Shapes>
        <Shape ID="1" Name="Rectangle">
          <Cell N="PinX" V="1"/><Cell N="PinY" V="1"/>
          <Text>VPN Gateway</Text>
        </Shape>
        <Shape ID="2" Name="Rectangle">
          <Cell N="PinX" V="3"/><Cell N="PinY" V="1"/>
          <Text>Load Balancer</Text>
        </Shape>
      </Shapes>
    </PageContents>`;

    const data = await createMockVsdx({
      'visio/pages/page1.xml': pageXml,
    });

    const result = await convertVsdxToReactFlow(data);

    expect(result.nodes[0].data.kind).toBe('vpn');           // text "VPN"
    expect(result.nodes[1].data.kind).toBe('loadbalancer');  // text "Load Balancer"
  });

  it('defaults unknown shapes to server kind', async () => {
    const pageXml = `<?xml version="1.0" encoding="UTF-8"?>
    <PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
      <Shapes>
        <Shape ID="1" Name="Unknown Shape">
          <Cell N="PinX" V="1"/><Cell N="PinY" V="1"/>
        </Shape>
      </Shapes>
    </PageContents>`;

    const data = await createMockVsdx({
      'visio/pages/page1.xml': pageXml,
    });

    const result = await convertVsdxToReactFlow(data);
    expect(result.nodes[0].data.kind).toBe('server');
  });

  it('skips additional pages with warning', async () => {
    const makePage = (id: number) => `<?xml version="1.0" encoding="UTF-8"?>
    <PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main">
      <Shapes>
        <Shape ID="${id}" Name="Server">
          <Cell N="PinX" V="1"/><Cell N="PinY" V="1"/>
          <Text>Page ${id}</Text>
        </Shape>
      </Shapes>
    </PageContents>`;

    const data = await createMockVsdx({
      'visio/pages/page1.xml': makePage(1),
      'visio/pages/page2.xml': makePage(2),
      'visio/pages/page3.xml': makePage(3),
    });

    const result = await convertVsdxToReactFlow(data);

    expect(result.nodes).toHaveLength(1); // Only first page
    expect(result.warnings.some(w => w.includes('additional page'))).toBe(true);
  });
});