import { Box, Typography, useTheme } from '@mui/material';
import type { Message, FileContentData, FileListingData, GrepResultData, DiffData, ShellOutputData } from '../../types';

interface ExpandedContentProps {
  message: Message;
}

export function ExpandedContent({ message }: ExpandedContentProps) {
  const data = message.data;
  const theme = useTheme();

  if (!data) return null;

  // File content
  if (message.type === 'file_content') {
    const fileData = data as FileContentData;
    return (
      <Box>
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 1 }}>
          {fileData.path}
        </Typography>
        <Box
          component="pre"
          sx={{
            margin: 0,
            fontFamily: '"Fira Code", "Consolas", monospace',
            fontSize: '0.75rem',
            color: theme.palette.text.primary,
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
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 1 }}>
          {listData.directory} ({listData.dir_count} dirs, {listData.file_count} files)
        </Typography>
        <Box sx={{ fontFamily: '"Fira Code", "Consolas", monospace', fontSize: '0.75rem' }}>
          {listData.files.slice(0, 50).map((file, i) => (
            <Box key={i} sx={{ color: file.type === 'dir' ? '#fbbf24' : theme.palette.text.secondary, pl: file.depth * 2 }}>
              {file.type === 'dir' ? '📁 ' : '📄 '}{file.path.split('/').pop()}
            </Box>
          ))}
          {listData.files.length > 50 && (
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 1, display: 'block' }}>
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
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 1 }}>
          Search: "{grepData.search_term}" in {grepData.directory}
        </Typography>
        <Box sx={{ fontFamily: '"Fira Code", "Consolas", monospace', fontSize: '0.75rem' }}>
          {grepData.matches.slice(0, 20).map((match, i) => (
            <Box key={i} sx={{ mb: 0.5 }}>
              <Box sx={{ color: '#60a5fa' }}>{match.file_path}:{match.line_number}</Box>
              <Box sx={{ color: theme.palette.text.secondary, pl: 2 }}>{match.line_content}</Box>
            </Box>
          ))}
          {grepData.matches.length > 20 && (
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 1, display: 'block' }}>
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
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 1 }}>
          {diffData.operation}: {diffData.path}
        </Typography>
        <Box sx={{ fontFamily: '"Fira Code", "Consolas", monospace', fontSize: '0.75rem' }}>
          {diffData.diff_lines.map((line, i) => (
            <Box
              key={i}
              sx={{
                color: line.type === 'add' ? '#4ade80' : line.type === 'remove' ? '#f87171' : theme.palette.text.secondary,
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
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mb: 1 }}>
          $ {shellData.command}
        </Typography>
        <Box
          component="pre"
          sx={{
            margin: 0,
            fontFamily: '"Fira Code", "Consolas", monospace',
            fontSize: '0.75rem',
            color: theme.palette.text.primary,
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
