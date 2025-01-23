import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';

const PageLoader = () => {
  return (
    <Box px={3.75} width={1} minHeight="100vh">
      <LinearProgress />
    </Box>
  );
};

export default PageLoader;
