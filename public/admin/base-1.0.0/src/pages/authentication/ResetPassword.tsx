import { useState, ChangeEvent, FormEvent } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Image from 'components/base/Image';
import Logo from 'assets/images/Logo.png';

const ResetPassword = () => {
  const [email, setEmail] = useState('');

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(email);
  };

  return (
    <Stack py={10} justifyContent="center" height="100vh" width={1}>
      <Stack
        mx={1.5}
        my="auto"
        component={Paper}
        direction="column"
        alignItems="center"
        justifyContent="center"
        height={600}
        width={1}
        maxWidth={600}
        borderRadius={1.5}
      >
        <ButtonBase LinkComponent={Link} href="/" disableRipple>
          <Image src={Logo} alt="logo" height={92} width={92} />
        </ButtonBase>
        <Typography mt={6} variant="h3" fontWeight={600}>
          Recover
        </Typography>
        <Box mt={8} width={1} maxWidth={480} component="form" onSubmit={handleSubmit}>
          <TextField
            id="email"
            name="email"
            type="email"
            color="secondary"
            label="Email Address"
            value={email}
            onChange={handleInputChange}
            variant="filled"
            placeholder="mail@example.com"
            autoComplete="email"
            sx={{ mt: 3 }}
            fullWidth
            autoFocus
            required
          />
          <Button type="submit" variant="contained" size="large" sx={{ mt: 3 }} fullWidth>
            Reset Your Password
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
};

export default ResetPassword;
