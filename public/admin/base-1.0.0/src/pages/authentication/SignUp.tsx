import { useState, ChangeEvent, FormEvent } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import IconifyIcon from 'components/base/IconifyIcon';
import Image from 'components/base/Image';
import Logo from 'assets/images/Logo.png';
import paths from 'routes/paths';

interface User {
  [key: string]: string;
}

const SignUp = () => {
  const [user, setUser] = useState<User>({ name: '', email: '', username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(user);
  };

  return (
    <Stack mx="auto" direction="column" alignItems="center" width={1} maxWidth={450}>
      <ButtonBase LinkComponent={Link} href="/" sx={{ mt: 6 }} disableRipple>
        <Image src={Logo} alt="logo" height={92} width={92} />
      </ButtonBase>
      <Typography mt={4} variant="h2" fontWeight={600}>
        Sign Up
      </Typography>
      <Stack mt={6} spacing={2.5} width={1}>
        <Button
          variant="contained"
          color="secondary"
          size="large"
          fullWidth
          startIcon={<IconifyIcon icon="logos:google-icon" />}
          sx={{ bgcolor: 'info.main', '&:hover': { bgcolor: 'info.main' } }}
        >
          Google
        </Button>
        <Button
          variant="contained"
          color="secondary"
          fullWidth
          startIcon={<IconifyIcon icon="mage:facebook" color="secondary.dark" sx={{ mr: -0.75 }} />}
          sx={{ bgcolor: 'info.main', '&:hover': { bgcolor: 'info.main' } }}
        >
          Facebook
        </Button>
      </Stack>

      <Divider sx={{ my: 4.5 }}>Or</Divider>

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          id="name"
          name="name"
          type="text"
          color="secondary"
          label="Full Name"
          value={user.name}
          onChange={handleInputChange}
          variant="filled"
          placeholder="Ex- Jhon Doe"
          autoComplete="email"
          sx={{ mt: 3 }}
          fullWidth
          autoFocus
          required
        />
        <TextField
          id="email"
          name="email"
          type="email"
          color="secondary"
          label="Email Address"
          value={user.email}
          onChange={handleInputChange}
          variant="filled"
          placeholder="mail@example.com"
          autoComplete="email"
          sx={{ mt: 6 }}
          fullWidth
          required
        />
        <TextField
          id="username"
          name="username"
          type="text"
          color="secondary"
          label="Username"
          value={user.username}
          onChange={handleInputChange}
          variant="filled"
          placeholder="hello123"
          autoComplete="email"
          sx={{ mt: 6 }}
          fullWidth
          required
        />
        <TextField
          id="password"
          name="password"
          label="Password"
          color="secondary"
          type={showPassword ? 'text' : 'password'}
          value={user.password}
          onChange={handleInputChange}
          variant="filled"
          placeholder="Min. 8 characters"
          autoComplete="current-password"
          sx={{ mt: 6 }}
          fullWidth
          required
          InputProps={{
            endAdornment: (
              <InputAdornment
                position="end"
                sx={{
                  opacity: user.password ? 1 : 0,
                  pointerEvents: user.password ? 'auto' : 'none',
                }}
              >
                <IconButton
                  size="small"
                  aria-label="toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  sx={{ border: 'none', bgcolor: 'transparent !important' }}
                  edge="end"
                >
                  <IconifyIcon
                    icon={showPassword ? 'mdi:visibility' : 'mdi:visibility-off'}
                    color="neutral.main"
                  />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <FormControlLabel
          control={<Checkbox id="checkbox" name="checkbox" size="large" color="primary" />}
          label={
            <Typography variant="body1">
              By creating an account you agree to the{' '}
              <Link href="#!" sx={{ textDecoration: 'underline' }}>
                terms of use
              </Link>{' '}
              and our{' '}
              <Link href="#!" sx={{ textDecoration: 'underline' }}>
                privacy policy
              </Link>
              .
            </Typography>
          }
          sx={{
            mt: 2.75,
            ml: -0.75,
            alignItems: 'flex-start',
            '& .MuiCheckbox-root': { mt: -0.75 },
          }}
        />

        <Button type="submit" variant="contained" size="large" sx={{ mt: 3 }} fullWidth>
          Create account
        </Button>
      </Box>

      <Typography
        mt={4}
        pb={12}
        variant="body2"
        textAlign={{ xs: 'center', md: 'left' }}
        letterSpacing={0.25}
      >
        Already have an account?{' '}
        <Link href={paths.signin} color="primary.main" fontWeight={600}>
          Sign in
        </Link>
      </Typography>
    </Stack>
  );
};

export default SignUp;
