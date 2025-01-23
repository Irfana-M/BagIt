import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const Rating: Components<Omit<Theme, 'components'>>['MuiRating'] = {
  styleOverrides: {
    root: {},
    icon: ({ theme }) => ({
      marginRight: theme.spacing(0.25),
      color: theme.palette.warning.main,
    }),
    iconEmpty: ({ theme }) => ({
      marginRight: theme.spacing(0.25),
      color: theme.palette.transparent.warning.dark,
    }),
    sizeSmall: ({ theme }) => ({
      fontSize: theme.typography.body1.fontSize,
    }),
    sizeMedium: ({ theme }) => ({
      fontSize: theme.typography.h5.fontSize,
    }),
    sizeLarge: ({ theme }) => ({
      fontSize: theme.typography.h3.fontSize,
    }),
  },
};

export default Rating;
