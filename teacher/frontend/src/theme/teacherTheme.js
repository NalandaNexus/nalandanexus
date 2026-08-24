import { createTheme } from '@mui/material/styles';

/**
 * Nalanda Nexus - Teacher Dashboard Pro Tier Centralized MUI Theme
 * Pure visual identity: No default MUI blue (#1976D2), no default Roboto.
 */
export const teacherTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#22355E', // Ink Indigo
      light: '#314B82',
      dark: '#16233F',
      contrastText: '#EDEAE0',
    },
    secondary: {
      main: '#AB5236', // Brick Terracotta
      light: '#C4674B',
      dark: '#8C3E26',
      contrastText: '#FFFFFF',
    },
    pro: {
      main: '#C99A2E', // Turmeric Gold (Accent)
      light: '#DFC168',
      dark: '#9E741B',
      contrastText: '#2B2B28',
    },
    statusGood: {
      main: '#5C7A5E', // Moss Sage
      light: '#789D7A',
      dark: '#425843',
      contrastText: '#FFFFFF',
    },
    statusAttention: {
      main: '#C99A2E', // Amber
      light: '#DFC168',
      dark: '#9E741B',
      contrastText: '#2B2B28',
    },
    statusBlocked: {
      main: '#C1352B', // Red
      light: '#D95248',
      dark: '#99241B',
      contrastText: '#FFFFFF',
    },
    statusNeutral: {
      main: '#9B9690', // Grey
      light: '#B5B1AC',
      dark: '#7D7973',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#0B101B',
      paper: '#131B2E',
      surface: '#182238',
      parchment: '#EDEAE0',
    },
    text: {
      primary: '#EDEAE0',
      secondary: '#9B9690',
      charcoal: '#2B2B28',
    },
    divider: '#243354',
  },
  typography: {
    fontFamily: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'].join(','),
    h1: {
      fontFamily: ['Fraunces', 'serif'].join(','),
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: '#EDEAE0',
    },
    h2: {
      fontFamily: ['Fraunces', 'serif'].join(','),
      fontWeight: 700,
      letterSpacing: '-0.015em',
      color: '#EDEAE0',
    },
    h3: {
      fontFamily: ['Fraunces', 'serif'].join(','),
      fontWeight: 600,
      letterSpacing: '-0.01em',
      color: '#EDEAE0',
    },
    h4: {
      fontFamily: ['Fraunces', 'serif'].join(','),
      fontWeight: 600,
      color: '#EDEAE0',
    },
    h5: {
      fontFamily: ['Fraunces', 'serif'].join(','),
      fontWeight: 600,
      color: '#EDEAE0',
    },
    h6: {
      fontFamily: ['Fraunces', 'serif'].join(','),
      fontWeight: 600,
      color: '#EDEAE0',
    },
    subtitle1: {
      fontFamily: ['Inter', 'sans-serif'].join(','),
      fontSize: '0.925rem',
      lineHeight: 1.5,
      color: '#9B9690',
    },
    subtitle2: {
      fontFamily: ['Inter', 'sans-serif'].join(','),
      fontSize: '0.8125rem',
      fontWeight: 500,
      color: '#9B9690',
    },
    body1: {
      fontFamily: ['Inter', 'sans-serif'].join(','),
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: '#EDEAE0',
    },
    body2: {
      fontFamily: ['Inter', 'sans-serif'].join(','),
      fontSize: '0.8125rem',
      lineHeight: 1.55,
      color: '#B5B1AC',
    },
    button: {
      fontFamily: ['Inter', 'sans-serif'].join(','),
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.01em',
    },
    caption: {
      fontFamily: ['Inter', 'sans-serif'].join(','),
      fontSize: '0.75rem',
      color: '#9B9690',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0B101B',
          color: '#EDEAE0',
          scrollbarColor: '#243354 #0B101B',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          fontWeight: 600,
          fontSize: '0.8125rem',
          padding: '7px 16px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
          },
          '&:focus-visible': {
            outline: '2px solid #C99A2E',
            outlineOffset: '2px',
          },
        },
        containedPrimary: {
          backgroundColor: '#22355E',
          color: '#EDEAE0',
          border: '1px solid #314B82',
          '&:hover': {
            backgroundColor: '#314B82',
            borderColor: '#4262A8',
          },
        },
        containedSecondary: {
          backgroundColor: '#AB5236',
          color: '#FFFFFF',
          border: '1px solid #C4674B',
          '&:hover': {
            backgroundColor: '#94452C',
          },
        },
        outlined: {
          borderColor: '#243354',
          color: '#EDEAE0',
          '&:hover': {
            backgroundColor: 'rgba(34, 53, 94, 0.25)',
            borderColor: '#314B82',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#131B2E',
          border: '1px solid #243354',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(3, 7, 18, 0.4)',
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#131B2E',
          border: '1px solid #243354',
          backgroundImage: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.75rem',
          height: '24px',
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          borderCollapse: 'separate',
          borderSpacing: '0',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#243354',
          padding: '12px 16px',
          fontSize: '0.8125rem',
          color: '#EDEAE0',
        },
        head: {
          backgroundColor: '#0F1626',
          color: '#9B9690',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.15s ease',
          '&:hover': {
            backgroundColor: 'rgba(34, 53, 94, 0.3) !important',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0F1626',
          borderLeft: '1px solid #243354',
          backgroundImage: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#131B2E',
          border: '1px solid #243354',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          backgroundImage: 'none',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#0B101B',
          border: '1px solid #243354',
          color: '#EDEAE0',
          fontSize: '0.75rem',
          fontWeight: 500,
          borderRadius: '8px',
          padding: '6px 10px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: '#C99A2E',
          height: '3px',
          borderRadius: '3px 3px 0 0',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8125rem',
          color: '#9B9690',
          minHeight: '42px',
          padding: '6px 16px',
          '&.Mui-selected': {
            color: '#EDEAE0',
          },
          '&:focus-visible': {
            outline: '2px solid #C99A2E',
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '10px',
            backgroundColor: '#0B101B',
            color: '#EDEAE0',
            '& fieldset': {
              borderColor: '#243354',
            },
            '&:hover fieldset': {
              borderColor: '#314B82',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#C99A2E',
              borderWidth: '1.5px',
            },
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: '999px',
          backgroundColor: '#1E2C48',
        },
      },
    },
  },
});

export default teacherTheme;
