import { useEffect, useRef } from 'react';
import { Box, useTheme } from '@mui/material';
import { MessageBubble } from './message';
import type { Message } from '../types';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Box
      sx={{
        flex: 1,
        overflowY: 'auto',
        p: 2,
        backgroundColor: theme.palette.background.default,
      }}
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </Box>
  );
}
