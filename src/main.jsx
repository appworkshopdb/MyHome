import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './core/lib/AuthContext';
import { UiProvider } from './core/lib/UiContext';

import './styles/base.css';
import './styles/themes.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/app-extra.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UiProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </UiProvider>
  </React.StrictMode>
);
