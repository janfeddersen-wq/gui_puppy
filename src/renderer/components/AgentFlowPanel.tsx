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
import { Box, Typography, IconButton, Tooltip, useTheme } from '@mui/material';
import { Close as CloseIcon, AccountTree as TreeIcon } from '@mui/icons-material';
import 'reactflow/dist/style.css';

import AgentFlowNode from './AgentFlowNode';
import type { AgentNodeData } from '../types';

interface AgentFlowPanelProps {
  agentNodes: AgentNodeData[];
  currentAgentId: string | null;
  onClose: () => void;
}

const nodeTypes = { agentNode: AgentFlowNode };

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
  const theme = useTheme();

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
          stroke: node.status === 'running' ? '#60a5fa' : theme.palette.divider,
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: node.status === 'running' ? '#60a5fa' : theme.palette.divider,
        },
      }));
  }, [agentNodes, theme.palette.divider]);

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
      style={{ background: theme.palette.background.paper }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={16}
        size={1}
        color={theme.palette.divider}
      />
      <Controls
        style={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      />
    </ReactFlow>
  );
}

export function AgentFlowPanel({ agentNodes, currentAgentId, onClose }: AgentFlowPanelProps) {
  const isEmpty = agentNodes.length === 0;
  const theme = useTheme();

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.palette.background.paper,
        borderLeft: `1px solid ${theme.palette.divider}`,
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
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <TreeIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
        <Typography
          sx={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: theme.palette.text.secondary,
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
              color: theme.palette.text.secondary,
              '&:hover': { color: theme.palette.text.primary, backgroundColor: theme.palette.action.hover },
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
            <TreeIcon sx={{ fontSize: 48, color: theme.palette.action.disabled }} />
            <Typography sx={{ color: theme.palette.text.disabled, fontSize: '0.85rem' }}>
              Agent flow will appear here
            </Typography>
            <Typography sx={{ color: theme.palette.action.disabled, fontSize: '0.75rem' }}>
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
