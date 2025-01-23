import Grid from '@mui/material/Grid';
import TopCard from './TopCard';
import { topCardsData } from 'data/topCardsData';

const TopCards = () => {
  return (
    <Grid container spacing={3.75}>
      {topCardsData.map((item) => (
        <Grid item key={item.id} xs={12} sm={6} lg={3}>
          <TopCard data={item} />
        </Grid>
      ))}
    </Grid>
  );
};

export default TopCards;
