import { useEffect, useRef, useMemo } from 'react';
import { Box, Chip, useTheme } from '@mui/material';
import { FilterAlt as FilterIcon, Close as CloseIcon } from '@mui/icons-material';
import { MessageBubble } from './message';
import type { Message, AgentNodeData } from '../types';

interface MessageListProps {
  messages: Message[];
  agentFilter?: string | null;
  agentNodes?: AgentNodeData[];
  onClearFilter?: () => void;
}

export function MessageList({ messages, agentFilter, agentNodes, onClearFilter }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const filteredMessages = useMemo(() => {
    if (!agentFilter) return messages;
    return messages.filter((msg) => msg.agentId === agentFilter);
  }, [messages, agentFilter]);

  const filterAgentName = useMemo(() => {
    if (!agentFilter || !agentNodes) return null;
    const node = agentNodes.find((n) => n.id === agentFilter);
    return node?.agentName || null;
  }, [agentFilter, agentNodes]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages]);

  return (
    <Box
      sx={{
        flex: 1,
        overflowY: 'auto',
        p: 2,
        backgroundColor: theme.palette.background.default,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {agentFilter && filterAgentName && (
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            pb: 1,
            backgroundColor: theme.palette.background.default,
          }}
        >
          <Chip
            icon={<FilterIcon sx={{ fontSize: 16 }} />}
            label={`Filtering by: ${filterAgentName}`}
            onDelete={onClearFilter}
            deleteIcon={<CloseIcon sx={{ fontSize: 16 }} />}
            size="small"
            sx={{
              backgroundColor: theme.palette.action.selected,
              '& .MuiChip-label': { fontSize: '0.75rem' },
            }}
          />
        </Box>
      )}
      <Box sx={{ flex: 1 }}>
        {filteredMessages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </Box>
    </Box>
  );
}
