import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  IconButton,
  Autocomplete,
  useTheme,
} from '@mui/material';
import { Clear } from '@mui/icons-material';
import type { AppConfig, ModelPinResult } from '../../types';

interface ModelPinsTabProps {
  config: AppConfig;
  onSetModelPin: (agentName: string, modelName: string) => void;
  modelPinResult: ModelPinResult | null;
}

export function ModelPinsTab({ config, onSetModelPin, modelPinResult }: ModelPinsTabProps) {
  const theme = useTheme();
  const [selectedPinAgent, setSelectedPinAgent] = useState<string>('');
  const [selectedPinModel, setSelectedPinModel] = useState<string>('');

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

  return (
    <>
      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
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
          <Typography variant="subtitle2" sx={{ mb: 1, color: theme.palette.text.secondary }}>
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
                    backgroundColor: theme.palette.background.default,
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                      {agent?.label || agentName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                      → {modelName}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleModelPinClear(agentName)}
                    sx={{ color: theme.palette.text.secondary }}
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
      <Box sx={{ p: 2, backgroundColor: theme.palette.background.default, borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, color: theme.palette.text.secondary }}>
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
                backgroundColor: theme.palette.background.paper,
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
                backgroundColor: theme.palette.background.paper,
              },
            }}
          />
          <Button
            variant="contained"
            onClick={handleModelPinSave}
            disabled={!selectedPinAgent || !selectedPinModel}
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              '&:hover': { backgroundColor: theme.palette.primary.dark },
            }}
          >
            Add Pin
          </Button>
        </Box>
      </Box>
    </>
  );
}
