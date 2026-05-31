import 'react';

// Electron <webview> etiketi için JSX tip tanımı.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        allowpopups?: string;
        partition?: string;
        useragent?: string;
      };
    }
  }
}
