import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Tabs,
  Tab,
  useTheme,
} from '@mui/material';
import type { AppConfig, ConfigUpdate, OAuthStatus, ApiKeyResult, ModelPinResult } from '../types';
import { GeneralTab, ApiKeysTab, ModelPinsTab, OAuthTab } from './config';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div hidden={value !== index} style={{ paddingTop: 16 }}>
      {value === index && children}
    </div>
  );
}

interface ConfigDialogProps {
  open: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onSave: (updates: ConfigUpdate) => void;
  isLoading: boolean;
  oauthStatus: OAuthStatus | null;
  onOAuthLogin: () => void;
  onOAuthLogout: () => void;
  oauthLoading: boolean;
  onSetApiKey: (keyName: string, value: string) => void;
  onSetModelPin: (agentName: string, modelName: string) => void;
  apiKeyResult: ApiKeyResult | null;
  modelPinResult: ModelPinResult | null;
}

export function ConfigDialog({
  open,
  onClose,
  config,
  onSave,
  isLoading,
  oauthStatus,
  onOAuthLogin,
  onOAuthLogout,
  oauthLoading,
  onSetApiKey,
  onSetModelPin,
  apiKeyResult,
  modelPinResult,
}: ConfigDialogProps) {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [localConfig, setLocalConfig] = useState<ConfigUpdate>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setLocalConfig({
        agent: config.current.agent,
        model: config.current.model,
        temperature: config.current.temperature,
        yolo_mode: config.current.yolo_mode,
        auto_save: config.current.auto_save,
        suppress_thinking: config.current.suppress_thinking,
        suppress_info: config.current.suppress_info,
      });
      setHasChanges(false);
    }
  }, [config]);

  const handleChange = <K extends keyof ConfigUpdate>(key: K, value: ConfigUpdate[K]) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const changes: ConfigUpdate = {};
    if (config) {
      if (localConfig.agent !== config.current.agent) changes.agent = localConfig.agent;
      if (localConfig.model !== config.current.model) changes.model = localConfig.model;
      if (localConfig.temperature !== config.current.temperature) changes.temperature = localConfig.temperature;
      if (localConfig.auto_save !== config.current.auto_save) changes.auto_save = localConfig.auto_save;
      if (localConfig.suppress_thinking !== config.current.suppress_thinking) changes.suppress_thinking = localConfig.suppress_thinking;
      if (localConfig.suppress_info !== config.current.suppress_info) changes.suppress_info = localConfig.suppress_info;
    }

    if (Object.keys(changes).length > 0) {
      onSave(changes);
    }
    onClose();
  };

  if (!config) {
    return (
      <Dialog open={open} onClose={onClose}>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
            <CircularProgress size={24} />
            <Typography>Loading configuration...</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.paper,
          backgroundImage: 'none',
          minHeight: 500,
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 0 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          sx={{
            '& .MuiTab-root': {
              color: theme.palette.text.secondary,
              textTransform: 'none',
              minWidth: 'auto',
              px: 2,
            },
            '& .Mui-selected': {
              color: theme.palette.text.primary,
            },
            '& .MuiTabs-indicator': {
              backgroundColor: theme.palette.primary.main,
            },
          }}
        >
          <Tab label="General" />
          <Tab label="API Keys" />
          <Tab label="Model Pins" />
          <Tab label="OAuth" />
        </Tabs>
      </DialogTitle>

      <DialogContent sx={{ mt: 1 }}>
        <TabPanel value={tabValue} index={0}>
          <GeneralTab config={config} localConfig={localConfig} onChange={handleChange} />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <ApiKeysTab config={config} onSetApiKey={onSetApiKey} apiKeyResult={apiKeyResult} />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <ModelPinsTab config={config} onSetModelPin={onSetModelPin} modelPinResult={modelPinResult} />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <OAuthTab
            oauthStatus={oauthStatus}
            onOAuthLogin={onOAuthLogin}
            onOAuthLogout={onOAuthLogout}
            oauthLoading={oauthLoading}
          />
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: theme.palette.text.secondary }}>
          Cancel
        </Button>
        {tabValue === 0 && (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!hasChanges || isLoading}
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            {isLoading ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
