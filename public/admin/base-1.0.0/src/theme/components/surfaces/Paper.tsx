import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const Paper: Components<Omit<Theme, 'components'>>['MuiPaper'] = {
  styleOverrides: {
    root: ({ theme }) => ({
      padding: theme.spacing(3.5),
      backgroundColor: theme.palette.info.lighter,
      borderRadius: theme.shape.borderRadius * 2.5,
      boxShadow: 'none',

      '&.MuiMenu-paper': {
        padding: theme.spacing(1),
        boxShadow: theme.customShadows[0],
      },
    }),
  },
};

export default Paper;
