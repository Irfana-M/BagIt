import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Sidebar from './sidebar';
import Topbar from './topbar';
import Footer from './footer';

const MainLayout = ({ children }: React.PropsWithChildren) => {
  const [expand, setExpand] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const drawerWidth = 240;
  const miniDrawerWidth = 90;

  return (
    <Stack>
      <Sidebar
        expand={expand}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        drawerWidth={drawerWidth}
        miniDrawerWidth={miniDrawerWidth}
      />
      <Box component="main" flexGrow={1} sx={{ overflowX: 'hidden' }}>
        <Topbar
          expand={expand}
          mobileOpen={mobileOpen}
          setExpand={setExpand}
          setMobileOpen={setMobileOpen}
          drawerWidth={drawerWidth}
          miniDrawerWidth={miniDrawerWidth}
        />
        <Box mt={12}>{children}</Box>
        <Footer />
      </Box>
    </Stack>
  );
};

export default MainLayout;
