import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const Card: Components<Omit<Theme, 'components'>>['MuiCard'] = {
  styleOverrides: {
    root: {
      padding: 0,
    },
  },
};

export default Card;
