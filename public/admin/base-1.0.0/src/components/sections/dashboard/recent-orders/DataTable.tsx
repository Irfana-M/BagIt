import { useEffect } from 'react';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DataGrid, GridColDef, useGridApiRef, GridApi } from '@mui/x-data-grid';
import DataGridFooter from 'components/common/DataGridFooter';
import ActionMenu from 'components/common/ActionMenu';
import Image from 'components/base/Image';
import { formatNumber } from 'helpers/formatNumber';
import { rows } from 'data/recentOrdersData';

const actions = [
  {
    id: 1,
    icon: 'mage:refresh',
    title: 'Refresh',
  },
  {
    id: 2,
    icon: 'solar:export-linear',
    title: 'Export',
  },
  {
    id: 3,
    icon: 'mage:share',
    title: 'Share',
  },
];

const columns: GridColDef<(typeof rows)[number]>[] = [
  {
    field: '__check__',
    headerName: '',
    width: 40,
    sortable: false,
    disableColumnMenu: true,
  },
  {
    field: 'id',
    headerName: 'Tracking no',
    editable: false,
    align: 'left',
    flex: 2,
    minWidth: 120,
  },
  {
    field: 'product',
    headerName: 'Product Name',
    editable: false,
    align: 'left',
    flex: 2,
    minWidth: 220,
    valueGetter: (params: { name: string; image: string }) => {
      return params.name;
    },
    renderCell: (params) => {
      return (
        <Stack height={1} spacing={1.5} alignItems="center" justifyContent="flex-start">
          <Image
            src={params.row.product.image}
            height={30}
            width={30}
            sx={{ objectFit: 'cover', borderRadius: 1.5 }}
          />
          <Typography variant="caption" fontWeight={600}>
            {params.row.product.name}
          </Typography>
        </Stack>
      );
    },
    sortComparator: (v1, v2) => v1.localeCompare(v2),
  },
  {
    field: 'price',
    headerName: 'Price',
    headerAlign: 'left',
    editable: false,
    flex: 1,
    minWidth: 140,
    renderCell: (params) => (
      <Typography variant="caption">
        {formatNumber(params.value, {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
        })}
      </Typography>
    ),
  },
  {
    field: 'inStock',
    headerName: 'In Stock',
    editable: false,
    align: 'left',
    flex: 2,
    minWidth: 140,
  },
  {
    field: 'totalOrder',
    headerName: 'Total Order',
    editable: false,
    headerAlign: 'left',
    align: 'left',
    flex: 2,
    minWidth: 140,
    renderCell: (params) => (
      <Stack direction="column" alignItems="flex-start" justifyContent="center" height={1}>
        <Chip label={params.value} size="small" color="secondary" sx={{ borderRadius: 1.75 }} />
      </Stack>
    ),
  },
  {
    field: 'pending',
    headerName: 'Pending',
    headerAlign: 'left',
    align: 'left',
    editable: false,
    flex: 1,
    minWidth: 140,
    renderCell: (params) => (
      <Stack direction="column" alignItems="flex-start" justifyContent="center" height={1}>
        <Chip label={params.value} size="small" color="warning" sx={{ borderRadius: 1.75 }} />
      </Stack>
    ),
  },
  {
    field: 'canceled',
    headerName: 'Canceled',
    headerAlign: 'left',
    align: 'left',
    editable: false,
    flex: 1,
    minWidth: 140,
    renderCell: (params) => (
      <Stack direction="column" alignItems="flex-start" justifyContent="center" height={1}>
        <Chip label={params.value} size="small" color="error" sx={{ borderRadius: 1.75 }} />
      </Stack>
    ),
  },
  {
    field: 'delevered',
    headerName: 'Delevered',
    headerAlign: 'left',
    align: 'left',
    editable: false,
    flex: 1,
    minWidth: 140,
    renderCell: (params) => (
      <Stack direction="column" alignItems="flex-start" justifyContent="center" height={1}>
        <Chip label={params.value} size="small" color="success" sx={{ borderRadius: 1.75 }} />
      </Stack>
    ),
  },
  {
    field: 'balance',
    headerName: 'Balance',
    headerAlign: 'right',
    align: 'right',
    editable: false,
    flex: 1,
    minWidth: 100,
    renderCell: (params) => (
      <Typography variant="caption">
        {formatNumber(params.value, {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
        })}
      </Typography>
    ),
  },
  {
    field: 'action',
    headerAlign: 'right',
    align: 'right',
    editable: false,
    sortable: false,
    flex: 1,
    minWidth: 100,
    renderHeader: () => <ActionMenu actions={actions} />,
    renderCell: () => <ActionMenu actions={actions} />,
  },
];

interface TaskOverviewTableProps {
  searchText: string;
}

const DataTable = ({ searchText }: TaskOverviewTableProps) => {
  const apiRef = useGridApiRef<GridApi>();

  useEffect(() => {
    apiRef.current.setQuickFilterValues(searchText.split(/\b\W+\b/).filter((word) => word !== ''));
  }, [searchText]);

  return (
    <DataGrid
      apiRef={apiRef}
      density="standard"
      columns={columns}
      rows={rows}
      rowHeight={50}
      disableColumnResize
      disableColumnMenu
      disableColumnSelector
      disableRowSelectionOnClick
      initialState={{
        pagination: { paginationModel: { pageSize: 4 } },
      }}
      autosizeOptions={{
        includeOutliers: true,
        includeHeaders: false,
        outliersFactor: 1,
        expand: true,
      }}
      slots={{
        pagination: DataGridFooter,
      }}
      checkboxSelection
      pageSizeOptions={[4]}
    />
  );
};

export default DataTable;
