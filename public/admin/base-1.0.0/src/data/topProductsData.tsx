import { Nike, iPhone, Drone } from './images';

export interface TopProduct {
  id: number | string;
  image: string;
  title: string;
  price: string;
  rating: number;
  link: string;
}

export const topProductsData: TopProduct[] = [
  {
    id: 1,
    image: Nike,
    title: 'NIKE Shoes Black Pattern',
    price: '$87',
    rating: 4,
    link: '#!',
  },
  {
    id: 2,
    image: iPhone,
    title: 'iPhone 12',
    price: '$987',
    rating: 4,
    link: '#!',
  },
  {
    id: 3,
    image: Drone,
    title: 'Aero Drone X',
    price: '$899',
    rating: 4,
    link: '#!',
  },
];
