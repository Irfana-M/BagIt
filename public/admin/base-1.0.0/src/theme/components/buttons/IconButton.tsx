import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const IconButton: Components<Omit<Theme, 'components'>>['MuiIconButton'] = {
  styleOverrides: {
    root: ({ theme }) => ({
      color: theme.palette.text.secondary,
      backgroundColor: 'transparent',
      marginLeft: 0,
    }),
    sizeLarge: ({ theme }) => ({
      padding: theme.spacing(1.25),
      fontSize: theme.typography.h2.fontSize,
    }),
    sizeMedium: ({ theme }) => ({
      padding: theme.spacing(1),
      fontSize: theme.typography.h3.fontSize,
    }),
    sizeSmall: ({ theme }) => ({
      padding: theme.spacing(0.75),
      fontSize: theme.typography.h5.fontSize,
    }),
  },
};

export default IconButton;
