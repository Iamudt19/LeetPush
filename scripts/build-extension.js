import { build } from 'vite';
import { resolve } from 'path';

async function run() {
  console.log('1. Building main extension bundles (service-worker, popup, options)...');
  await build({
    configFile: resolve('vite.config.ts'),
  });

  console.log('2. Building self-contained IIFE content script (content.js)...');
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      minify: false,
      rollupOptions: {
        input: resolve('src/content/leetcode.ts'),
        output: {
          format: 'iife',
          name: 'LeetPushContentScript',
          entryFileNames: 'content.js',
          inlineDynamicImports: true,
        },
      },
    },
  });

  console.log('3. Building self-contained IIFE interceptor script (interceptor.js)...');
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      minify: false,
      rollupOptions: {
        input: resolve('src/content/interceptor.ts'),
        output: {
          format: 'iife',
          name: 'LeetPushInterceptorScript',
          entryFileNames: 'interceptor.js',
          inlineDynamicImports: true,
        },
      },
    },
  });

  console.log('\n✓ All extension bundles built successfully without module imports in content scripts!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
