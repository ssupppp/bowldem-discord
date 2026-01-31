import React from 'react';
import ReactDOM from 'react-dom/client';
import { DiscordProvider } from './lib/discord';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DiscordProvider>
      <App />
    </DiscordProvider>
  </React.StrictMode>
);
