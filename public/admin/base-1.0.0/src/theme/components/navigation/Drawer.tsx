import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const Drawer: Components<Omit<Theme, 'components'>>['MuiDrawer'] = {
  styleOverrides: {
    root: {
      '&:hover, &:focus': {
        '*::-webkit-scrollbar, *::-webkit-scrollbar-thumb': {
          visibility: 'visible',
        },
      },
      flexShrink: 0,
      overflowX: 'hidden',
      whiteSpace: 'nowrap',
    },
    paper: ({ theme }) => ({
      height: '100vh',
      padding: 0,
      border: 0,
      borderRadius: 0,
      backgroundColor: theme.palette.info.lighter,
      boxShadow: 'none',
      boxSizing: 'border-box',
    }),
  },
};

export default Drawer;
