import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ActionMenu from 'components/common/ActionMenu';
import AnalyticsChart from './AnalyticsChart';

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

const AnalyticsData = [
  {
    id: 1,
    value: 60,
    name: 'Sale',
  },
  {
    id: 2,
    value: 45,
    name: 'Distribute',
  },
  {
    id: 3,
    value: 35,
    name: 'Return',
  },
  {
    id: 4,
    value: 30,
    name: '',
  },
];

const Analytics = () => {
  return (
    <Paper sx={{ px: 0, height: 410 }}>
      <Stack mt={-0.5} px={3.75} alignItems="center" justifyContent="space-between">
        <Typography variant="h6" color="text.secondary" zIndex={1000}>
          Analytics
        </Typography>

        <ActionMenu actions={actions} />
      </Stack>

      <AnalyticsChart data={AnalyticsData} sx={{ mt: -5.5, mx: 'auto', width: 300, height: '370px !important' }} />
    </Paper>
  );
};

export default Analytics;
