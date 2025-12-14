import { Box, Paper, Typography, useTheme } from '@mui/material';
import {
  Person as PersonIcon,
  SmartToy as BotIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  Psychology as ThinkingIcon,
  Build as ToolIcon,
  Description as FileIcon,
  Terminal as TerminalIcon,
  FolderOpen as FolderIcon,
  Search as SearchIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import type { Message } from '../../types';
import { CompactToolOutput } from './CompactToolOutput';
import { MarkdownContent } from './MarkdownContent';

interface MessageBubbleProps {
  message: Message;
}

interface MessageConfig {
  icon: typeof ToolIcon;
  bgColor: string;
  align: 'flex-start' | 'flex-end' | 'center';
  iconColor: string;
  textColor: string;
  compact: boolean;
}

const shouldRenderMarkdown = (type: Message['type']) => {
  return type === 'assistant' || type === 'reasoning';
};

function useMessageConfig(type: Message['type']): MessageConfig {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  switch (type) {
    case 'user':
      return {
        icon: PersonIcon,
        bgColor: isDark ? theme.palette.action.selected : theme.palette.grey[200],
        align: 'flex-end',
        iconColor: theme.palette.text.secondary,
        textColor: theme.palette.text.primary,
        compact: false,
      };
    case 'assistant':
      return {
        icon: BotIcon,
        bgColor: theme.palette.background.paper,
        align: 'flex-start',
        iconColor: theme.palette.text.secondary,
        textColor: theme.palette.text.primary,
        compact: false,
      };
    case 'system':
      return {
        icon: InfoIcon,
        bgColor: isDark ? theme.palette.background.default : theme.palette.grey[100],
        align: 'center',
        iconColor: theme.palette.text.secondary,
        textColor: theme.palette.text.secondary,
        compact: false,
      };
    case 'error':
      return {
        icon: ErrorIcon,
        bgColor: isDark ? '#7f1d1d' : '#fef2f2',
        align: 'center',
        iconColor: '#ef4444',
        textColor: isDark ? '#fca5a5' : '#dc2626',
        compact: false,
      };
    case 'reasoning':
      return {
        icon: ThinkingIcon,
        bgColor: theme.palette.background.paper,
        align: 'flex-start',
        iconColor: '#a78bfa',
        textColor: theme.palette.text.primary,
        compact: false,
      };
    case 'tool_output':
      return {
        icon: ToolIcon,
        bgColor: 'transparent',
        align: 'flex-start',
        iconColor: '#60a5fa',
        textColor: '#60a5fa',
        compact: true,
      };
    case 'file_content':
      return {
        icon: FileIcon,
        bgColor: 'transparent',
        align: 'flex-start',
        iconColor: '#34d399',
        textColor: '#34d399',
        compact: true,
      };
    case 'file_listing':
      return {
        icon: FolderIcon,
        bgColor: 'transparent',
        align: 'flex-start',
        iconColor: '#fbbf24',
        textColor: '#fbbf24',
        compact: true,
      };
    case 'grep_result':
      return {
        icon: SearchIcon,
        bgColor: 'transparent',
        align: 'flex-start',
        iconColor: '#f472b6',
        textColor: '#f472b6',
        compact: true,
      };
    case 'diff':
      return {
        icon: EditIcon,
        bgColor: 'transparent',
        align: 'flex-start',
        iconColor: '#fb923c',
        textColor: '#fb923c',
        compact: true,
      };
    case 'shell_output':
    case 'shell_start':
      return {
        icon: TerminalIcon,
        bgColor: 'transparent',
        align: 'flex-start',
        iconColor: '#4ade80',
        textColor: '#4ade80',
        compact: true,
      };
    default:
      return {
        icon: BotIcon,
        bgColor: theme.palette.background.paper,
        align: 'flex-start',
        iconColor: theme.palette.text.secondary,
        textColor: theme.palette.text.primary,
        compact: false,
      };
  }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const theme = useTheme();
  const config = useMessageConfig(message.type);
  const Icon = config.icon;
  const isCenter = config.align === 'center';
  const useMarkdown = shouldRenderMarkdown(message.type);

  if (config.compact) {
    return <CompactToolOutput message={message} iconColor={config.iconColor} textColor={config.textColor} />;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: config.align,
        mb: 1.5,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: isCenter ? '90%' : '80%',
          p: 1.5,
          backgroundColor: config.bgColor,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        }}
      >
        <MessageLabel icon={Icon} label={message.label} iconColor={config.iconColor} />
        {useMarkdown ? (
          <MarkdownContent
            content={message.content}
            textColor={config.textColor}
            isStreaming={message.isStreaming}
          />
        ) : (
          <PlainTextContent
            content={message.content}
            textColor={config.textColor}
            isStreaming={message.isStreaming}
          />
        )}
      </Paper>
    </Box>
  );
}

interface MessageLabelProps {
  icon: typeof ToolIcon;
  label?: string;
  iconColor: string;
}

function MessageLabel({ icon: Icon, label, iconColor }: MessageLabelProps) {
  if (!label) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
      <Icon sx={{ fontSize: 14, color: iconColor }} />
      <Typography
        variant="caption"
        sx={{
          color: iconColor,
          textTransform: 'uppercase',
          fontWeight: 600,
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

interface PlainTextContentProps {
  content: string;
  textColor: string;
  isStreaming?: boolean;
}

function PlainTextContent({ content, textColor, isStreaming }: PlainTextContentProps) {
  const theme = useTheme();

  return (
    <Typography
      variant="body2"
      sx={{
        color: textColor,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {content}
      {isStreaming && (
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            width: 8,
            height: 16,
            backgroundColor: theme.palette.text.secondary,
            ml: 0.5,
            animation: 'blink 1s infinite',
            '@keyframes blink': {
              '0%, 50%': { opacity: 1 },
              '51%, 100%': { opacity: 0 },
            },
          }}
        />
      )}
    </Typography>
  );
}
