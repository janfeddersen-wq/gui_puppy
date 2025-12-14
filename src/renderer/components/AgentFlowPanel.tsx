import { useMemo, useEffect, useCallback } from 'react';
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
  NodeMouseHandler,
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
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

const nodeTypes = { agentNode: AgentFlowNode };

const nodeWidth = 160;
const horizontalSpacing = 40;
const verticalSpacing = 80;

// Tree layout - positions nodes in a proper hierarchy
function getTreeLayout(
  nodes: Node[],
  agentNodes: AgentNodeData[]
): Node[] {
  if (nodes.length === 0) return [];

  // Build parent-child map, avoiding cycles
  const nodeIds = new Set(agentNodes.map((n) => n.id));
  const childrenMap = new Map<string | null, string[]>();

  agentNodes.forEach((node) => {
    // Skip if parent doesn't exist (orphaned) or would create a cycle
    const parentId = node.parentId;
    if (parentId !== null && !nodeIds.has(parentId)) {
      // Orphan node - treat as root
      if (!childrenMap.has(null)) {
        childrenMap.set(null, []);
      }
      childrenMap.get(null)!.push(node.id);
    } else {
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(node.id);
    }
  });

  // Calculate subtree widths for proper spacing with cycle detection
  const subtreeWidths = new Map<string, number>();

  function calculateSubtreeWidth(nodeId: string, visited: Set<string>): number {
    // Cycle detection
    if (visited.has(nodeId)) {
      return nodeWidth;
    }
    // Already calculated
    if (subtreeWidths.has(nodeId)) {
      return subtreeWidths.get(nodeId)!;
    }

    visited.add(nodeId);
    const children = childrenMap.get(nodeId) || [];

    if (children.length === 0) {
      subtreeWidths.set(nodeId, nodeWidth);
      return nodeWidth;
    }

    const totalWidth = children.reduce((sum, childId) => {
      return sum + calculateSubtreeWidth(childId, visited) + horizontalSpacing;
    }, -horizontalSpacing);

    const width = Math.max(nodeWidth, totalWidth);
    subtreeWidths.set(nodeId, width);
    return width;
  }

  // Find root nodes and calculate their widths
  const rootIds = childrenMap.get(null) || [];
  rootIds.forEach((rootId) => calculateSubtreeWidth(rootId, new Set()));

  // Position nodes with cycle detection
  const positions = new Map<string, { x: number; y: number }>();

  function positionNode(nodeId: string, x: number, y: number, visited: Set<string>): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    positions.set(nodeId, { x, y });

    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) return;

    // Calculate total width needed for children
    let totalChildWidth = 0;
    children.forEach((childId) => {
      totalChildWidth += subtreeWidths.get(childId) || nodeWidth;
    });
    totalChildWidth += (children.length - 1) * horizontalSpacing;

    // Position children centered under parent
    let childX = x - totalChildWidth / 2 + (subtreeWidths.get(children[0]) || nodeWidth) / 2;
    const childY = y + verticalSpacing;

    children.forEach((childId, index) => {
      const childWidth = subtreeWidths.get(childId) || nodeWidth;
      positionNode(childId, childX, childY, visited);
      if (index < children.length - 1) {
        const nextChildWidth = subtreeWidths.get(children[index + 1]) || nodeWidth;
        childX += childWidth / 2 + horizontalSpacing + nextChildWidth / 2;
      }
    });
  }

  // Position all trees starting from roots
  let rootX = 0;
  rootIds.forEach((rootId) => {
    const rootWidth = subtreeWidths.get(rootId) || nodeWidth;
    positionNode(rootId, rootX + rootWidth / 2, 0, new Set());
    rootX += rootWidth + horizontalSpacing;
  });

  // Apply positions to nodes
  return nodes.map((node) => {
    const pos = positions.get(node.id) || { x: 0, y: 0 };
    return {
      ...node,
      position: pos,
    };
  });
}

// Inner component that can use useReactFlow hook
function FlowCanvas({
  agentNodes,
  currentAgentId,
  onNodeClick,
  selectedNodeId,
}: {
  agentNodes: AgentNodeData[];
  currentAgentId: string | null;
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}) {
  const { fitView } = useReactFlow();
  const theme = useTheme();

  // Convert AgentNodeData to ReactFlow nodes
  const initialNodes = useMemo(() => {
    return agentNodes.map((node): Node<AgentNodeData & { isFiltered?: boolean }> => ({
      id: node.id,
      type: 'agentNode',
      data: { ...node, isFiltered: node.id === selectedNodeId },
      position: { x: 0, y: 0 },
      selected: node.id === currentAgentId,
    }));
  }, [agentNodes, currentAgentId, selectedNodeId]);

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

  // Apply tree layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (initialNodes.length === 0) return { nodes: [], edges: [] };
    const positioned = getTreeLayout(initialNodes, agentNodes);
    return { nodes: positioned, edges: initialEdges };
  }, [initialNodes, initialEdges, agentNodes]);

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

  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (onNodeClick) {
      onNodeClick(node.id);
    }
  }, [onNodeClick]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.3}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      style={{ background: theme.palette.background.paper, cursor: onNodeClick ? 'pointer' : 'default' }}
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

export function AgentFlowPanel({ agentNodes, currentAgentId, onClose, onNodeClick, selectedNodeId }: AgentFlowPanelProps) {
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
            <FlowCanvas
              agentNodes={agentNodes}
              currentAgentId={currentAgentId}
              onNodeClick={onNodeClick}
              selectedNodeId={selectedNodeId}
            />
          </ReactFlowProvider>
        )}
      </Box>
    </Box>
  );
}
