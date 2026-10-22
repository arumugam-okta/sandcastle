import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// allowedHosts: the app is reached through a gateway/proxy hostname when hosted.
export default defineConfig({ plugins: [react()], server: { allowedHosts: true } });
