/// <reference types="vite/client" />

declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare const __CHATBROWSERX_BUILD_TIME__: string;
