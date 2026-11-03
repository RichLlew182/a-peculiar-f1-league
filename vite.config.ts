import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' makes the built site work from any path, so it deploys to
// https://<user>.github.io/<repo>/ without hard-coding the repo name.
export default defineConfig({
  base: './',
  plugins: [react()],
})
