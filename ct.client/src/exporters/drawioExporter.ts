/**
 * Draw.io / diagrams.net XML exporter
 * Converts React Flow nodes/edges to .drawio (mxGraphModel XML) format.
 * Round-trip compatible with the drawioImporter.
 */

import type { Node, Edge } from 'reactflow';

interface DiagramNode {
  id: string;
  label: string;
  kind: string;
}

const KIND_TO_SHAPE: Record<string, string> = {
  actor: 'mxgraph.cisco.people.user',
  server: 'mxgraph.cisco.servers.standard_server',
  db: 'mxgraph.cisco.servers.database_server',
  fw: 'mxgraph.cisco.security.firewall',
  cloud: 'mxgraph.cisco.clouds.cloud',
  mobile: 'mxgraph.cisco.phones.ip_phone',
  browser: 'mxgraph.cisco.terminals.pc',
  api: 'mxgraph.cisco.servers.web_server',
  queue: 'mxgraph.cisco.workstations.workstation',
  storage: 'mxgraph.cisco.servers.disk_array',
  iot: 'mxgraph.cisco.misc.sensor',
  process: 'mxgraph.cisco.servers.unified_communications_manager',
  external: 'mxgraph.cisco.routers.router',
  trustboundary: 'mxgraph.general.dashedRectangle',
};

function escapeXml(str: string): string {
  return str.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}

export function exportToDrawio(nodes: Node[], edges: Edge[], title = 'CarbonThreat Diagram'): string {
  const cellElements: string[] = [];
  let cellId = 1;

  // Map ReactFlow node IDs to mxCell IDs
  const idMap = new Map<string, number>();
  for (const node of nodes) {
    const mxId = cellId++;
    idMap.set(node.id, mxId);
    const data = node.data as DiagramNode | undefined;
    const label = escapeXml(data?.label ?? 'Node');
    const kind = data?.kind ?? 'server';
    const shape = KIND_TO_SHAPE[kind] ?? '';
    const w = 120;
    const h = 80;
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;

    const styleParts = [`rounded=1`, `whiteSpace=wrap`, `html=1`, `fillColor=#1a1a2e`, `strokeColor=#4a90d9`, `fontColor=#e2e8f0`, `arcSize=12`];
    if (shape) styleParts.push(`shape=${shape}`);

    cellElements.push(
      `<mxCell id="${mxId}" value="${label}" style="${styleParts.join(';')}" vertex="1" parent="1">` +
      `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />` +
      `</mxCell>`
    );
  }

  // Edges
  for (const edge of edges) {
    const mxId = cellId++;
    const sourceId = idMap.get(edge.source);
    const targetId = idMap.get(edge.target);
    if (!sourceId || !targetId) continue;

    const edgeData = edge.data as Record<string, unknown> | undefined;
    const label = escapeXml((edgeData?.label as string) ?? '');
    const styleParts = [`edgeStyle=orthogonalEdgeStyle`, `rounded=1`, `orthogonalLoop=1`, `jetSize=auto`, `html=1`, `strokeColor=#4a90d9`, `fontColor=#e2e8f0`];
    if (edge.animated) styleParts.push(`dashed=1`, `dashPattern=8 4`);

    cellElements.push(
      `<mxCell id="${mxId}" value="${label}" style="${styleParts.join(';')}" edge="1" source="${sourceId}" target="${targetId}" parent="1">` +
      `<mxGeometry relative="1" as="geometry" />` +
      `</mxCell>`
    );
  }

  const xml =
    `<mxfile host="carbon-threat" modified="${new Date().toISOString()}" agent="CarbonThreat" version="1.0" type="device">` +
    `<diagram id="ct-export" name="${escapeXml(title)}">` +
    `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="16" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1200" pageHeight="800" math="0" shadow="0">` +
    `<root>` +
    `<mxCell id="0" />` +
    `<mxCell id="1" parent="0" />` +
    cellElements.join('') +
    `</root>` +
    `</mxGraphModel>` +
    `</diagram>` +
    `</mxfile>`;

  return xml;
}

export function downloadDrawio(nodes: Node[], edges: Edge[], title = 'diagram'): void {
  const xml = exportToDrawio(nodes, edges, title);
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.drawio`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}