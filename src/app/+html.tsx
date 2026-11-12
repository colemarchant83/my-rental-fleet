import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const bootCover = `
(function () {
  var path = location.pathname.replace(/\\/$/, '') || '/';
  if (path === '/' || path === '/index') return;
  var style = document.createElement('style');
  style.id = 'boot-cover-style';
  style.textContent = 'html{background:#e4d9c8}body{visibility:hidden!important;background:#e4d9c8}';
  document.head.appendChild(style);
})();
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: bootCover }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
