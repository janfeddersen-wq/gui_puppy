import { useState } from 'react';
import { Box, Typography, Collapse, IconButton, useTheme } from '@mui/material';
import {
  Build as ToolIcon,
  Description as FileIcon,
  Terminal as TerminalIcon,
  FolderOpen as FolderIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import type { Message } from '../../types';
import { ExpandedContent } from './ExpandedContent';

interface CompactToolOutputProps {
  message: Message;
  iconColor: string;
  textColor: string;
}

const icons: Record<string, typeof ToolIcon> = {
  tool_output: ToolIcon,
  file_content: FileIcon,
  file_listing: FolderIcon,
  grep_result: SearchIcon,
  diff: EditIcon,
  shell_output: TerminalIcon,
  shell_start: TerminalIcon,
};

export function CompactToolOutput({ message, iconColor, textColor }: CompactToolOutputProps) {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const hasData = message.data !== undefined;

  const Icon = icons[message.type] || ToolIcon;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        py: 0.5,
        pl: 1,
        borderLeft: `2px solid ${iconColor}30`,
        '&:hover': {
          backgroundColor: `${iconColor}08`,
        },
      }}
    >
      <Icon sx={{ fontSize: 16, color: iconColor, mt: 0.25, flexShrink: 0 }} />
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
                color: theme.palette.text.secondary,
                '&:hover': { color: theme.palette.text.primary },
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
                backgroundColor: theme.palette.background.paper,
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
