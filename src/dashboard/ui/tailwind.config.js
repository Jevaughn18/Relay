import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    join(__dirname, 'index.html'),
    join(__dirname, 'src/**/*.{js,ts,jsx,tsx}'),
  ],
  safelist: [
    { pattern: /^(bg|text|border|rounded|p|m|w|h|flex|grid|gap|space)-./ },
    { pattern: /^(min|max)-./ },
    'animate-pulse',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0f172a',
        card: '#111827',
        line: '#1f2937',
        text: '#e5e7eb',
        muted: '#9ca3af',
        ok: '#10b981',
        bad: '#ef4444',
      },
    },
  },
  plugins: [],
}
