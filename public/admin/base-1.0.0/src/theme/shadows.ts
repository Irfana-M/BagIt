declare module '@mui/material/styles' {
  interface Theme {
    customShadows: string[];
  }
  interface ThemeOptions {
    customShadows?: string[];
  }
}

const customShadows = ['1px 17px 44px 0px #03022912'];

export default customShadows;
