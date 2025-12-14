import { Box, useTheme } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
  textColor: string;
  isStreaming?: boolean;
}

export function MarkdownContent({ content, textColor, isStreaming }: MarkdownContentProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
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
          backgroundColor: isDark ? theme.palette.background.default : theme.palette.grey[200],
          padding: '2px 6px',
          borderRadius: '4px',
          fontFamily: '"Fira Code", "Consolas", monospace',
          fontSize: '0.85em',
        },
        '& pre': {
          backgroundColor: isDark ? theme.palette.background.default : theme.palette.grey[200],
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
          borderLeft: `3px solid ${theme.palette.divider}`,
          margin: '0.5em 0',
          paddingLeft: '1em',
          color: theme.palette.text.secondary,
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
            border: `1px solid ${theme.palette.divider}`,
            padding: '6px 12px',
          },
          '& th': {
            backgroundColor: isDark ? theme.palette.action.selected : theme.palette.grey[100],
          },
        },
        '& hr': {
          border: 'none',
          borderTop: `1px solid ${theme.palette.divider}`,
          margin: '1em 0',
        },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
      {isStreaming && <StreamingCursor />}
    </Box>
  );
}

function StreamingCursor() {
  const theme = useTheme();

  return (
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
  );
}
