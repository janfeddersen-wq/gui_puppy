import { createTheme, Theme } from '@mui/material/styles';

// Zinc color palette (similar to Tailwind's zinc)
export const zinc = {
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#a1a1aa',
  500: '#71717a',
  600: '#52525b',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
  950: '#09090b',
};

// Shared typography and shape settings
const sharedSettings = {
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '0.95rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
  },
  shape: {
    borderRadius: 8,
  },
};

// Dark theme (Zinc)
export const zincDarkTheme = createTheme({
  ...sharedSettings,
  palette: {
    mode: 'dark',
    primary: {
      main: zinc[100],
      light: zinc[50],
      dark: zinc[300],
      contrastText: zinc[900],
    },
    secondary: {
      main: zinc[400],
      light: zinc[300],
      dark: zinc[500],
    },
    background: {
      default: zinc[950],
      paper: zinc[900],
    },
    text: {
      primary: zinc[100],
      secondary: zinc[400],
      disabled: zinc[600],
    },
    divider: zinc[800],
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    success: {
      main: '#22c55e',
      light: '#4ade80',
      dark: '#16a34a',
    },
    action: {
      active: zinc[100],
      hover: 'rgba(255, 255, 255, 0.08)',
      selected: 'rgba(255, 255, 255, 0.16)',
      disabled: zinc[600],
      disabledBackground: zinc[800],
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${zinc[700]} ${zinc[900]}`,
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: 8,
            height: 8,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            backgroundColor: zinc[700],
            borderRadius: 4,
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            backgroundColor: zinc[900],
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: zinc[700],
            },
            '&:hover fieldset': {
              borderColor: zinc[500],
            },
            '&.Mui-focused fieldset': {
              borderColor: zinc[400],
            },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
          },
        },
      },
    },
  },
});

// Light theme (Zinc Light)
export const zincLightTheme = createTheme({
  ...sharedSettings,
  palette: {
    mode: 'light',
    primary: {
      main: zinc[900],
      light: zinc[700],
      dark: zinc[950],
      contrastText: zinc[50],
    },
    secondary: {
      main: zinc[600],
      light: zinc[500],
      dark: zinc[700],
    },
    background: {
      default: zinc[50],
      paper: '#ffffff',
    },
    text: {
      primary: zinc[900],
      secondary: zinc[600],
      disabled: zinc[400],
    },
    divider: zinc[200],
    error: {
      main: '#dc2626',
      light: '#ef4444',
      dark: '#b91c1c',
    },
    success: {
      main: '#16a34a',
      light: '#22c55e',
      dark: '#15803d',
    },
    action: {
      active: zinc[900],
      hover: 'rgba(0, 0, 0, 0.04)',
      selected: 'rgba(0, 0, 0, 0.08)',
      disabled: zinc[400],
      disabledBackground: zinc[200],
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${zinc[400]} ${zinc[100]}`,
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: 8,
            height: 8,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            backgroundColor: zinc[400],
            borderRadius: 4,
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            backgroundColor: zinc[100],
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: zinc[300],
            },
            '&:hover fieldset': {
              borderColor: zinc[500],
            },
            '&.Mui-focused fieldset': {
              borderColor: zinc[600],
            },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        },
      },
    },
  },
});

// Theme type for the context
export type ThemeMode = 'dark' | 'light';

// Helper to get theme by mode
export const getTheme = (mode: ThemeMode): Theme => {
  return mode === 'dark' ? zincDarkTheme : zincLightTheme;
};

// Keep backwards compatibility
export const zincTheme = zincDarkTheme;
