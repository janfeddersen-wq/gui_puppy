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
} from '@mui/material';
import {
  Circle as CircleIcon,
  Settings as SettingsIcon,
  AccountTree as TreeIcon,
  KeyboardArrowDown as ArrowDownIcon,
  SmartToy as AgentIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import type { ConnectionStatus, AgentInfo } from '../types';
import { zinc } from '../theme';

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

const statusConfig: Record<ConnectionStatus, { label: string; color: string }> = {
  connecting: { label: 'Connecting...', color: zinc[500] },
  connected: { label: 'Connected', color: '#22c55e' },
  disconnected: { label: 'Disconnected', color: '#ef4444' },
  error: { label: 'Error', color: '#ef4444' },
};

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
        backgroundColor: zinc[900],
        borderBottom: `1px solid ${zinc[800]}`,
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 48, gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
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
                backgroundColor: zinc[800],
                color: zinc[300],
                fontSize: '0.75rem',
                cursor: availableAgents && availableAgents.length > 0 ? 'pointer' : 'default',
                '&:hover': availableAgents && availableAgents.length > 0 ? {
                  backgroundColor: zinc[700],
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
                  backgroundColor: zinc[800],
                  border: `1px solid ${zinc[700]}`,
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
                    '&:hover': { backgroundColor: zinc[700] },
                    '&.Mui-selected': {
                      backgroundColor: zinc[700],
                      '&:hover': { backgroundColor: zinc[600] },
                    },
                  }}
                >
                  <ListItemIcon>
                    <AgentIcon sx={{ color: agent.name === agentName ? '#60a5fa' : zinc[500], fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography sx={{ color: zinc[100], fontSize: '0.85rem' }}>
                        {agent.name}
                      </Typography>
                    }
                    secondary={
                      agent.description && (
                        <Typography sx={{ color: zinc[500], fontSize: '0.75rem' }}>
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
              backgroundColor: zinc[800],
              color: zinc[400],
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
                backgroundColor: zinc[800],
                color: zinc[300],
                fontSize: '0.75rem',
                maxWidth: 200,
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: zinc[700],
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

        {/* Flow Panel Toggle */}
        {onToggleFlowPanel && (
          <Tooltip title={flowPanelOpen ? 'Hide agent flow' : 'Show agent flow'}>
            <IconButton
              onClick={onToggleFlowPanel}
              size="small"
              sx={{
                color: flowPanelOpen ? '#60a5fa' : zinc[400],
                backgroundColor: flowPanelOpen ? `${'#60a5fa'}15` : 'transparent',
                '&:hover': {
                  backgroundColor: flowPanelOpen ? `${'#60a5fa'}25` : zinc[800],
                  color: flowPanelOpen ? '#60a5fa' : zinc[100],
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
              color: zinc[400],
              '&:hover': {
                backgroundColor: zinc[800],
                color: zinc[100],
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
            backgroundColor: zinc[800],
            color: zinc[300],
            '& .MuiChip-icon': {
              color: statusCfg.color,
            },
          }}
        />
      </Toolbar>
    </AppBar>
  );
}
