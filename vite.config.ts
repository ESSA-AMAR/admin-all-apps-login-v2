import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { kdsRelay } from './kds-relay.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), kdsRelay()],
  // listen on the network too, so a tablet or a second screen can open the POS and the KDS from this machine's address
  server: { host: true, port: 5174, strictPort: true },
  preview: { host: true, port: 5174, strictPort: true },
})
