/**
 * Draw.io / diagrams.net XML importer
 * Parses .drawio (XML) files and converts to React Flow nodes/edges.
 */
export interface DrawioShape {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: Record<string, string>;
  sourceId?: string;
  targetId?: string;
}

export interface ImportResult {
  nodes: any[];
  edges: any[];
  stats: { converted: number; skipped: number; edges: number };
  warnings: string[];
}

/** Parse mxGraphModel XML from .drawio file */
function parseDrawioXml(xml: string): DrawioShape[] {
  const shapes: DrawioShape[] = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    // Handle compressed format - look for <mxfile><diagram> structure
    const diagramEl = doc.querySelector('diagram') || doc.querySelector('mxGraphModel');
    if (!diagramEl) return shapes;

    // If compressed (base64+deflate), the content is in the text content
    // For uncompressed, we parse the mxGraphModel directly
    const mxGraphModel = doc.querySelector('mxGraphModel') || diagramEl;

    const cells = mxGraphModel.querySelectorAll('mxCell');
    cells.forEach((cell) => {
      const id = cell.getAttribute('id') || '';
      const value = cell.getAttribute('value') || '';
      const style = cell.getAttribute('style') || '';
      const edge = cell.getAttribute('edge') === '1';
      const source = cell.getAttribute('source') || undefined;
      const target = cell.getAttribute('target') || undefined;
      const parent = cell.getAttribute('parent') || '1';

      // Parse geometry
      const geo = cell.querySelector('mxGeometry');
      const x = parseFloat(geo?.getAttribute('x') || '0');
      const y = parseFloat(geo?.getAttribute('y') || '0');
      const width = parseFloat(geo?.getAttribute('width') || '80');
      const height = parseFloat(geo?.getAttribute('height') || '60');

      // Parse style into key-value map
      const styleMap: Record<string, string> = {};
      style.split(';').forEach((s: string) => {
        const eq = s.indexOf('=');
        if (eq > 0) {
          styleMap[s.substring(0, eq).trim()] = s.substring(eq + 1).trim();
        }
      });

      // Determine shape type
      const shapeType = styleMap.shape || styleMap.type || '';
      const isEdge = edge || Boolean(source || target);

      shapes.push({
        id,
        label: decodeHtmlEntities(value),
        type: isEdge ? 'edge' : classifyShape(shapeType, styleMap),
        x, y, width, height,
        style: styleMap,
        sourceId: source,
        targetId: target,
      });
    });
  } catch (err) {
    console.error('Draw.io parse error:', err);
  }

  return shapes;
}

function decodeHtmlEntities(s: string): string {
  const el = document.createElement('div');
  el.innerHTML = s;
  return el.textContent || s;
}

/** Classify a Draw.io shape into a Carbon Threat kind */
function classifyShape(shapeType: string, style: Record<string, string>): string {
  const st = shapeType.toLowerCase();
  const baseStyle = (style.baseStyle || '').toLowerCase();

  if (st.includes('cylinder') || st.includes('database') || baseStyle.includes('database')) return 'db';
  if (st.includes('hexagon')) return 'cloud';
  if (st.includes('diamond') || st.includes('rhombus')) return 'fw';
  if (st.includes('ellipse') || st.includes('circle') || st.includes('actor')) return 'user';
  if (st.includes('cloud')) return 'cloud';
  if (st.includes('mxgraph.cisco') || st.includes('router')) return 'router';
  if (st.includes('mxgraph.cisco') || st.includes('switch')) return 'switch';
  if (st.includes('mxgraph.aws') || st.includes('mxgraph.azure') || st.includes('mxgraph.gcp')) return 'cloud';
  if (st.includes('trapezoid')) return 'cdn';
  if (st.includes('document') || st.includes('note')) return 'browser';
  if (st.includes('process') || st.includes('rectangle') || baseStyle.includes('process')) return 'server';
  return 'server';
}

/** Map Draw.io edge style to Carbon Threat edge type */
function classifyEdge(style: Record<string, string>): { stroke: string; strokeDasharray?: string } {
  const dashed = style.dashed === '1';
  const color = style.strokeColor || style.borderColor || 'var(--primary)';

  if (dashed) {
    return { stroke: '#f59e0b', strokeDasharray: '8 4' };
  }
  return { stroke: color.startsWith('#') ? color : 'var(--primary)' };
}

/** Convert parsed Draw.io shapes to React Flow format */
export function convertDrawioToReactFlow(xml: string): ImportResult {
  const shapes = parseDrawioXml(xml);
  const warnings: string[] = [];
  let converted = 0;
  let skipped = 0;
  let edgeCount = 0;

  const nodes: any[] = [];
  const edges: any[] = [];

  // First pass: create nodes
  const nodeShapes = shapes.filter(s => s.type !== 'edge' && s.id !== '0' && s.id !== '1');
  const edgeShapes = shapes.filter(s => s.type === 'edge');

  nodeShapes.forEach((shape, idx) => {
    const kind = shape.type;
    nodes.push({
      id: shape.id || `n${idx}`,
      type: 'cyber',
      position: { x: shape.x, y: shape.y },
      data: {
        label: shape.label || kind,
        kind,
      },
    });
    converted++;
  });

  // Second pass: create edges
  edgeShapes.forEach((shape, idx) => {
    if (!shape.sourceId || !shape.targetId) {
      // Try to find source/target from geometry points
      skipped++;
      return;
    }

    // Check source and target exist
    const sourceExists = nodeShapes.some(n => n.id === shape.sourceId) || shapes.some(s => s.id === shape.sourceId);
    const targetExists = nodeShapes.some(n => n.id === shape.targetId) || shapes.some(s => s.id === shape.targetId);

    if (!sourceExists || !targetExists) {
      skipped++;
      warnings.push(`Edge ${shape.id}: source/target not found`);
      return;
    }

    const edgeStyle = classifyEdge(shape.style);
    edges.push({
      id: shape.id || `e${idx}`,
      source: shape.sourceId,
      target: shape.targetId,
      type: 'data-flow',
      animated: !edgeStyle.strokeDasharray,
      style: { stroke: edgeStyle.stroke, strokeWidth: 2, ...(edgeStyle.strokeDasharray ? { strokeDasharray: edgeStyle.strokeDasharray } : {}) },
      data: { label: shape.label || '' },
    });
    edgeCount++;
  });

  return {
    nodes,
    edges,
    stats: { converted, skipped, edges: edgeCount },
    warnings,
  };
}

/** Check if content is a Draw.io XML file */
export function isDrawioFile(content: string): boolean {
  return content.includes('<mxfile') || content.includes('<mxGraphModel');
}