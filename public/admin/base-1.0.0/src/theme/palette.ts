import { PaletteColorOptions, PaletteOptions } from '@mui/material/styles';
import {
  white,
  gray,
  darkblue,
  violet,
  blue,
  cyan,
  tomato,
  red,
  green,
  yellow,
  purple,
  transparentRed,
  transparentGreen,
  transparentYellow,
  transparentWhite,
  transparentBlue,
  transparentCyan,
  transparentViolet,
  indigo,
} from './colors';

declare module '@mui/material/styles' {
  interface PaletteOptions {
    neutral?: PaletteColorOptions;
    transparent?: {
      primary: PaletteColorOptions;
      secondary: PaletteColorOptions;
      info: PaletteColorOptions;
      success: PaletteColorOptions;
      warning: PaletteColorOptions;
      error: PaletteColorOptions;
    };
    gradients?: {
      primary: PaletteColorOptions;
      secondary?: PaletteColorOptions;
    };
  }
  interface SimplePaletteColorOptions {
    lighter?: string;
    darker?: string;
    state?: string;
  }
  interface Palette {
    neutral: PaletteColor;
    gradients: {
      primary: PaletteColor;
      secondary: PaletteColor;
    };
    transparent: {
      primary: PaletteColor;
      secondary: PaletteColor;
      info: PaletteColor;
      success: PaletteColor;
      warning: PaletteColor;
      error: PaletteColor;
    };
  }
  interface PaletteColor {
    lighter: string;
    darker: string;
    state: string;
  }
}

const palette: PaletteOptions = {
  neutral: {
    light: gray[100],
    main: gray[500],
    dark: gray[600],
    darker: gray[700],
  },
  primary: {
    lighter: indigo[500],
    light: violet[300],
    main: violet[500],
  },
  secondary: {
    light: cyan[500],
    main: blue[500],
    dark: blue[800],
  },
  info: {
    lighter: white[100],
    main: white[200],
    darker: darkblue[500],
  },
  success: {
    main: green[500],
  },
  warning: {
    main: yellow[500],
  },
  error: {
    light: tomato[500],
    main: red[500],
    dark: red[800],
  },
  text: {
    primary: darkblue[500],
    secondary: gray[800],
    disabled: gray[500],
  },
  gradients: {
    primary: {
      main: cyan[300],
      state: purple[500],
    },
    secondary: {
      main: violet[100],
      state: white[100],
    },
  },
  transparent: {
    primary: {
      main: transparentViolet[500],
      dark: transparentViolet[700],
    },
    secondary: {
      lighter: transparentBlue[300],
      light: transparentCyan[500],
      main: transparentBlue[500],
    },
    info: {
      main: transparentWhite[500],
    },
    success: {
      main: transparentGreen[500],
    },
    warning: {
      main: transparentYellow[500],
      dark: transparentYellow[700],
    },
    error: {
      light: transparentRed[200],
      main: transparentRed[500],
    },
  },
};

export default palette;
