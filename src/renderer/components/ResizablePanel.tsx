import { useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { Box, useTheme } from '@mui/material';

interface ResizablePanelProps {
  children: ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  side?: 'left' | 'right';
  storageKey?: string;
}

export function ResizablePanel({
  children,
  defaultWidth = 300,
  minWidth = 200,
  maxWidth = 600,
  side = 'right',
  storageKey = 'resizable-panel-width',
}: ResizablePanelProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
        return parsed;
      }
    }
    return defaultWidth;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Save width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(storageKey, width.toString());
  }, [width, storageKey]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;

      const panelRect = panelRef.current.getBoundingClientRect();
      let newWidth: number;

      if (side === 'right') {
        // For right panel, drag handle is on the left edge
        newWidth = panelRect.right - e.clientX;
      } else {
        // For left panel, drag handle is on the right edge
        newWidth = e.clientX - panelRect.left;
      }

      // Clamp to min/max
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(newWidth);
    },
    [isResizing, side, minWidth, maxWidth]
  );

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <Box
      ref={panelRef}
      sx={{
        width,
        height: '100%',
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
      }}
    >
      {/* Resize handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [side === 'right' ? 'left' : 'right']: 0,
          width: 4,
          cursor: 'col-resize',
          backgroundColor: isResizing ? theme.palette.primary.main : 'transparent',
          transition: isResizing ? 'none' : 'background-color 0.2s',
          zIndex: 10,
          '&:hover': {
            backgroundColor: theme.palette.divider,
          },
        }}
      />
      {/* Content */}
      <Box
        sx={{
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          marginLeft: side === 'right' ? '4px' : 0,
          marginRight: side === 'left' ? '4px' : 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
