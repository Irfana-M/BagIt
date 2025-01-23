import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const Divider: Components<Omit<Theme, 'components'>>['MuiDivider'] = {
  styleOverrides: {
    root: ({ theme }) => ({
      height: 2,
      alignItems: 'center',
      margin: theme.spacing(3, 0),
      backgroundColor: theme.palette.info.main,
      borderColor: theme.palette.info.lighter,
      width: '100%',

      '&.MuiDivider-withChildren': {
        height: '0 !important',
        fontWeight: 600,
        color: theme.palette.text.primary,
        backgroundColor: 'transparent',
        '&::before': {
          backgroundColor: theme.palette.info.light,
        },
        '&::after': {
          backgroundColor: theme.palette.info.light,
        },
      },
    }),
  },
};

export default Divider;
