import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// allowedHosts: the app is reached through a gateway/proxy hostname when hosted.
// BASE_PATH is set when hosted behind a path-routed preview (e.g. /preview/react-spa/).
export default defineConfig({ base: process.env.BASE_PATH || '/', plugins: [react()], server: { allowedHosts: true } });
