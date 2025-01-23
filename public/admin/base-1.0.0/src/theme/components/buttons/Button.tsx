import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const Button: Components<Omit<Theme, 'components'>>['MuiButton'] = {
  defaultProps: {
    disableElevation: true,
  },
  styleOverrides: {
    root: ({ theme }) => ({
      color: theme.palette.info.light,
      borderRadius: theme.shape.borderRadius * 2.5,
      textTransform: 'initial',
      fontWeight: 500,
    }),
    text: ({ theme }) => ({
      color: theme.palette.text.secondary,
      backgroundColor: 'transparent !important',
    }),
    containedPrimary: ({ theme }) => ({
      color: theme.palette.info.light,
      backgroundColor: theme.palette.primary.main,
      '&:hover': { backgroundColor: theme.palette.primary.main },
    }),
    containedSecondary: ({ theme }) => ({
      color: theme.palette.text.primary,
      backgroundColor: theme.palette.secondary.light,
      '&:hover': { backgroundColor: theme.palette.secondary.light },
    }),
    sizeLarge: ({ theme }) => ({
      padding: theme.spacing(1, 3),
      fontSize: theme.typography.body1.fontSize,
    }),
    sizeMedium: ({ theme }) => ({
      padding: theme.spacing(0.875, 2.75),
      fontSize: theme.typography.body2.fontSize,
    }),
    sizeSmall: ({ theme }) => ({
      padding: theme.spacing(0.875, 2.35),
      fontSize: theme.typography.caption.fontSize,
    }),
    startIcon: {
      marginRight: 12,
    },
    endIcon: {
      marginLeft: 6,
    },
  },
};

export default Button;
