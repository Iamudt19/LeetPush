import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';

function copyDir(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = `${src}/${entry}`;
    const destPath = `${dest}/${entry}`;
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// Plugin to copy manifest + static assets into dist
function copyExtensionAssets() {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      // Copy manifest
      copyFileSync('manifest.json', 'dist/manifest.json');
      // Copy public assets (icons, html pages)
      try {
        copyDir('public', 'dist');
      } catch {
        // public dir may not exist yet
      }
      // Copy popup html and css
      try {
        copyFileSync('src/popup/popup.html', 'dist/popup.html');
        copyFileSync('src/popup/popup.css', 'dist/popup.css');
      } catch { /* ignore */ }
      // Copy options html and css
      try {
        copyFileSync('src/options/options.html', 'dist/options.html');
        copyFileSync('src/options/options.css', 'dist/options.css');
      } catch { /* ignore */ }
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: {
    'import.meta.env.MODE': JSON.stringify(mode),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: mode !== 'development',
    rollupOptions: {
      input: {
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'content': resolve(__dirname, 'src/content/leetcode.ts'),
        'interceptor': resolve(__dirname, 'src/content/interceptor.ts'),
        'popup': resolve(__dirname, 'src/popup/popup.ts'),
        'options': resolve(__dirname, 'src/options/options.ts'),
      },
      output: {
        // Service worker must be ES module in MV3
        // Content/popup/options use IIFE so they are self-contained
        entryFileNames: (chunk) => {
          if (chunk.name === 'service-worker') return 'service-worker.js';
          if (chunk.name === 'content') return 'content.js';
          if (chunk.name === 'interceptor') return 'interceptor.js';
          if (chunk.name === 'popup') return 'popup.js';
          if (chunk.name === 'options') return 'options.js';
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        format: 'es',
      },
    },
  },
  plugins: [copyExtensionAssets()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
}));
