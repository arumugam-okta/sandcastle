import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// allowedHosts: the app is reached through a gateway/proxy hostname when hosted.
// BASE_PATH is set when hosted behind a path-routed preview (e.g. /preview/react-spa/).
// HMR is off when hosted (BASE_PATH set): the launcher reloads the preview after a save, and the
// HMR WebSocket has to cross the platform gateway as well as the preview proxy.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: { allowedHosts: true, hmr: process.env.BASE_PATH ? false : undefined },
});
