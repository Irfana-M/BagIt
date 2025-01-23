import { PropsWithChildren } from 'react';
import { useLocation } from 'react-router-dom';
import Stack from '@mui/material/Stack';
import Image from 'components/base/Image';
import SignInImage from 'assets/images/auth/signin-image.png';
import SignUpImage from 'assets/images/auth/signup-image.png';

const AuthLayout = ({ children }: PropsWithChildren) => {
  const location = useLocation();
  const pathname = location.pathname.split('/').pop();

  return (
    <Stack justifyContent="space-between" height="100vh">
      <Stack
        px={{ xs: 2, sm: 5 }}
        width={{ xs: 1, lg: 450 }}
        height="auto"
        minHeight={1}
        bgcolor="info.lighter"
        overflow="scroll"
      >
        {children}
      </Stack>
      <Stack
        flex={1}
        height={1}
        alignItems="center"
        justifyContent="center"
        direction="column"
        display={{ xs: 'none', lg: 'flex' }}
      >
        <Image src={pathname === 'signin' ? SignInImage : SignUpImage} height="55%" />
      </Stack>
    </Stack>
  );
};

export default AuthLayout;
