import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  IconButton,
  InputAdornment,
  Chip,
  useTheme,
} from '@mui/material';
import { Visibility, VisibilityOff, Check } from '@mui/icons-material';
import type { AppConfig, ApiKeyResult } from '../../types';

const API_KEY_LABELS: Record<string, string> = {
  OPENAI_API_KEY: 'OpenAI',
  ANTHROPIC_API_KEY: 'Anthropic',
  GEMINI_API_KEY: 'Google Gemini',
  CEREBRAS_API_KEY: 'Cerebras',
  OPENROUTER_API_KEY: 'OpenRouter',
  AZURE_OPENAI_API_KEY: 'Azure OpenAI',
  AZURE_OPENAI_ENDPOINT: 'Azure OpenAI Endpoint',
};

interface ApiKeysTabProps {
  config: AppConfig;
  onSetApiKey: (keyName: string, value: string) => void;
  apiKeyResult: ApiKeyResult | null;
}

export function ApiKeysTab({ config, onSetApiKey, apiKeyResult }: ApiKeysTabProps) {
  const theme = useTheme();
  const [editingApiKey, setEditingApiKey] = useState<string | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [showApiKeyValue, setShowApiKeyValue] = useState(false);

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

  return (
    <>
      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
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
            <Box key={keyName} sx={{ p: 2, backgroundColor: theme.palette.background.default, borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isEditing ? 1.5 : 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
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
                        backgroundColor: theme.palette.action.selected,
                        color: theme.palette.text.secondary,
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
                        sx={{ color: theme.palette.text.secondary, minWidth: 'auto' }}
                      >
                        {keyInfo?.is_set ? 'Change' : 'Set'}
                      </Button>
                      {keyInfo?.is_set && (
                        <Button
                          size="small"
                          onClick={() => handleApiKeyClear(keyName)}
                          sx={{ color: theme.palette.error.main, minWidth: 'auto' }}
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
                        backgroundColor: theme.palette.background.paper,
                      },
                    }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleApiKeySave}
                    disabled={!apiKeyValue}
                    sx={{
                      backgroundColor: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText,
                      '&:hover': { backgroundColor: theme.palette.primary.dark },
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
                    sx={{ color: theme.palette.text.secondary }}
                  >
                    Cancel
                  </Button>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </>
  );
}
