export function migrateX6ToReactFlow(x6Json) {
  const reactFlowData = {
    nodes: [],
    edges: []
  };

  if (!x6Json || !Array.isArray(x6Json.cells)) {
    return reactFlowData;
  }

  x6Json.cells.forEach((cell) => {
    if (cell.shape === 'edge' || cell.source || cell.target) {
      // Edge mapping
      reactFlowData.edges.push({
        id: cell.id,
        source: cell.source?.cell || cell.source,
        target: cell.target?.cell || cell.target,
        type: 'smoothstep', // Default edge type
        data: cell.data || {}
      });
    } else {
      // Node mapping
      reactFlowData.nodes.push({
        id: cell.id,
        position: cell.position || { x: 0, y: 0 },
        data: {
          label: cell.attrs?.text?.text || cell.shape,
          ...cell.data
        },
        type: 'customNode', // Uses dynamic typing based on standard shapes
        style: cell.size ? { width: cell.size.width, height: cell.size.height } : {}
      });
    }
  });

  return reactFlowData;
}
