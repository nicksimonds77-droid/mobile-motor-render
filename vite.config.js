import {fileURLToPath, URL} from 'node:url';
import {defineConfig} from 'vite';
// the package has a default export only; `import {obfuscator}` is undefined
import obfuscator from 'vite-plugin-javascript-obfuscator';

export default defineConfig({
  base: '/mobile-motor-render/', // must match your repo name, with slashes

  resolve: {
    // the teardown kit files the model imports, vendored into src/kit
    alias: {'teardown-kit': fileURLToPath(new URL('./src/kit', import.meta.url))},
  },

  build: {
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
      },
    },
  },

  plugins: [
    obfuscator({
      include: ['src/**/*.js'],
      exclude: [/node_modules/],
      apply: 'build',
      options: {
        compact: true,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        // kept OFF to protect mobile render performance:
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: false,
      },
    }),
  ],
});
