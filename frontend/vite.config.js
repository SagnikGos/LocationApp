import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  server: {
    
    allowedHosts: ["9516-103-215-227-233.ngrok-free.app"] // Add Ngrok host
  }
})
