import {
  Box,
  Typography,
  FormControl,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  Tooltip,
  Alert,
  Autocomplete,
  useTheme,
} from '@mui/material';
import type { AppConfig, ConfigUpdate } from '../../types';

interface GeneralTabProps {
  config: AppConfig;
  localConfig: ConfigUpdate;
  onChange: <K extends keyof ConfigUpdate>(key: K, value: ConfigUpdate[K]) => void;
}

export function GeneralTab({ config, localConfig, onChange }: GeneralTabProps) {
  const theme = useTheme();
  const selectedAgent = config.available.agents.find((a) => a.name === localConfig.agent);

  return (
    <>
      {/* Agent Selection */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: theme.palette.text.secondary }}>
          Agent
        </Typography>
        <FormControl fullWidth size="small">
          <Autocomplete
            value={config.available.agents.find((a) => a.name === localConfig.agent) || null}
            onChange={(_, newValue) => onChange('agent', newValue?.name || '')}
            options={config.available.agents}
            getOptionLabel={(option) => option.label || option.name}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box>
                  <Typography variant="body2">{option.label || option.name}</Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
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
                backgroundColor: theme.palette.background.default,
              },
            }}
          />
        </FormControl>
        {selectedAgent?.description && (
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 0.5, display: 'block' }}>
            {selectedAgent.description}
          </Typography>
        )}
      </Box>

      {/* Model Selection */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: theme.palette.text.secondary }}>
          Model
        </Typography>
        <Autocomplete
          value={localConfig.model || ''}
          onChange={(_, newValue) => onChange('model', newValue || '')}
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
              backgroundColor: theme.palette.background.default,
            },
          }}
        />
      </Box>

      {/* Temperature */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: theme.palette.text.secondary }}>
          Temperature
        </Typography>
        <TextField
          type="number"
          size="small"
          fullWidth
          value={localConfig.temperature ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onChange('temperature', val === '' ? null : parseFloat(val));
          }}
          placeholder="Default (model-specific)"
          inputProps={{ min: 0, max: 2, step: 0.1 }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: theme.palette.background.default,
            },
          }}
        />
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
          0 = deterministic, 1 = creative, 2 = very random
        </Typography>
      </Box>

      <Divider sx={{ my: 2, borderColor: theme.palette.divider }} />

      {/* Toggles */}
      <Typography variant="subtitle2" sx={{ mb: 1, color: theme.palette.text.secondary }}>
        Options
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Tooltip title="Auto-save conversation sessions" placement="right">
          <FormControlLabel
            control={
              <Switch
                checked={localConfig.auto_save ?? false}
                onChange={(e) => onChange('auto_save', e.target.checked)}
                size="small"
              />
            }
            label="Auto-save sessions"
            sx={{ color: theme.palette.text.primary }}
          />
        </Tooltip>

        <Tooltip title="Hide agent thinking/reasoning messages" placement="right">
          <FormControlLabel
            control={
              <Switch
                checked={localConfig.suppress_thinking ?? false}
                onChange={(e) => onChange('suppress_thinking', e.target.checked)}
                size="small"
              />
            }
            label="Suppress thinking messages"
            sx={{ color: theme.palette.text.primary }}
          />
        </Tooltip>

        <Tooltip title="Hide informational status messages" placement="right">
          <FormControlLabel
            control={
              <Switch
                checked={localConfig.suppress_info ?? false}
                onChange={(e) => onChange('suppress_info', e.target.checked)}
                size="small"
              />
            }
            label="Suppress info messages"
            sx={{ color: theme.palette.text.primary }}
          />
        </Tooltip>
      </Box>

      {config.current.yolo_mode && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          YOLO mode is enabled - agent will execute without confirmations
        </Alert>
      )}
    </>
  );
}
