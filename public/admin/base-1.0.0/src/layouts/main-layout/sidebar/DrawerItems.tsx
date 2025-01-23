import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import ListItem from '@mui/material/ListItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import IconifyIcon from 'components/base/IconifyIcon';
import Image from 'components/base/Image';
import sitemap from 'routes/sitemap';
import Logo from 'assets/images/Logo.png';
import Profile from 'assets/images/Profile.png';
import DrawerCardImg from 'assets/images/lighting.png';

interface DrawerItemsProps {
  expand: boolean;
}

const DrawerItems = ({ expand }: DrawerItemsProps) => {
  return (
    <>
      <Stack
        py={4}
        position="sticky"
        top={0}
        alignItems="center"
        justifyContent="center"
        bgcolor="info.lighter"
        zIndex={1200}
      >
        <ButtonBase component={Link} href="/" disableRipple>
          <Stack
            direction={expand ? 'row' : 'column'}
            spacing={expand ? 1.75 : 1.25}
            alignItems="center"
            justifyContent="center"
          >
            <Image src={Logo} alt="logo" height={44} width={44} />
            <Typography variant="h4" letterSpacing={1} fontWeight={600}>
              Base
            </Typography>
          </Stack>
        </ButtonBase>
      </Stack>

      <List component="nav" sx={{ mb: 30, pt: 1.5 }}>
        {sitemap.map((item) => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton
              LinkComponent={Link}
              href={item.path}
              sx={(theme) => ({
                minHeight: 48,
                background:
                  item.active && item.path === '/'
                    ? `linear-gradient(90deg, ${theme.palette.gradients.secondary.main} 0%, ${theme.palette.gradients.secondary.state} ${expand ? '22.5%' : '62%'})`
                    : 'info.lighter',
              })}
            >
              <ListItemIcon sx={{ width: 48 }}>
                {item.icon &&
                  (item.messages ? (
                    <Badge
                      variant="dot"
                      sx={(theme) => ({
                        '& .MuiBadge-badge': {
                          top: 4,
                          right: 3,
                          border: 2,
                          borderColor: theme.palette.info.lighter,
                          bgcolor: expand ? 'text.disabled' : 'error.dark',
                        },
                      })}
                    >
                      <IconifyIcon
                        icon={item.icon}
                        color={item.active ? 'primary.main' : 'text.disabled'}
                      />
                    </Badge>
                  ) : (
                    <IconifyIcon
                      icon={item.icon}
                      color={item.active ? 'primary.main' : 'text.disabled'}
                    />
                  ))}
              </ListItemIcon>

              <ListItemText
                primary={item.subheader}
                sx={[
                  expand
                    ? {
                        opacity: 1,
                      }
                    : {
                        opacity: 0,
                      },
                  {
                    '& .MuiListItemText-primary': {
                      color: item.active ? 'primary.main' : 'text.disabled',
                    },
                  },
                ]}
              />
              {item.messages && (
                <Chip
                  label={item.messages}
                  color="error"
                  size="small"
                  sx={{
                    minWidth: 32,
                    height: 24,
                    opacity: expand ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box mt="auto" px={2.35} pb={5}>
        <Stack
          position="relative"
          mt="auto"
          mb={4}
          width={1}
          height="auto"
          display={expand ? 'block' : 'none'}
          sx={{ userSelect: 'none' }}
        >
          <Image src={DrawerCardImg} height={1} width={1} sx={{ objectFit: 'cover' }} />

          <Stack position="absolute" bottom={24} width={1} px={2} justifyContent="center">
            <Button variant="contained" fullWidth>
              Upgrade Now
            </Button>
          </Stack>
        </Stack>

        <Stack
          spacing={expand ? 1 : 2}
          direction={expand ? 'row' : 'column'}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack component={Link} href="#!" spacing={1.5} alignItems="center">
            <Image src={Profile} height={50} width={50} sx={{ borderRadius: 3 }} />
            <Box sx={[expand ? { display: 'block' } : { display: 'none' }]}>
              <Typography mb={-0.5} variant="body2" color="text.primary" fontWeight={700}>
                Easin Arafat
              </Typography>
              <Typography mt={-0.5} variant="caption" color="text.disabled" fontWeight={400}>
                Free Account
              </Typography>
            </Box>
          </Stack>

          <IconButton LinkComponent={Link} href="#!">
            <IconifyIcon icon="majesticons:logout" color="text.disabled" />
          </IconButton>
        </Stack>
      </Box>
    </>
  );
};

export default DrawerItems;
