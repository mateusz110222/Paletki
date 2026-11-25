import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import React from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

// Attach picker scrollbar rules via CSSOM so Vite's CSS minifier does not strip them.
if (typeof CSSStyleSheet !== 'undefined' && 'adoptedStyleSheets' in document) {
  const pickerScrollbar = new CSSStyleSheet();
  pickerScrollbar.replaceSync(`
    select::picker(select)::-webkit-scrollbar { width: 14px; background: transparent; }
    select::picker(select)::-webkit-scrollbar-track { margin-block: 8px; border-radius: 999px; background: var(--scrollbar-track); }
    select::picker(select)::-webkit-scrollbar-thumb { min-height: 48px; border: 3px solid var(--scrollbar-track); border-radius: 999px; background: var(--scrollbar-thumb); background-clip: padding-box; }
    select::picker(select)::-webkit-scrollbar-thumb:hover { background-color: var(--scrollbar-thumb-hover); }
    select::picker(select)::-webkit-scrollbar-button { display: none; }
  `);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, pickerScrollbar];
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
