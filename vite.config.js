import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Everything (R3F, the GLTF loader, our code) shares the WebGPU build of
  // three.js, so the WebGL-only renderer isn't bundled too
  resolve: { alias: [{ find: /^three$/, replacement: 'three/webgpu' }] },
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
