import { useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  MarkerType,
} from 'reactflow';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { Close as CloseIcon, AccountTree as TreeIcon } from '@mui/icons-material';
import 'reactflow/dist/style.css';

import AgentFlowNode from './AgentFlowNode';
import type { AgentNodeData } from '../types';
import { zinc } from '../theme';

interface AgentFlowPanelProps {
  agentNodes: AgentNodeData[];
  currentAgentId: string | null;
  onClose: () => void;
}

const nodeTypes = { agentNode: AgentFlowNode };

const nodeWidth = 150;
const nodeHeight = 60;
const nodeSpacing = 20;

// Simple vertical layout - stacks nodes vertically in order
function getVerticalLayout(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  let y = 0;
  const layoutedNodes = nodes.map((node) => {
    const positioned = {
      ...node,
      position: {
        x: 0, // Center horizontally (ReactFlow's fitView will handle centering)
        y: y,
      },
    };
    y += nodeHeight + nodeSpacing;
    return positioned;
  });

  return { nodes: layoutedNodes, edges };
}

// Inner component that can use useReactFlow hook
function FlowCanvas({
  agentNodes,
  currentAgentId,
}: {
  agentNodes: AgentNodeData[];
  currentAgentId: string | null;
}) {
  const { fitView } = useReactFlow();

  // Convert AgentNodeData to ReactFlow nodes
  const initialNodes = useMemo(() => {
    return agentNodes.map((node): Node<AgentNodeData> => ({
      id: node.id,
      type: 'agentNode',
      data: node,
      position: { x: 0, y: 0 },
      selected: node.id === currentAgentId,
    }));
  }, [agentNodes, currentAgentId]);

  // Create edges from parent-child relationships
  const initialEdges = useMemo(() => {
    return agentNodes
      .filter((node) => node.parentId)
      .map((node): Edge => ({
        id: `${node.parentId}-${node.id}`,
        source: node.parentId!,
        target: node.id,
        type: 'smoothstep',
        animated: node.status === 'running',
        style: {
          stroke: node.status === 'running' ? '#60a5fa' : zinc[600],
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: node.status === 'running' ? '#60a5fa' : zinc[600],
        },
      }));
  }, [agentNodes]);

  // Apply vertical layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (initialNodes.length === 0) return { nodes: [], edges: [] };
    return getVerticalLayout(initialNodes, initialEdges);
  }, [initialNodes, initialEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes/edges when data changes and auto-fit view
  useEffect(() => {
    if (layoutedNodes.length > 0) {
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      // Auto-fit view when nodes change with a small delay to ensure nodes are rendered
      setTimeout(() => {
        fitView({ padding: 0.3, duration: 200 });
      }, 50);
    }
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.3}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      style={{ background: zinc[900] }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={16}
        size={1}
        color={zinc[800]}
      />
      <Controls
        style={{
          button: {
            backgroundColor: zinc[800],
            border: `1px solid ${zinc[700]}`,
            color: zinc[300],
          },
        }}
      />
    </ReactFlow>
  );
}

export function AgentFlowPanel({ agentNodes, currentAgentId, onClose }: AgentFlowPanelProps) {
  const isEmpty = agentNodes.length === 0;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: zinc[900],
        borderLeft: `1px solid ${zinc[800]}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${zinc[800]}`,
        }}
      >
        <TreeIcon sx={{ fontSize: 18, color: zinc[400] }} />
        <Typography
          sx={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: zinc[300],
            flex: 1,
          }}
        >
          Agent Flow
        </Typography>
        <Tooltip title="Close panel">
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              color: zinc[500],
              '&:hover': { color: zinc[300], backgroundColor: zinc[800] },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Flow canvas */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {isEmpty ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <TreeIcon sx={{ fontSize: 48, color: zinc[700] }} />
            <Typography sx={{ color: zinc[600], fontSize: '0.85rem' }}>
              Agent flow will appear here
            </Typography>
            <Typography sx={{ color: zinc[700], fontSize: '0.75rem' }}>
              when agents invoke sub-agents
            </Typography>
          </Box>
        ) : (
          <ReactFlowProvider>
            <FlowCanvas agentNodes={agentNodes} currentAgentId={currentAgentId} />
          </ReactFlowProvider>
        )}
      </Box>
    </Box>
  );
}
