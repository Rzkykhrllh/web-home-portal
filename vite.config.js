import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5175 },
  build: {
    // three.js + R3F in their own long-cached chunk, React in another, so a
    // change to the world doesn't bust the big vendor download
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 2 },
            { name: 'three', test: /node_modules[\\/](three|@react-three)[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
})
