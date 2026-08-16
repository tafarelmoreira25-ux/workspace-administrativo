import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'pdf-vendor',
              test: /node_modules[\\/]pdf-lib/,
              priority: 2,
              maxSize: 400 * 1024,
            },
            {
              name: 'initial-vendor',
              test: /node_modules[\\/]/,
              tags: ['$initial'],
              priority: 1,
            },
          ],
        },
      },
    },
  },
})
