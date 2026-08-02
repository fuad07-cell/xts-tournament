import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/xts-tournament/', // আপনার GitHub repo-র নাম — https://github.com/fuad07-cell/xts-tournament
})
