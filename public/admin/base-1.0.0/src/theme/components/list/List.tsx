import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const List: Components<Omit<Theme, 'components'>>['MuiList'] = {
  styleOverrides: {
    root: {
      padding: 0,
    },
  },
};

export default List;
