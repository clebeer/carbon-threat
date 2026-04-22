/**
 * Visio (.vsdx) Diagram Importer
 *
 * Converts Visio VSDX files into React Flow compatible format
 * for CarbonThreat's threat modeling canvas.
 *
 * VSDX format: ZIP archive containing OPC (Open Packaging Convention)
 * with XML files under visio/pages/ and visio/masters/
 */

import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type { Node, Edge } from 'reactflow';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VisioImportResult {
  nodes: Node[];
  edges: Edge[];
  warnings: string[];
  stats: {
    totalShapes: number;
    shapesConverted: number;
    connectorsConverted: number;
    skipped: number;
  };
}

interface VisioShape {
  id: string;
  name?: string;
  type?: string;
  masterId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  label?: string;
}

interface VisioConnector {
  id: string;
  fromId: string;
  toId: string;
  text?: string;
}

interface VisioPage {
  name: string;
  shapes: VisioShape[];
  connectors: VisioConnector[];
}

// ── Visio shape name to kind mapping ─────────────────────────────────────────

const MASTER_NAME_MAP: Record<string, string> = {
  // Server / Compute
  'server': 'server',
  'web server': 'server',
  'application server': 'server',
  'file server': 'server',
  'mail server': 'server',
  'print server': 'server',
  'proxy server': 'proxy',
  'blade server': 'server',
  'virtual server': 'server',
  // Database
  'database': 'db',
  'database cylinder': 'db',
  'datastore': 'db',
  'sql database': 'db',
  'nosql': 'db',
  // Firewall / Security
  'firewall': 'fw',
  'firewall (horizontal)': 'fw',
  'firewall (vertical)': 'fw',
  'web application firewall': 'waf',
  'ids': 'ids',
  'ips': 'ids',
  'ids/ips': 'ids',
  'intrusion detection': 'ids',
  'vpn gateway': 'vpn',
  'vpn': 'vpn',
  'ddos protection': 'ddos-protection',
  // Network
  'router': 'router',
  'switch': 'switch',
  'hub': 'switch',
  'load balancer': 'loadbalancer',
  'bridge': 'bridge',
  'gateway': 'router',
  'dns': 'dns',
  'dns server': 'dns',
  // Cloud
  'cloud': 'cloud',
  'cloud service': 'cloud',
  'cdn': 'cdn',
  'cloud storage': 'gcs',
  // Users / Endpoints
  'user': 'user',
  'person': 'user',
  'actor': 'user',
  'workstation': 'endpoint',
  'desktop': 'endpoint',
  'laptop': 'endpoint',
  'mobile': 'mobile',
  'phone': 'mobile',
  'tablet': 'mobile',
  'browser': 'browser',
  'web client': 'browser',
  // IoT
  'iot device': 'iot',
  'sensor': 'iot',
  'camera': 'iot',
  'printer': 'printer',
  // Container / Cloud-native
  'container': 'container',
  'docker': 'container',
  'kubernetes': 'k8s-cluster',
  'api gateway': 'api',
  'api': 'api',
  'message queue': 'queue',
  'cache': 'cache',
  'monitoring': 'monitoring',
  'vault': 'vault',
  'ci/cd': 'gitops',
  // Azure
  'vm': 'server',
  'virtual machine': 'server',
  'azure function': 'cloud-functions',
  'function': 'cloud-functions',
  // AWS
  'ec2': 'ec2',
  'rds': 'rds',
  'lambda': 'lambda',
  's3': 's3',
};

const FALLBACK_KIND = 'server';

// ── Parser helpers ───────────────────────────────────────────────────────────

function mapShapeKind(name: string, text?: string): string {
  const lowerName = (name ?? '').toLowerCase().trim();

  // Direct match on master/shape name
  if (MASTER_NAME_MAP[lowerName]) return MASTER_NAME_MAP[lowerName];

  // Partial match
  for (const [pattern, kind] of Object.entries(MASTER_NAME_MAP)) {
    if (lowerName.includes(pattern)) return kind;
  }

  // Text-based heuristics (same as Gliffy)
  const lowerText = (text ?? '').toLowerCase();
  if (lowerText.includes('firewall') || lowerText.includes('waf')) return 'fw';
  if (lowerText.includes('database') || lowerText.includes('db')) return 'db';
  if (lowerText.includes('server') || lowerText.includes('host')) return 'server';
  if (lowerText.includes('router')) return 'router';
  if (lowerText.includes('switch')) return 'switch';
  if (lowerText.includes('load balancer')) return 'loadbalancer';
  if (lowerText.includes('vpn')) return 'vpn';
  if (lowerText.includes('cloud')) return 'cloud';
  if (lowerText.includes('api')) return 'api';
  if (lowerText.includes('container') || lowerText.includes('docker')) return 'container';
  if (lowerText.includes('k8s') || lowerText.includes('kubernetes')) return 'k8s-cluster';
  if (lowerText.includes('user') || lowerText.includes('client')) return 'user';

  return FALLBACK_KIND;
}

function extractTextFromShape(shapeXml: Record<string, unknown>): string {
  // Visio text is in <Text> element, may contain rich text markup
  const text = shapeXml?.Text;
  if (!text) return '';
  if (typeof text === 'string') return text.trim();
  // Rich text: may be nested object with cp/pp fields
  if (typeof text === 'object') {
    return String(text['#text'] ?? text['_'] ?? JSON.stringify(text)).trim();
  }
  return '';
}

function parsePagesFromXml(
  pageXml: Record<string, unknown>,
  mastersMap: Record<string, { name: string; kind: string }>
): VisioPage {
  const shapes: VisioShape[] = [];
  const connectors: VisioConnector[] = [];
  const warnings: string[] = [];

  const pageContents = (pageXml?.PageContents ?? pageXml) as Record<string, unknown>;

  // Get shapes collection
  const shapesCollection = (pageContents?.Shapes as Record<string, unknown> | undefined)?.Shape;
  if (!shapesCollection) return { name: '', shapes, connectors };

  const shapeArray: Record<string, unknown>[] = Array.isArray(shapesCollection) ? shapesCollection : [shapesCollection];

  for (const shape of shapeArray) {
    const shapeId = String(shape?.['@_ID'] ?? shape?.ID ?? '');
    if (!shapeId) continue;

    const isConnector = shape?.Connects || shape?.['@_Type'] === 'Shape' && shape?.XForm;

    // Check if this is a connector (line/dynamic connector)
    const masterRef = String(shape?.['@_Master'] ?? '');
    const masterInfo = mastersMap[masterRef];
    const shapeName = String(shape?.['@_Name'] ?? shape?.Name ?? masterInfo?.name ?? '');
    const shapeType = String(shape?.['@_Type'] ?? '');
    const text = extractTextFromShape(shape);

    // Detect connectors by name or type
    const isLine = shapeName.toLowerCase().includes('connector') ||
                   shapeName.toLowerCase().includes('dynamic connector') ||
                   shapeName.toLowerCase().includes('line') ||
                   shapeType === 'Connector';

    if (isLine) {
      // Try to get connection info from nested Connects
      const connectsObj = (shape?.Connects ?? {}) as Record<string, unknown>;
      const connects = connectsObj?.Connect;
      if (connects) {
        const connArray: Record<string, unknown>[] = Array.isArray(connects) ? connects : [connects];
        let fromId = '';
        let toId = '';
        for (const conn of connArray) {
          const fromSheet = String(conn?.['@_FromSheet'] ?? conn?.FromSheet ?? '');
          const toSheet = String(conn?.['@_ToSheet'] ?? conn?.ToSheet ?? '');
          if (fromSheet) fromId = fromSheet;
          if (toSheet) toId = toSheet;
        }
        if (fromId && toId) {
          connectors.push({ id: shapeId, fromId, toId, text });
        }
      }
      continue;
    }

    // Get position from XForm (Cell elements)
    let x = 0, y = 0, w = 65, h = 65;
    const xForm = (shape?.XForm ?? {}) as Record<string, unknown>;
    if (xForm) {
      const pinX = xForm.PinX;
      const pinY = xForm.PinY;
      const widthCell = xForm.Width;
      const heightCell = xForm.Height;

      // Cells may have @_V attribute or formula
      x = parseFloat(extractCellValue(pinX)) || 0;
      y = parseFloat(extractCellValue(pinY)) || 0;
      w = parseFloat(extractCellValue(widthCell)) || 65;
      h = parseFloat(extractCellValue(heightCell)) || 65;
    }

    shapes.push({
      id: shapeId,
      name: shapeName,
      type: shapeType,
      masterId: masterRef,
      x,
      y,
      width: w,
      height: h,
      text,
      label: text || shapeName,
    });
  }

  return { name: '', shapes, connectors };
}

function extractCellValue(cell: unknown): string {
  if (!cell) return '0';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'object' && cell !== null) {
    const obj = cell as Record<string, unknown>;
    return String(obj['@_V'] ?? obj['@_Value'] ?? obj['@_F'] ?? obj['#text'] ?? '0');
  }
  return '0';
}

// ── Main converter ───────────────────────────────────────────────────────────

export async function convertVsdxToReactFlow(file: File | ArrayBuffer): Promise<VisioImportResult> {
  const warnings: string[] = [];
  let shapesConverted = 0;
  let connectorsConverted = 0;
  let skipped = 0;

  // Load ZIP
  let zip: JSZip;
  try {
    const data = file instanceof File ? await file.arrayBuffer() : file;
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error('Invalid VSDX file: could not open as ZIP archive');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => {
      // Ensure Shape and Connect are always arrays
      return name === 'Shape' || name === 'Connect' || name === 'Page';
    },
  });

  // Phase 1: Parse masters (stencil definitions)
  const mastersMap: Record<string, { name: string; kind: string }> = {};

  // Look for master shapes in visio/masters/masters.xml and visio/masters/master1.xml etc.
  const mastersXmlFile = zip.file('visio/masters/masters.xml');
  if (mastersXmlFile) {
    try {
      const mastersContent = await mastersXmlFile.async('string');
      const mastersDoc = parser.parse(mastersContent);
      const masterItems = mastersDoc?.Masters?.Master;
      if (masterItems) {
        for (const master of masterItems) {
          const id = String(master?.['@_ID'] ?? '');
          const name = String(master?.['@_Name'] ?? master?.Name ?? '');
          if (id && name) {
            mastersMap[id] = { name, kind: mapShapeKind(name) };
          }
        }
      }
    } catch {
      warnings.push('Could not parse masters.xml — shape type detection may be less accurate');
    }
  }

  // Also parse individual master pages for more info
  const masterPageFiles = Object.keys(zip.files).filter(f =>
    f.match(/^visio\/masters\/master\d+\.xml$/)
  );
  for (const masterFile of masterPageFiles) {
    try {
      const content = await zip.file(masterFile)!.async('string');
      const doc = parser.parse(content);
      const masterShape = doc?.Master?.PageContents?.Shapes?.Shape?.[0] ?? doc?.MasterShape;
      if (masterShape) {
        const id = String(doc?.Master?.['@_ID'] ?? '');
        const name = String(masterShape?.['@_Name'] ?? masterShape?.Name ?? '');
        const text = extractTextFromShape(masterShape as Record<string, unknown>);
        if (id && !mastersMap[id]) {
          mastersMap[id] = { name: name || text, kind: mapShapeKind(name, text) };
        }
      }
    } catch {
      // Skip individual master parse errors
    }
  }

  // Phase 2: Parse pages
  const allPages: VisioPage[] = [];

  // Find page files: visio/pages/page1.xml, page2.xml, etc.
  const pageFiles = Object.keys(zip.files).filter(f =>
    f.match(/^visio\/pages\/page\d+\.xml$/)
  ).sort();

  for (const pageFile of pageFiles) {
    try {
      const content = await zip.file(pageFile)!.async('string');
      const doc = parser.parse(content);
      const page = parsePagesFromXml(doc, mastersMap);
      page.name = pageFile.replace(/^visio\/pages\//, '').replace('.xml', '');
      allPages.push(page);
    } catch (err) {
      warnings.push(`Failed to parse ${pageFile}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  // If no page files found, try alternate structure
  if (allPages.length === 0) {
    // Try visio/page.xml (single page)
    const singlePage = zip.file('visio/page.xml');
    if (singlePage) {
      try {
        const content = await singlePage.async('string');
        const doc = parser.parse(content);
        const page = parsePagesFromXml(doc, mastersMap);
        page.name = 'page';
        allPages.push(page);
      } catch (err) {
        warnings.push(`Failed to parse single page: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }
  }

  if (allPages.length === 0) {
    throw new Error('No pages found in VSDX file. The file may be empty or use an unsupported format.');
  }

  // Phase 3: Use the first page (primary diagram)
  const primaryPage = allPages[0];
  const totalShapes = primaryPage.shapes.length + primaryPage.connectors.length;

  // Convert shapes to React Flow nodes
  // Visio uses inches for coordinates — scale to pixels (1 inch ≈ 96px)
  const SCALE = 96;

  const nodes: Node[] = primaryPage.shapes.map((shape, idx) => {
    const masterInfo = mastersMap[shape.masterId ?? ''];
    const kind = masterInfo?.kind ?? mapShapeKind(shape.name ?? '', shape.text);
    const label = shape.label || shape.text || masterInfo?.name || kind;
    shapesConverted++;

    return {
      id: `visio-${shape.id}`,
      type: 'cyber',
      position: {
        x: shape.x * SCALE,
        y: shape.y * SCALE,
      },
      data: {
        label,
        kind,
        selected: false,
        packSlug: 'generic',
      },
    };
  });

  // Convert connectors to React Flow edges
  const nodeIdMap = new Map(nodes.map(n => [n.id.replace('visio-', ''), n.id]));

  const edges: Edge[] = [];
  for (const conn of primaryPage.connectors) {
    const sourceNodeId = nodeIdMap.get(conn.fromId);
    const targetNodeId = nodeIdMap.get(conn.toId);

    if (sourceNodeId && targetNodeId && sourceNodeId !== targetNodeId) {
      edges.push({
        id: `visio-edge-${conn.id}`,
        source: sourceNodeId,
        target: targetNodeId,
        type: 'smoothstep',
        animated: true,
        label: conn.text || undefined,
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
      });
      connectorsConverted++;
    } else {
      skipped++;
      if (!sourceNodeId) warnings.push(`Connector #${conn.id}: source shape #${conn.fromId} not found`);
      if (!targetNodeId) warnings.push(`Connector #${conn.id}: target shape #${conn.toId} not found`);
    }
  }

  // Log warnings for additional pages
  if (allPages.length > 1) {
    warnings.push(`Only the first page was imported. ${allPages.length - 1} additional page(s) were skipped.`);
  }

  return {
    nodes,
    edges,
    warnings,
    stats: {
      totalShapes,
      shapesConverted,
      connectorsConverted,
      skipped,
    },
  };
}

/**
 * Check if a file is a Visio VSDX file
 */
export function isVsdxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.vsdx') ||
    file.type === 'application/vnd.ms-visio.drawing' ||
    file.type === 'application/zip'; // .vsdx is actually a zip
}