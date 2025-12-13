import { useState } from 'react';
import { Box, Paper, Typography, Collapse, IconButton } from '@mui/material';
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
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, FileContentData, FileListingData, GrepResultData, DiffData, ShellOutputData } from '../types';
import { zinc } from '../theme';

interface MessageBubbleProps {
  message: Message;
}

const getMessageConfig = (type: Message['type']) => {
  switch (type) {
    case 'user':
      return {
        icon: PersonIcon,
        bgColor: zinc[700],
        align: 'flex-end' as const,
        iconColor: zinc[300],
        compact: false,
      };
    case 'assistant':
      return {
        icon: BotIcon,
        bgColor: zinc[800],
        align: 'flex-start' as const,
        iconColor: zinc[400],
        compact: false,
      };
    case 'system':
      return {
        icon: InfoIcon,
        bgColor: zinc[900],
        align: 'center' as const,
        iconColor: zinc[500],
        compact: false,
      };
    case 'error':
      return {
        icon: ErrorIcon,
        bgColor: '#7f1d1d',
        align: 'center' as const,
        iconColor: '#fca5a5',
        textColor: '#fca5a5',
        compact: false,
      };
    case 'reasoning':
      return {
        icon: ThinkingIcon,
        bgColor: zinc[800],
        align: 'flex-start' as const,
        iconColor: '#a78bfa',
        compact: false,
      };
    case 'tool_output':
      return {
        icon: ToolIcon,
        bgColor: zinc[850],
        align: 'flex-start' as const,
        iconColor: '#60a5fa',
        textColor: '#60a5fa',
        compact: true,
      };
    case 'file_content':
      return {
        icon: FileIcon,
        bgColor: 'transparent',
        align: 'flex-start' as const,
        iconColor: '#34d399',
        textColor: '#34d399',
        compact: true,
      };
    case 'file_listing':
      return {
        icon: FolderIcon,
        bgColor: 'transparent',
        align: 'flex-start' as const,
        iconColor: '#fbbf24',
        textColor: '#fbbf24',
        compact: true,
      };
    case 'grep_result':
      return {
        icon: SearchIcon,
        bgColor: 'transparent',
        align: 'flex-start' as const,
        iconColor: '#f472b6',
        textColor: '#f472b6',
        compact: true,
      };
    case 'diff':
      return {
        icon: EditIcon,
        bgColor: 'transparent',
        align: 'flex-start' as const,
        iconColor: '#fb923c',
        textColor: '#fb923c',
        compact: true,
      };
    case 'shell_output':
    case 'shell_start':
      return {
        icon: TerminalIcon,
        bgColor: 'transparent',
        align: 'flex-start' as const,
        iconColor: '#4ade80',
        textColor: '#4ade80',
        compact: true,
      };
    default:
      return {
        icon: BotIcon,
        bgColor: zinc[800],
        align: 'flex-start' as const,
        iconColor: zinc[400],
        compact: false,
      };
  }
};

// Check if message type should use markdown rendering
const shouldRenderMarkdown = (type: Message['type']) => {
  return type === 'assistant' || type === 'reasoning';
};

// Compact tool output component
function CompactToolOutput({ message, config }: { message: Message; config: ReturnType<typeof getMessageConfig> }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = config.icon;
  const textColor = 'textColor' in config ? config.textColor : zinc[400];
  const hasData = message.data !== undefined;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        py: 0.5,
        pl: 1,
        borderLeft: `2px solid ${config.iconColor}30`,
        '&:hover': {
          backgroundColor: `${config.iconColor}08`,
        },
      }}
    >
      <Icon sx={{ fontSize: 16, color: config.iconColor, mt: 0.25, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            variant="body2"
            sx={{
              color: textColor,
              fontFamily: '"Fira Code", "Consolas", monospace',
              fontSize: '0.8rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {message.content}
          </Typography>
          {hasData && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{
                p: 0.25,
                color: zinc[500],
                '&:hover': { color: zinc[300] },
              }}
            >
              {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          )}
        </Box>
        {hasData && (
          <Collapse in={expanded}>
            <Box
              sx={{
                mt: 1,
                p: 1,
                backgroundColor: zinc[900],
                borderRadius: 1,
                maxHeight: 300,
                overflow: 'auto',
              }}
            >
              <ExpandedContent message={message} />
            </Box>
          </Collapse>
        )}
      </Box>
    </Box>
  );
}

// Expanded content for different message types
function ExpandedContent({ message }: { message: Message }) {
  const data = message.data;

  if (!data) return null;

  // File content
  if (message.type === 'file_content') {
    const fileData = data as FileContentData;
    return (
      <Box>
        <Typography variant="caption" sx={{ color: zinc[500], display: 'block', mb: 1 }}>
          {fileData.path}
        </Typography>
        <Box
          component="pre"
          sx={{
            margin: 0,
            fontFamily: '"Fira Code", "Consolas", monospace',
            fontSize: '0.75rem',
            color: zinc[300],
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {fileData.content}
        </Box>
      </Box>
    );
  }

  // File listing
  if (message.type === 'file_listing') {
    const listData = data as FileListingData;
    return (
      <Box>
        <Typography variant="caption" sx={{ color: zinc[500], display: 'block', mb: 1 }}>
          {listData.directory} ({listData.dir_count} dirs, {listData.file_count} files)
        </Typography>
        <Box sx={{ fontFamily: '"Fira Code", "Consolas", monospace', fontSize: '0.75rem' }}>
          {listData.files.slice(0, 50).map((file, i) => (
            <Box key={i} sx={{ color: file.type === 'dir' ? '#fbbf24' : zinc[400], pl: file.depth * 2 }}>
              {file.type === 'dir' ? '📁 ' : '📄 '}{file.path.split('/').pop()}
            </Box>
          ))}
          {listData.files.length > 50 && (
            <Typography variant="caption" sx={{ color: zinc[500], mt: 1, display: 'block' }}>
              ... and {listData.files.length - 50} more
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  // Grep results
  if (message.type === 'grep_result') {
    const grepData = data as GrepResultData;
    return (
      <Box>
        <Typography variant="caption" sx={{ color: zinc[500], display: 'block', mb: 1 }}>
          Search: "{grepData.search_term}" in {grepData.directory}
        </Typography>
        <Box sx={{ fontFamily: '"Fira Code", "Consolas", monospace', fontSize: '0.75rem' }}>
          {grepData.matches.slice(0, 20).map((match, i) => (
            <Box key={i} sx={{ mb: 0.5 }}>
              <Box sx={{ color: '#60a5fa' }}>{match.file_path}:{match.line_number}</Box>
              <Box sx={{ color: zinc[400], pl: 2 }}>{match.line_content}</Box>
            </Box>
          ))}
          {grepData.matches.length > 20 && (
            <Typography variant="caption" sx={{ color: zinc[500], mt: 1, display: 'block' }}>
              ... and {grepData.matches.length - 20} more matches
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  // Diff
  if (message.type === 'diff') {
    const diffData = data as DiffData;
    return (
      <Box>
        <Typography variant="caption" sx={{ color: zinc[500], display: 'block', mb: 1 }}>
          {diffData.operation}: {diffData.path}
        </Typography>
        <Box sx={{ fontFamily: '"Fira Code", "Consolas", monospace', fontSize: '0.75rem' }}>
          {diffData.diff_lines.map((line, i) => (
            <Box
              key={i}
              sx={{
                color: line.type === 'add' ? '#4ade80' : line.type === 'remove' ? '#f87171' : zinc[500],
                backgroundColor: line.type === 'add' ? '#4ade8010' : line.type === 'remove' ? '#f8717110' : 'transparent',
              }}
            >
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}{line.content}
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  // Shell output
  if (message.type === 'shell_output' || message.type === 'shell_start') {
    const shellData = data as ShellOutputData;
    return (
      <Box>
        <Typography variant="caption" sx={{ color: zinc[500], display: 'block', mb: 1 }}>
          $ {shellData.command}
        </Typography>
        <Box
          component="pre"
          sx={{
            margin: 0,
            fontFamily: '"Fira Code", "Consolas", monospace',
            fontSize: '0.75rem',
            color: zinc[300],
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {shellData.stdout}
          {shellData.stderr && <Box sx={{ color: '#f87171' }}>{shellData.stderr}</Box>}
        </Box>
        {shellData.exit_code !== 0 && (
          <Typography variant="caption" sx={{ color: '#f87171', mt: 1, display: 'block' }}>
            Exit code: {shellData.exit_code}
          </Typography>
        )}
      </Box>
    );
  }

  return null;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const config = getMessageConfig(message.type);
  const Icon = config.icon;
  const isCenter = config.align === 'center';
  const useMarkdown = shouldRenderMarkdown(message.type);
  const textColor = 'textColor' in config ? config.textColor : zinc[100];

  // Use compact rendering for tool outputs
  if (config.compact) {
    return <CompactToolOutput message={message} config={config} />;
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
          border: `1px solid ${zinc[700]}`,
          borderRadius: 2,
        }}
      >
        {message.label && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <Icon sx={{ fontSize: 14, color: config.iconColor }} />
            <Typography
              variant="caption"
              sx={{
                color: config.iconColor,
                textTransform: 'uppercase',
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            >
              {message.label}
            </Typography>
          </Box>
        )}
        {useMarkdown ? (
          <Box
            sx={{
              color: textColor,
              '& p': {
                margin: 0,
                marginBottom: '0.5em',
                '&:last-child': { marginBottom: 0 },
              },
              '& h1, & h2, & h3, & h4, & h5, & h6': {
                margin: '0.5em 0',
                fontWeight: 600,
              },
              '& h1': { fontSize: '1.5em' },
              '& h2': { fontSize: '1.3em' },
              '& h3': { fontSize: '1.1em' },
              '& code': {
                backgroundColor: zinc[900],
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: '"Fira Code", "Consolas", monospace',
                fontSize: '0.85em',
              },
              '& pre': {
                backgroundColor: zinc[900],
                padding: '12px',
                borderRadius: '6px',
                overflow: 'auto',
                margin: '0.5em 0',
                '& code': {
                  backgroundColor: 'transparent',
                  padding: 0,
                },
              },
              '& ul, & ol': {
                margin: '0.5em 0',
                paddingLeft: '1.5em',
              },
              '& li': {
                marginBottom: '0.25em',
              },
              '& blockquote': {
                borderLeft: `3px solid ${zinc[600]}`,
                margin: '0.5em 0',
                paddingLeft: '1em',
                color: zinc[400],
              },
              '& a': {
                color: '#60a5fa',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              },
              '& table': {
                borderCollapse: 'collapse',
                margin: '0.5em 0',
                '& th, & td': {
                  border: `1px solid ${zinc[600]}`,
                  padding: '6px 12px',
                },
                '& th': {
                  backgroundColor: zinc[700],
                },
              },
              '& hr': {
                border: 'none',
                borderTop: `1px solid ${zinc[600]}`,
                margin: '1em 0',
              },
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: 8,
                  height: 16,
                  backgroundColor: zinc[400],
                  ml: 0.5,
                  animation: 'blink 1s infinite',
                  '@keyframes blink': {
                    '0%, 50%': { opacity: 1 },
                    '51%, 100%': { opacity: 0 },
                  },
                }}
              />
            )}
          </Box>
        ) : (
          <Typography
            variant="body2"
            sx={{
              color: textColor,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message.content}
            {message.isStreaming && (
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: 8,
                  height: 16,
                  backgroundColor: zinc[400],
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
        )}
      </Paper>
    </Box>
  );
}
