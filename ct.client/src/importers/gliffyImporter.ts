/**
 * Gliffy Diagram Importer
 *
 * Converts Gliffy diagram JSON into React Flow compatible format
 * for CarbonThreat's threat modeling canvas.
 *
 * Gliffy format reference:
 * - objects[]: shapes, lines, groups
 * - layers[]: organizational layers
 * - embedded: nested diagram objects
 */

import type { Node, Edge } from 'reactflow';

// ── Gliffy JSON types ────────────────────────────────────────────────────────

interface GliffyObject {
  id: number | string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'shape' | 'line' | 'group';
  shape?: {
    type: string; // 'rectangle', 'ellipse', 'diamond', 'parallelogram', etc.
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  };
  text?: string;
  graphic?: {
    type: string;
    shape?: {
      type: string;
      fill?: string;
      stroke?: string;
    };
  };
  children?: (number | string)[];
  uid?: string;
  layerId?: string;
  order?: number;
  rotation?: number;
  lockAspectRatio?: boolean;
  state?: number;
  link?: string;
}

interface GliffyLayer {
  id: string;
  name: string;
  active: boolean;
  visible: boolean;
  order: number;
}

interface GliffyDiagram {
  contentType: string;
  version: string;
  metadata?: {
    title?: string;
    revision?: number;
    exported?: string;
    autosave?: boolean;
  };
  layers?: GliffyLayer[];
  objects?: GliffyObject[];
  embedded?: GliffyObject[];
  stage?: {
    width?: number;
    height?: number;
    autoFit?: boolean;
    background?: string;
    grid?: boolean;
    snapToGrid?: boolean;
    drawingGuides?: boolean;
  };
}

export interface ImportResult {
  nodes: Node[];
  edges: Edge[];
  warnings: string[];
  stats: {
    totalObjects: number;
    shapesConverted: number;
    linesConverted: number;
    skipped: number;
  };
}

// ── Shape type to kind mapping ───────────────────────────────────────────────

const SHAPE_MAP: Record<string, string> = {
  // Network & infrastructure shapes
  'rectangle': 'server',
  'round_rectangle': 'server',
  'rounded_rectangle': 'server',
  'ellipse': 'cloud',
  'circle': 'cloud',
  'diamond': 'fw',
  'parallelogram': 'api',
  'hexagon': 'router',
  'cylinder': 'db',
  'database': 'db',
  'cylinder3': 'db',
  // People
  'person': 'user',
  'actor': 'user',
  'user': 'user',
  'stickman': 'user',
  // Network specific
  'cloud': 'cloud',
  'firewall': 'fw',
  'server': 'server',
  'switch': 'switch',
  'router': 'router',
  'loadbalancer': 'loadbalancer',
  'vpn': 'vpn',
  // Default
  'triangle': 'api',
  'star': 'endpoint',
  'document': 'db',
  'note': 'browser',
};

const FALLBACK_KIND = 'server';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapShapeToKind(gliffyObj: GliffyObject): string {
  // Try graphic.shape.type first
  const shapeType = gliffyObj.graphic?.shape?.type ?? gliffyObj.shape?.type ?? '';
  const normalizedType = shapeType.toLowerCase().replace(/[\s_-]/g, '');

  // Direct match
  if (SHAPE_MAP[normalizedType]) return SHAPE_MAP[normalizedType];

  // Partial match
  for (const [pattern, kind] of Object.entries(SHAPE_MAP)) {
    if (normalizedType.includes(pattern)) return kind;
  }

  // Check text content for hints
  const text = (gliffyObj.text ?? '').toLowerCase();
  if (text.includes('firewall') || text.includes('waf')) return 'fw';
  if (text.includes('database') || text.includes('db') || text.includes('sql')) return 'db';
  if (text.includes('server') || text.includes('host')) return 'server';
  if (text.includes('router') || text.includes('gateway')) return 'router';
  if (text.includes('switch')) return 'switch';
  if (text.includes('load balancer') || text.includes('lb')) return 'loadbalancer';
  if (text.includes('vpn')) return 'vpn';
  if (text.includes('cdn') || text.includes('cloud')) return 'cloud';
  if (text.includes('dns')) return 'dns';
  if (text.includes('proxy')) return 'proxy';
  if (text.includes('user') || text.includes('client') || text.includes('browser')) return 'user';
  if (text.includes('api')) return 'api';
  if (text.includes('container') || text.includes('docker') || text.includes('k8s')) return 'container';
  if (text.includes('queue') || text.includes('mq') || text.includes('kafka')) return 'queue';
  if (text.includes('cache') || text.includes('redis')) return 'cache';
  if (text.includes('monitor') || text.includes('siem')) return 'monitoring';
  if (text.includes('vault') || text.includes('secret')) return 'vault';
  if (text.includes('iot') || text.includes('sensor')) return 'iot';

  return FALLBACK_KIND;
}

function extractLabel(obj: GliffyObject): string {
  // Strip HTML tags from Gliffy rich text
  const raw = obj.text ?? '';
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .trim() || 'Component';
}

function findSourceTarget(
  lineObj: GliffyObject,
  allObjects: GliffyObject[],
  nodes: Node[]
): { sourceId: string; targetId: string } | null {
  // Gliffy lines use x/y coordinates to indicate endpoints
  // We try to find the closest nodes to the start and end points
  const lineStart = { x: lineObj.x, y: lineObj.y };
  const lineEnd = { x: lineObj.x + (lineObj.width || 0), y: lineObj.y + (lineObj.height || 0) };

  let closestStart: string | null = null;
  let closestEnd: string | null = null;
  let minStartDist = Infinity;
  let minEndDist = Infinity;

  for (const node of nodes) {
    const cx = node.position.x + 32; // half of 65px node
    const cy = node.position.y + 32;

    const distToStart = Math.hypot(cx - lineStart.x, cy - lineStart.y);
    const distToEnd = Math.hypot(cx - lineEnd.x, cy - lineEnd.y);

    if (distToStart < minStartDist) {
      minStartDist = distToStart;
      closestStart = node.id;
    }
    if (distToEnd < minEndDist) {
      minEndDist = distToEnd;
      closestEnd = node.id;
    }
  }

  // Only connect if within reasonable distance (200px threshold)
  const THRESHOLD = 200;
  if (closestStart && closestEnd && minStartDist < THRESHOLD && minEndDist < THRESHOLD && closestStart !== closestEnd) {
    return { sourceId: closestStart, targetId: closestEnd };
  }

  return null;
}

// ── Main converter ───────────────────────────────────────────────────────────

export function convertGliffyToReactFlow(gliffyJson: unknown): ImportResult {
  const warnings: string[] = [];
  let shapesConverted = 0;
  let linesConverted = 0;
  let skipped = 0;

  // Validate input
  if (!gliffyJson || typeof gliffyJson !== 'object') {
    throw new Error('Invalid Gliffy diagram: expected a JSON object');
  }

  const diagram = gliffyJson as GliffyDiagram;

  // Check if this looks like a Gliffy diagram
  if (!diagram.objects && !diagram.embedded) {
    // Could be a Confluence export with the diagram nested
    const possibleDiagram = (diagram as unknown as Record<string, unknown>).diagram as GliffyDiagram | undefined;
    if (possibleDiagram?.objects) {
      Object.assign(diagram, possibleDiagram);
    } else {
      throw new Error('Invalid Gliffy diagram: no objects found. Expected a Gliffy JSON export.');
    }
  }

  const allObjects = [...(diagram.objects ?? []), ...(diagram.embedded ?? [])];
  const totalObjects = allObjects.length;

  // Phase 1: Convert shapes to nodes
  const shapes = allObjects.filter(o => o.type === 'shape' || (!o.type && o.width && o.height));
  const lines = allObjects.filter(o => o.type === 'line');
  const groups = allObjects.filter(o => o.type === 'group');

  const nodes: Node[] = shapes.map((obj, idx) => {
    const kind = mapShapeToKind(obj);
    const label = extractLabel(obj);
    shapesConverted++;

    return {
      id: `gliffy-${obj.id}`,
      type: 'cyber',
      position: {
        x: obj.x || idx * 100,
        y: obj.y || idx * 100,
      },
      data: {
        label,
        kind,
        selected: false,
        packSlug: 'generic',
      },
    };
  });

  // Phase 2: Convert lines to edges
  const edges: Edge[] = [];
  for (const lineObj of lines) {
    const connection = findSourceTarget(lineObj, allObjects, nodes);
    if (connection) {
      const label = extractLabel(lineObj);
      edges.push({
        id: `gliffy-edge-${lineObj.id}`,
        source: connection.sourceId,
        target: connection.targetId,
        type: 'smoothstep',
        animated: true,
        label: label !== 'Component' ? label : undefined,
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
      });
      linesConverted++;
    } else {
      skipped++;
      warnings.push(`Line #${lineObj.id}: could not resolve source/target nodes`);
    }
  }

  // Phase 3: Handle groups (log warning)
  if (groups.length > 0) {
    warnings.push(`${groups.length} group(s) were skipped (groups are not supported as individual nodes)`);
    skipped += groups.length;
  }

  return {
    nodes,
    edges,
    warnings,
    stats: {
      totalObjects,
      shapesConverted,
      linesConverted,
      skipped,
    },
  };
}

/**
 * Check if a parsed JSON looks like a Gliffy diagram
 */
export function isGliffyDiagram(json: unknown): boolean {
  if (!json || typeof json !== 'object') return false;
  const obj = json as Record<string, unknown>;
  // Gliffy diagrams have contentType "gliffy" and objects array
  return (
    (obj.contentType === 'gliffy' || Array.isArray(obj.objects)) &&
    !Array.isArray(json) // Threat Dragon models are not arrays
  );
}