import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Chip,
  useTheme,
} from '@mui/material';
import type { OAuthStatus } from '../../types';

interface OAuthTabProps {
  oauthStatus: OAuthStatus | null;
  onOAuthLogin: () => void;
  onOAuthLogout: () => void;
  oauthLoading: boolean;
}

export function OAuthTab({ oauthStatus, onOAuthLogin, onOAuthLogout, oauthLoading }: OAuthTabProps) {
  const theme = useTheme();

  return (
    <>
      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
        Sign in with your Claude account to access Claude Code models via OAuth.
      </Typography>

      {oauthStatus === null ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
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
              <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
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
              borderColor: theme.palette.divider,
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.text.secondary,
                backgroundColor: theme.palette.action.hover,
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
    </>
  );
}
