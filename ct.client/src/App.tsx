import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './app/router';

/**
 * Carbon Dojo V2 root. Routing lives in app/router.tsx; providers (QueryClient,
 * Theme, Toast) are mounted in main.tsx.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
