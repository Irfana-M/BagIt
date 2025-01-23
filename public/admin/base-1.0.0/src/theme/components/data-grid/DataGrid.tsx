import { Theme } from '@mui/material';
import { Components } from '@mui/material/styles/components';
import IconifyIcon from 'components/base/IconifyIcon';

const DataGrid: Components<Omit<Theme, 'components'>>['MuiDataGrid'] = {
  defaultProps: {
    slots: {
      columnSortedDescendingIcon: (props) => (
        <IconifyIcon icon="solar:alt-arrow-up-bold" {...props} />
      ),
      columnSortedAscendingIcon: (props) => (
        <IconifyIcon icon="solar:alt-arrow-down-bold" {...props} />
      ),
    },
  },
  styleOverrides: {
    root: ({ theme }) => ({
      border: 'none',
      borderRadius: '0 !important',
      '--DataGrid-rowBorderColor': theme.palette.info.lighter,
      '&:hover, &:focus': {
        '*::-webkit-scrollbar, *::-webkit-scrollbar-thumb': {
          visibility: 'visible',
        },
      },
      '& .MuiDataGrid-scrollbar--vertical': {
        visibility: 'hidden',
      },
      '& .MuiDataGrid-scrollbarFiller': {
        minWidth: 0,
      },
    }),
    row: ({ theme }) => ({
      borderRadius: theme.shape.borderRadius * 1.5,
      '&:nth-of-type(even)': {
        backgroundColor: theme.palette.info.main,
      },
      '&:hover': {
        backgroundColor: theme.palette.info.lighter,
        '&:nth-of-type(even)': {
          backgroundColor: theme.palette.info.main,
        },
      },
    }),
    cell: ({ theme }) => ({
      padding: 0,
      color: theme.palette.primary.darker,
      fontSize: theme.typography.caption.fontSize,
      fontWeight: 600,
      '&:focus-within': {
        outline: 'none !important',
      },
    }),
    cellCheckbox: {
      justifyContent: 'flex-start',
    },
    columnHeaderCheckbox: {
      '& .MuiDataGrid-columnHeaderTitleContainer': {
        justifyContent: 'flex-start',
      },
    },
    columnHeader: ({ theme }) => ({
      padding: 0,
      borderBottom: 1,
      borderColor: `${theme.palette.info.main} !important`,
      height: '3rem !important',
      '&:focus-within': {
        outline: 'none !important',
      },
    }),
    columnHeaderTitle: ({ theme }) => ({
      color: theme.palette.text.primary,
      fontSize: theme.typography.caption.fontSize,
      fontWeight: 500,
    }),
    iconButtonContainer: () => ({
      '& .MuiIconButton-root': {
        backgroundColor: 'transparent !important',
        border: 'none',
      },
    }),
    columnSeparator: {
      display: 'none',
    },
    selectedRowCount: {
      display: 'none',
    },
    sortIcon: ({ theme }) => ({
      fontSize: theme.typography.caption.fontSize,
    }),
    footerContainer: ({ theme }) => ({
      border: 0,
      borderTop: 1,
      borderStyle: 'solid',
      borderColor: `${theme.palette.info.main} !important`,
    }),
  },
};

export default DataGrid;
