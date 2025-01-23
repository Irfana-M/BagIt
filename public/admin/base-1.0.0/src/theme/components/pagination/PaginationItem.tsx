import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';

const PaginationItem: Components<Omit<Theme, 'components'>>['MuiPaginationItem'] = {
  styleOverrides: {
    root: ({ theme }) => ({
      color: theme.palette.text.primary,
      fontSize: theme.typography.body2.fontSize,
      minWidth: 28,
      height: 28,
      '&.Mui-selected': {
        color: theme.palette.info.lighter,
        backgroundColor: theme.palette.primary.main,
        '&:hover': { backgroundColor: theme.palette.primary.main },
      },
    }),
  },
};

export default PaginationItem;
