import { Stack, Typography } from '@mui/material';

const Error404 = () => {
  return (
    <Stack direction="column" alignItems="center" justifyContent="center">
      <Typography mt={3} variant="h1" color="text.disabled">
        404
      </Typography>
      <Typography variant="h6">Page not found!</Typography>
    </Stack>
  );
};

export default Error404;
