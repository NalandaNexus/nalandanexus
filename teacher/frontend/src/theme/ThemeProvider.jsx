import React from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { teacherTheme } from './teacherTheme';

export default function TeacherThemeProvider({ children }) {
  return (
    <MuiThemeProvider theme={teacherTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
