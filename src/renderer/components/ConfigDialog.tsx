import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  TextField,
  Switch,
  FormControlLabel,
  Box,
  Typography,
  Divider,
  Tooltip,
  CircularProgress,
  Alert,
  Autocomplete,
  Tabs,
  Tab,
  IconButton,
  InputAdornment,
  Chip,
} from '@mui/material';
import { Visibility, VisibilityOff, Check, Clear } from '@mui/icons-material';
import type { AppConfig, ConfigUpdate, OAuthStatus, ApiKeyResult, ModelPinResult } from '../types';
import { zinc } from '../theme';

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

const API_KEY_LABELS: Record<string, string> = {
  OPENAI_API_KEY: 'OpenAI',
  ANTHROPIC_API_KEY: 'Anthropic',
  GEMINI_API_KEY: 'Google Gemini',
  CEREBRAS_API_KEY: 'Cerebras',
  OPENROUTER_API_KEY: 'OpenRouter',
  AZURE_OPENAI_API_KEY: 'Azure OpenAI',
  AZURE_OPENAI_ENDPOINT: 'Azure OpenAI Endpoint',
};

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
  const [tabValue, setTabValue] = useState(0);
  const [localConfig, setLocalConfig] = useState<ConfigUpdate>({});
  const [hasChanges, setHasChanges] = useState(false);

  // API key editing state
  const [editingApiKey, setEditingApiKey] = useState<string | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [showApiKeyValue, setShowApiKeyValue] = useState(false);

  // Model pinning state
  const [selectedPinAgent, setSelectedPinAgent] = useState<string>('');
  const [selectedPinModel, setSelectedPinModel] = useState<string>('');

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

  // Reset editing state when dialog closes
  useEffect(() => {
    if (!open) {
      setEditingApiKey(null);
      setApiKeyValue('');
      setShowApiKeyValue(false);
    }
  }, [open]);

  const handleChange = <K extends keyof ConfigUpdate>(key: K, value: ConfigUpdate[K]) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // Only send changed values
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

  const handleApiKeySave = () => {
    if (editingApiKey) {
      onSetApiKey(editingApiKey, apiKeyValue);
      setEditingApiKey(null);
      setApiKeyValue('');
      setShowApiKeyValue(false);
    }
  };

  const handleApiKeyClear = (keyName: string) => {
    onSetApiKey(keyName, '');
  };

  const handleModelPinSave = () => {
    if (selectedPinAgent && selectedPinModel) {
      onSetModelPin(selectedPinAgent, selectedPinModel);
      setSelectedPinAgent('');
      setSelectedPinModel('');
    }
  };

  const handleModelPinClear = (agentName: string) => {
    onSetModelPin(agentName, '');
  };

  const selectedAgent = config?.available.agents.find((a) => a.name === localConfig.agent);

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
          backgroundColor: zinc[900],
          backgroundImage: 'none',
          minHeight: 500,
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${zinc[800]}`, pb: 0 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          sx={{
            '& .MuiTab-root': {
              color: zinc[500],
              textTransform: 'none',
              minWidth: 'auto',
              px: 2,
            },
            '& .Mui-selected': {
              color: zinc[100],
            },
            '& .MuiTabs-indicator': {
              backgroundColor: zinc[100],
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
        {/* General Tab */}
        <TabPanel value={tabValue} index={0}>
          {/* Agent Selection */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: zinc[400] }}>
              Agent
            </Typography>
            <FormControl fullWidth size="small">
              <Autocomplete
                value={config.available.agents.find((a) => a.name === localConfig.agent) || null}
                onChange={(_, newValue) => handleChange('agent', newValue?.name || '')}
                options={config.available.agents}
                getOptionLabel={(option) => option.label || option.name}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body2">{option.label || option.name}</Typography>
                      <Typography variant="caption" sx={{ color: zinc[500] }}>
                        {option.description?.slice(0, 80)}...
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField {...params} placeholder="Select agent..." />
                )}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: zinc[950],
                  },
                }}
              />
            </FormControl>
            {selectedAgent?.description && (
              <Typography variant="caption" sx={{ color: zinc[500], mt: 0.5, display: 'block' }}>
                {selectedAgent.description}
              </Typography>
            )}
          </Box>

          {/* Model Selection */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: zinc[400] }}>
              Model
            </Typography>
            <Autocomplete
              value={localConfig.model || ''}
              onChange={(_, newValue) => handleChange('model', newValue || '')}
              options={config.available.models}
              freeSolo
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Select or type model name..."
                />
              )}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: zinc[950],
                },
              }}
            />
          </Box>

          {/* Temperature */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: zinc[400] }}>
              Temperature
            </Typography>
            <TextField
              type="number"
              size="small"
              fullWidth
              value={localConfig.temperature ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                handleChange('temperature', val === '' ? null : parseFloat(val));
              }}
              placeholder="Default (model-specific)"
              inputProps={{ min: 0, max: 2, step: 0.1 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: zinc[950],
                },
              }}
            />
            <Typography variant="caption" sx={{ color: zinc[500] }}>
              0 = deterministic, 1 = creative, 2 = very random
            </Typography>
          </Box>

          <Divider sx={{ my: 2, borderColor: zinc[800] }} />

          {/* Toggles */}
          <Typography variant="subtitle2" sx={{ mb: 1, color: zinc[400] }}>
            Options
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Tooltip title="Auto-save conversation sessions" placement="right">
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.auto_save ?? false}
                    onChange={(e) => handleChange('auto_save', e.target.checked)}
                    size="small"
                  />
                }
                label="Auto-save sessions"
                sx={{ color: zinc[300] }}
              />
            </Tooltip>

            <Tooltip title="Hide agent thinking/reasoning messages" placement="right">
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.suppress_thinking ?? false}
                    onChange={(e) => handleChange('suppress_thinking', e.target.checked)}
                    size="small"
                  />
                }
                label="Suppress thinking messages"
                sx={{ color: zinc[300] }}
              />
            </Tooltip>

            <Tooltip title="Hide informational status messages" placement="right">
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.suppress_info ?? false}
                    onChange={(e) => handleChange('suppress_info', e.target.checked)}
                    size="small"
                  />
                }
                label="Suppress info messages"
                sx={{ color: zinc[300] }}
              />
            </Tooltip>
          </Box>

          {config.current.yolo_mode && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              YOLO mode is enabled - agent will execute without confirmations
            </Alert>
          )}
        </TabPanel>

        {/* API Keys Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="body2" sx={{ color: zinc[500], mb: 2 }}>
            Configure API keys for different providers. Keys are stored in your local puppy.cfg file.
          </Typography>

          {apiKeyResult && (
            <Alert severity={apiKeyResult.success ? 'success' : 'error'} sx={{ mb: 2 }}>
              {apiKeyResult.message || apiKeyResult.error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(API_KEY_LABELS).map(([keyName, label]) => {
              const keyInfo = config.api_keys?.[keyName];
              const isEditing = editingApiKey === keyName;

              return (
                <Box key={keyName} sx={{ p: 2, backgroundColor: zinc[950], borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isEditing ? 1.5 : 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ color: zinc[200] }}>
                        {label}
                      </Typography>
                      {keyInfo?.is_set ? (
                        <Chip
                          size="small"
                          icon={<Check sx={{ fontSize: 14 }} />}
                          label={keyInfo.masked}
                          sx={{
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            color: '#22c55e',
                            '& .MuiChip-icon': { color: '#22c55e' },
                          }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          label="Not set"
                          sx={{
                            backgroundColor: zinc[800],
                            color: zinc[500],
                          }}
                        />
                      )}
                    </Box>
                    <Box>
                      {!isEditing && (
                        <>
                          <Button
                            size="small"
                            onClick={() => {
                              setEditingApiKey(keyName);
                              setApiKeyValue('');
                            }}
                            sx={{ color: zinc[400], minWidth: 'auto' }}
                          >
                            {keyInfo?.is_set ? 'Change' : 'Set'}
                          </Button>
                          {keyInfo?.is_set && (
                            <Button
                              size="small"
                              onClick={() => handleApiKeyClear(keyName)}
                              sx={{ color: '#ef4444', minWidth: 'auto' }}
                            >
                              Clear
                            </Button>
                          )}
                        </>
                      )}
                    </Box>
                  </Box>

                  {isEditing && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        size="small"
                        fullWidth
                        type={showApiKeyValue ? 'text' : 'password'}
                        value={apiKeyValue}
                        onChange={(e) => setApiKeyValue(e.target.value)}
                        placeholder={keyName === 'AZURE_OPENAI_ENDPOINT' ? 'https://your-resource.openai.azure.com' : 'Enter API key...'}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => setShowApiKeyValue(!showApiKeyValue)}
                              >
                                {showApiKeyValue ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: zinc[900],
                          },
                        }}
                      />
                      <Button
                        size="small"
                        variant="contained"
                        onClick={handleApiKeySave}
                        disabled={!apiKeyValue}
                        sx={{
                          backgroundColor: zinc[100],
                          color: zinc[900],
                          '&:hover': { backgroundColor: zinc[200] },
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          setEditingApiKey(null);
                          setApiKeyValue('');
                        }}
                        sx={{ color: zinc[400] }}
                      >
                        Cancel
                      </Button>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </TabPanel>

        {/* Model Pins Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="body2" sx={{ color: zinc[500], mb: 2 }}>
            Pin specific models to agents. When an agent has a pinned model, it will always use that model regardless of the default.
          </Typography>

          {modelPinResult && (
            <Alert severity={modelPinResult.success ? 'success' : 'error'} sx={{ mb: 2 }}>
              {modelPinResult.message || modelPinResult.error}
            </Alert>
          )}

          {/* Current pins */}
          {config.model_pinning && Object.keys(config.model_pinning).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: zinc[400] }}>
                Current Pins
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Object.entries(config.model_pinning).map(([agentName, modelName]) => {
                  const agent = config.available.agents.find((a) => a.name === agentName);
                  return (
                    <Box
                      key={agentName}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        backgroundColor: zinc[950],
                        borderRadius: 1,
                      }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ color: zinc[200] }}>
                          {agent?.label || agentName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: zinc[500] }}>
                          → {modelName}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleModelPinClear(agentName)}
                        sx={{ color: zinc[500] }}
                      >
                        <Clear fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Add new pin */}
          <Box sx={{ p: 2, backgroundColor: zinc[950], borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: zinc[400] }}>
              Add Model Pin
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Autocomplete
                value={config.available.agents.find((a) => a.name === selectedPinAgent) || null}
                onChange={(_, newValue) => setSelectedPinAgent(newValue?.name || '')}
                options={config.available.agents}
                getOptionLabel={(option) => option.label || option.name}
                renderInput={(params) => (
                  <TextField {...params} size="small" placeholder="Select agent..." />
                )}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: zinc[900],
                  },
                }}
              />
              <Autocomplete
                value={selectedPinModel}
                onChange={(_, newValue) => setSelectedPinModel(newValue || '')}
                options={config.available.models}
                freeSolo
                renderInput={(params) => (
                  <TextField {...params} size="small" placeholder="Select model..." />
                )}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: zinc[900],
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={handleModelPinSave}
                disabled={!selectedPinAgent || !selectedPinModel}
                sx={{
                  backgroundColor: zinc[100],
                  color: zinc[900],
                  '&:hover': { backgroundColor: zinc[200] },
                }}
              >
                Add Pin
              </Button>
            </Box>
          </Box>
        </TabPanel>

        {/* OAuth Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="body2" sx={{ color: zinc[500], mb: 2 }}>
            Sign in with your Claude account to access Claude Code models via OAuth.
          </Typography>

          {oauthStatus === null ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" sx={{ color: zinc[500] }}>
                Loading OAuth status...
              </Typography>
            </Box>
          ) : !oauthStatus.available ? (
            <Alert severity="info" sx={{ mb: 1 }}>
              OAuth plugin not available
            </Alert>
          ) : oauthStatus.authenticated ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Authenticated with Claude Code
                {oauthStatus.expires_in && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                    Token expires in {oauthStatus.expires_in}
                  </Typography>
                )}
              </Alert>
              {oauthStatus.models.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: zinc[400], mb: 1 }}>
                    Available OAuth Models
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {oauthStatus.models.map((model) => (
                      <Chip
                        key={model}
                        label={model}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(124, 58, 237, 0.1)',
                          color: '#a78bfa',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              <Button
                variant="outlined"
                size="small"
                onClick={onOAuthLogout}
                disabled={oauthLoading}
                sx={{
                  borderColor: zinc[600],
                  color: zinc[300],
                  '&:hover': {
                    borderColor: zinc[400],
                    backgroundColor: zinc[800],
                  },
                }}
              >
                {oauthLoading ? <CircularProgress size={16} /> : 'Logout'}
              </Button>
            </Box>
          ) : (
            <Box>
              <Button
                variant="contained"
                size="small"
                onClick={onOAuthLogin}
                disabled={oauthLoading}
                sx={{
                  backgroundColor: '#7c3aed',
                  '&:hover': {
                    backgroundColor: '#6d28d9',
                  },
                }}
              >
                {oauthLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Sign in with Claude'}
              </Button>
            </Box>
          )}
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ borderTop: `1px solid ${zinc[800]}`, px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: zinc[400] }}>
          Cancel
        </Button>
        {tabValue === 0 && (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!hasChanges || isLoading}
            sx={{
              backgroundColor: zinc[100],
              color: zinc[900],
              '&:hover': {
                backgroundColor: zinc[200],
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
