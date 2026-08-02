import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { App } from './App';
import { DevFeedback } from './components/dev-feedback';
import { I18nProvider } from './lib/i18n';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      <I18nProvider>
        <HashRouter>
          <App />
          {/* Dev-only screen feedback. Compiled out of a production build. */}
          <DevFeedback />
        </HashRouter>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
