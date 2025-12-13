import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, Typography } from '@mui/material';
import {
  SmartToy as AgentIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  HourglassTop as RunningIcon,
} from '@mui/icons-material';
import type { AgentNodeData } from '../types';
import { zinc } from '../theme';

const statusConfig = {
  running: {
    icon: RunningIcon,
    color: '#60a5fa',
    bgColor: '#60a5fa15',
    borderColor: '#60a5fa',
  },
  completed: {
    icon: CheckIcon,
    color: '#4ade80',
    bgColor: '#4ade8015',
    borderColor: '#4ade80',
  },
  error: {
    icon: ErrorIcon,
    color: '#f87171',
    bgColor: '#f8717115',
    borderColor: '#f87171',
  },
};

function AgentFlowNode({ data }: NodeProps<AgentNodeData>) {
  const config = statusConfig[data.status];
  const StatusIcon = config.icon;

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
        ...(data.status === 'running' && {
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
