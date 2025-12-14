import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, Typography } from '@mui/material';
import {
  SmartToy as AgentIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  HourglassTop as RunningIcon,
  PauseCircle as WaitingIcon,
} from '@mui/icons-material';
import type { AgentNodeData } from '../types';
import { zinc } from '../theme';

interface ExtendedAgentNodeData extends AgentNodeData {
  isCurrentAgent?: boolean;
  isFiltered?: boolean;
}

const statusConfig = {
  // Active: currently executing (green)
  active: {
    icon: RunningIcon,
    color: '#4ade80',
    bgColor: '#4ade8015',
    borderColor: '#4ade80',
  },
  // Running but not current: waiting for sub-agent (blue)
  waiting: {
    icon: WaitingIcon,
    color: '#60a5fa',
    bgColor: '#60a5fa15',
    borderColor: '#60a5fa',
  },
  completed: {
    icon: CheckIcon,
    color: '#a78bfa',
    bgColor: '#a78bfa15',
    borderColor: '#a78bfa',
  },
  error: {
    icon: ErrorIcon,
    color: '#f87171',
    bgColor: '#f8717115',
    borderColor: '#f87171',
  },
};

function AgentFlowNode({ data, selected }: NodeProps<ExtendedAgentNodeData>) {
  // Determine visual status: active (green), waiting (blue), completed, or error
  const getVisualStatus = () => {
    if (data.status === 'completed') return 'completed';
    if (data.status === 'error') return 'error';
    // If running: check if this is the current (active) agent
    if (data.status === 'running') {
      return selected ? 'active' : 'waiting';
    }
    return 'waiting';
  };

  const visualStatus = getVisualStatus();
  const config = statusConfig[visualStatus];
  const StatusIcon = config.icon;

  const isFiltered = data.isFiltered;

  return (
    <Box
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 1.5,
        backgroundColor: config.bgColor,
        border: `2px solid ${config.borderColor}`,
        minWidth: 120,
        maxWidth: 180,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, transform 0.1s',
        '&:hover': {
          boxShadow: `0 0 0 2px ${config.color}40`,
          transform: 'scale(1.02)',
        },
        ...(isFiltered && {
          boxShadow: `0 0 0 3px ${config.color}`,
          transform: 'scale(1.03)',
        }),
        ...(visualStatus === 'active' && !isFiltered && {
          animation: 'pulse 2s infinite',
          '@keyframes pulse': {
            '0%, 100%': { boxShadow: `0 0 0 0 ${config.color}40` },
            '50%': { boxShadow: `0 0 0 6px ${config.color}00` },
          },
        }),
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: zinc[600],
          border: 'none',
          width: 8,
          height: 8,
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <AgentIcon sx={{ fontSize: 16, color: config.color }} />
        <Typography
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: zinc[100],
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {data.agentName}
        </Typography>
        <StatusIcon sx={{ fontSize: 14, color: config.color }} />
      </Box>

      {data.prompt && (
        <Typography
          sx={{
            fontSize: '0.65rem',
            color: zinc[400],
            mt: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.prompt.substring(0, 30)}...
        </Typography>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: zinc[600],
          border: 'none',
          width: 8,
          height: 8,
        }}
      />
    </Box>
  );
}

export default memo(AgentFlowNode);
