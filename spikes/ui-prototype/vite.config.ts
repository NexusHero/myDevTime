import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Single-file output so the prototype can be shared/opened as one HTML file.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
})
