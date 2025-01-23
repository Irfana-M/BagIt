import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import Card from '@mui/material/Card';
import Rating from '@mui/material/Rating';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import IconifyIcon from 'components/base/IconifyIcon';
import { TopProduct } from 'data/topProductsData';

interface ProductCardProps {
  data: TopProduct;
}

const ProductCard = ({ data }: ProductCardProps) => {
  return (
    <Card>
      <Stack alignItems="center" justifyContent="space-between">
        <Stack spacing={2} alignItems="center" minWidth={190}>
          <CardMedia
            component="img"
            src={data.image}
            sx={{ height: 100, width: 100 }}
            alt="product_img"
          />
          <div>
            <Typography
              component={Link}
              href={data.link}
              variant="body1"
              color="text.primary"
              fontWeight={500}
              display="block"
              mb={0.75}
            >
              {data.title}
            </Typography>
            <Rating
              name="half-rating-read"
              size="small"
              defaultValue={data.rating}
              icon={<IconifyIcon icon="iconamoon:star-fill" />}
              emptyIcon={<IconifyIcon icon="iconamoon:star-fill" />}
              precision={1}
              readOnly
            />
            <Typography
              variant="body1"
              color="text.primary"
              fontWeight={700}
              display="block"
              mt={0.5}
            >
              {data.price}
            </Typography>
          </div>
        </Stack>
      </Stack>
    </Card>
  );
};

export default ProductCard;
