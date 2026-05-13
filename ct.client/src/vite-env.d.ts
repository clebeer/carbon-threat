/// <reference types="vite/client" />

declare module '*.css' {
  const content: string;
  export default content;
}

declare module 'react-grid-layout/css/styles.css';
declare module 'react-grid-layout/css/react-resizable.css';