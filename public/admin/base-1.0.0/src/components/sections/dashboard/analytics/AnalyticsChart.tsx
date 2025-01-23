import { fontFamily } from 'theme/typography';
import { useMemo } from 'react';
import { SxProps, useTheme } from '@mui/material';
import * as echarts from 'echarts/core';
import ReactEchart from 'components/base/ReactEchart';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart } from 'echarts/charts';

import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  GraphicComponent,
} from 'echarts/components';

echarts.use([
  PieChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  GraphicComponent,
  CanvasRenderer,
]);

interface AnalyticsChartProps {
  data: {
    id: number | string;
    value: number;
    name: string;
  }[];
  sx?: SxProps;
}

const AnalyticsChart = ({ data, ...rest }: AnalyticsChartProps) => {
  const theme = useTheme();

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'item',
      },
      legend: {
        bottom: '0%',
        itemGap: 35,
        icon: 'roundRect',
        itemWidth: 15,
        itemHeight: 15,
        textStyle: {
          padding: [0, 0, 0, 5],
          fontFamily: fontFamily.nunito,
          fontSize: theme.typography.body2.fontSize,
          color: theme.palette.text.primary,
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['60%', '80%'],
          avoidLabelOverlap: false,
          startAngle: 90,
          label: {
            show: false,
          },
          data: data.map((item) => {
            return {
              ...item,
              itemStyle: {
                color:
                  item.id === 1
                    ? theme.palette.secondary.main
                    : item.id === 2
                      ? theme.palette.warning.main
                      : item.id === 3
                        ? theme.palette.error.light
                        : 'transparent',
                borderRadius: [100, 100, 15, 15],
              },
              tooltip: {
                show: item.id === 4 ? false : true,
              },
            };
          }),
          z: 1,
        },
        {
          type: 'pie',
          radius: ['68%', '80%'],
          silent: true,
          label: {
            show: false,
          },
          data: [
            {
              value: 1,
              name: '',
              itemStyle: {
                color: theme.palette.transparent.secondary.lighter,
              },
            },
          ],
          z: 0,
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: 'center',
          style: {
            text: '80%',
            fontWeight: 800,
            textAlign: 'center',
            fontFamily: fontFamily.nunito,
            fontSize: theme.typography.h2.fontSize,
            fill: theme.palette.text.primary,
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '57%',
          style: {
            text: 'Transactions',
            textAlign: 'center',
            fontFamily: fontFamily.nunito,
            fontSize: theme.typography.body1.fontSize,
            fill: theme.palette.neutral.darker,
          },
        },
      ],
    }),
    [theme, data],
  );

  return <ReactEchart echarts={echarts} option={option} {...rest} />;
};

export default AnalyticsChart;
