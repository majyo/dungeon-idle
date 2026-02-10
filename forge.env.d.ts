/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
