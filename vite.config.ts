import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: './', envDir: false, plugins: [react()],
  define: { __LOCAL_REVIEW__: false, __LOCAL_REVIEW_CONNECTED__: false,
    'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '""', 'import.meta.env.VITE_COACH_API_URL': '""' },
  build: { sourcemap: false },
})
