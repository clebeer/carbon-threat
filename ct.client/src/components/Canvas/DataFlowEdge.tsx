import { getBezierPath, type EdgeProps } from 'reactflow';

export function DataFlowEdge({
  id,
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  data,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const labelText = (data as Record<string, string>)?.label ?? '';

  return (
    <>
      <path id={id} style={style} className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd} />
      {labelText && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x={-labelText.length * 3.2 - 6}
            y={-9}
            width={labelText.length * 6.4 + 12}
            height={18}
            rx={4}
            fill="rgba(15,15,25,0.88)"
            stroke="rgba(0,242,255,0.35)"
            strokeWidth={1}
          />
          <text
            x={0}
            y={1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--primary)"
            fontSize={10}
            fontFamily="var(--font-tech)"
            style={{ pointerEvents: 'all', cursor: 'pointer' }}
          >
            {labelText}
          </text>
        </g>
      )}
    </>
  );
}