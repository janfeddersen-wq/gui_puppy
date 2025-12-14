import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Chip,
  Box,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  useTheme,
} from '@mui/material';
import {
  Circle as CircleIcon,
  Settings as SettingsIcon,
  AccountTree as TreeIcon,
  KeyboardArrowDown as ArrowDownIcon,
  SmartToy as AgentIcon,
  Folder as FolderIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
} from '@mui/icons-material';
import type { ConnectionStatus, AgentInfo } from '../types';
import { useThemeMode } from '../context/ThemeContext';

interface HeaderProps {
  status: ConnectionStatus;
  agentName?: string;
  modelName?: string;
  workingDirectory?: string;
  availableAgents?: AgentInfo[];
  onSettingsClick: () => void;
  onAgentChange?: (agentName: string) => void;
  onToggleFlowPanel?: () => void;
  flowPanelOpen?: boolean;
  onFolderClick?: () => void;
}

export function Header({
  status,
  agentName,
  modelName,
  workingDirectory,
  availableAgents,
  onSettingsClick,
  onAgentChange,
  onToggleFlowPanel,
  flowPanelOpen,
  onFolderClick,
}: HeaderProps) {
  const theme = useTheme();
  const { mode, toggleTheme } = useThemeMode();
  const isDark = mode === 'dark';

  const statusConfig: Record<ConnectionStatus, { label: string; color: string }> = {
    connecting: { label: 'Connecting...', color: theme.palette.text.secondary },
    connected: { label: 'Connected', color: theme.palette.success.main },
    disconnected: { label: 'Disconnected', color: theme.palette.error.main },
    error: { label: 'Error', color: theme.palette.error.main },
  };

  const statusCfg = statusConfig[status];
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleAgentClick = (event: React.MouseEvent<HTMLElement>) => {
    if (availableAgents && availableAgents.length > 0) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAgentSelect = (agent: AgentInfo) => {
    if (onAgentChange) {
      onAgentChange(agent.name);
    }
    handleMenuClose();
  };

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 48, gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem', color: theme.palette.text.primary }}>
          GUI Puppy
        </Typography>

        {/* Agent Selector */}
        {agentName && (
          <>
            <Chip
              icon={<AgentIcon sx={{ fontSize: 16 }} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {agentName}
                  {availableAgents && availableAgents.length > 0 && (
                    <ArrowDownIcon sx={{ fontSize: 16, ml: 0.5 }} />
                  )}
                </Box>
              }
              size="small"
              onClick={handleAgentClick}
              sx={{
                backgroundColor: theme.palette.action.selected,
                color: theme.palette.text.secondary,
                fontSize: '0.75rem',
                cursor: availableAgents && availableAgents.length > 0 ? 'pointer' : 'default',
                '&:hover': availableAgents && availableAgents.length > 0 ? {
                  backgroundColor: theme.palette.action.hover,
                } : {},
                '& .MuiChip-icon': {
                  color: '#60a5fa',
                },
              }}
            />
            <Menu
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={handleMenuClose}
              PaperProps={{
                sx: {
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  maxHeight: 400,
                  minWidth: 250,
                },
              }}
            >
              {availableAgents?.map((agent) => (
                <MenuItem
                  key={agent.name}
                  onClick={() => handleAgentSelect(agent)}
                  selected={agent.name === agentName}
                  sx={{
                    '&:hover': { backgroundColor: theme.palette.action.hover },
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.action.selected,
                      '&:hover': { backgroundColor: theme.palette.action.hover },
                    },
                  }}
                >
                  <ListItemIcon>
                    <AgentIcon sx={{ color: agent.name === agentName ? '#60a5fa' : theme.palette.text.secondary, fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.85rem' }}>
                        {agent.name}
                      </Typography>
                    }
                    secondary={
                      agent.description && (
                        <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.75rem' }}>
                          {agent.description.length > 50
                            ? `${agent.description.substring(0, 50)}...`
                            : agent.description}
                        </Typography>
                      )
                    }
                  />
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        {/* Model Info */}
        {modelName && (
          <Chip
            label={modelName}
            size="small"
            sx={{
              backgroundColor: theme.palette.action.selected,
              color: theme.palette.text.secondary,
              fontSize: '0.75rem',
            }}
          />
        )}

        {/* Working Directory */}
        {workingDirectory && (
          <Tooltip title={`Working directory: ${workingDirectory}\nClick to change`}>
            <Chip
              icon={<FolderIcon sx={{ fontSize: 16 }} />}
              label={workingDirectory.split('/').pop() || workingDirectory}
              size="small"
              onClick={onFolderClick}
              sx={{
                backgroundColor: theme.palette.action.selected,
                color: theme.palette.text.secondary,
                fontSize: '0.75rem',
                maxWidth: 200,
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
                '& .MuiChip-icon': {
                  color: '#fbbf24',
                },
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }}
            />
          </Tooltip>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* Theme Toggle */}
        <Tooltip title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
          <IconButton
            onClick={toggleTheme}
            size="small"
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
              },
            }}
          >
            {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* Flow Panel Toggle */}
        {onToggleFlowPanel && (
          <Tooltip title={flowPanelOpen ? 'Hide agent flow' : 'Show agent flow'}>
            <IconButton
              onClick={onToggleFlowPanel}
              size="small"
              sx={{
                color: flowPanelOpen ? '#60a5fa' : theme.palette.text.secondary,
                backgroundColor: flowPanelOpen ? `${'#60a5fa'}15` : 'transparent',
                '&:hover': {
                  backgroundColor: flowPanelOpen ? `${'#60a5fa'}25` : theme.palette.action.hover,
                  color: flowPanelOpen ? '#60a5fa' : theme.palette.text.primary,
                },
              }}
            >
              <TreeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Settings Button */}
        <Tooltip title="Settings">
          <IconButton
            onClick={onSettingsClick}
            size="small"
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
              },
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Connection Status */}
        <Chip
          icon={<CircleIcon sx={{ fontSize: 10, color: `${statusCfg.color} !important` }} />}
          label={statusCfg.label}
          size="small"
          sx={{
            backgroundColor: theme.palette.action.selected,
            color: theme.palette.text.secondary,
            '& .MuiChip-icon': {
              color: statusCfg.color,
            },
          }}
        />
      </Toolbar>
    </AppBar>
  );
}
