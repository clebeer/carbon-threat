import type { Node, Edge } from 'reactflow';
import dagre from 'dagre';
import ELK from 'elkjs/lib/elk.bundled.js';

// ── Auto-layout helper (dagre) ────────────────────────────────────────────────

export function layoutWithDagre(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 });

  nodes.forEach((n) => {
    g.setNode(n.id, { width: 100, height: 60 });
  });
  edges.forEach((e) => {
    g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - 50, y: pos.y - 30 },
    };
  });
}

// ── Auto-layout with ELK (layered, more sophisticated) ────────────────────────

export async function layoutWithElk(nodes: Node[], edges: Edge[]): Promise<Node[]> {
  const elk = new ELK();

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: nodes.map(n => ({
      id: n.id,
      width: 100,
      height: 60,
    })),
    edges: edges.map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layouted = await elk.layout(graph);

  return nodes.map(n => {
    const elkNode = layouted.children?.find(c => c.id === n.id);
    if (elkNode) {
      return {
        ...n,
        position: { x: elkNode.x ?? n.position.x, y: elkNode.y ?? n.position.y },
      };
    }
    return n;
  });
}

// ── Alignment helpers ─────────────────────────────────────────────────────────

export function alignNodes(nodes: Node[], direction: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom' | 'distribute-h' | 'distribute-v'): Node[] {
  if (nodes.length < 2) return nodes;

  const positions = nodes.map(n => n.position);

  switch (direction) {
    case 'left': {
      const minX = Math.min(...positions.map(p => p.x));
      return nodes.map(n => ({ ...n, position: { ...n.position, x: minX } }));
    }
    case 'center-h': {
      const avgX = positions.reduce((s, p) => s + p.x, 0) / positions.length;
      return nodes.map(n => ({ ...n, position: { ...n.position, x: avgX } }));
    }
    case 'right': {
      const maxX = Math.max(...positions.map(p => p.x));
      return nodes.map(n => ({ ...n, position: { ...n.position, x: maxX } }));
    }
    case 'top': {
      const minY = Math.min(...positions.map(p => p.y));
      return nodes.map(n => ({ ...n, position: { ...n.position, y: minY } }));
    }
    case 'center-v': {
      const avgY = positions.reduce((s, p) => s + p.y, 0) / positions.length;
      return nodes.map(n => ({ ...n, position: { ...n.position, y: avgY } }));
    }
    case 'bottom': {
      const maxY = Math.max(...positions.map(p => p.y));
      return nodes.map(n => ({ ...n, position: { ...n.position, y: maxY } }));
    }
    case 'distribute-h': {
      const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x);
      const minX = sorted[0].position.x;
      const maxX = sorted[sorted.length - 1].position.x;
      const step = (maxX - minX) / (sorted.length - 1);
      return nodes.map(n => {
        const idx = sorted.indexOf(n);
        return { ...n, position: { ...n.position, x: minX + idx * step } };
      });
    }
    case 'distribute-v': {
      const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
      const minY = sorted[0].position.y;
      const maxY = sorted[sorted.length - 1].position.y;
      const step = (maxY - minY) / (sorted.length - 1);
      return nodes.map(n => {
        const idx = sorted.indexOf(n);
        return { ...n, position: { ...n.position, y: minY + idx * step } };
      });
    }
    default: return nodes;
  }
}