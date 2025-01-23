export interface TopCard {
  id: string | number;
  icon: string;
  title: string;
  count: number;
  iconColor: string;
  iconBg: string;
}

export const topCardsData: TopCard[] = [
  {
    id: 1,
    icon: 'mage:heart-fill',
    title: 'Save Products',
    count: 178,
    iconColor: 'secondary.main',
    iconBg: 'transparent.secondary.main',
  },
  {
    id: 2,
    icon: 'solar:gamepad-old-bold',
    title: 'Stock Products',
    count: 20,
    iconColor: 'warning.main',
    iconBg: 'transparent.warning.main',
  },
  {
    id: 3,
    icon: 'solar:bag-4-bold',
    title: 'Sales Products',
    count: 190,
    iconColor: 'error.light',
    iconBg: 'transparent.error.light',
  },
  {
    id: 4,
    icon: 'heroicons:briefcase-20-solid',
    title: 'Job Application',
    count: 12,
    iconColor: 'primary.main',
    iconBg: 'transparent.primary.main',
  },
];
