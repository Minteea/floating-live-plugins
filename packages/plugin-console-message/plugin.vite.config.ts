import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { existsSync } from 'node:fs';

const copyTargets = [];
if (existsSync('plugin.json')) copyTargets.push({ src: 'plugin.json', dest: '.' })
else throw new Error('plugin.json is required for plugin packaging');
if (existsSync('LICENSE')) copyTargets.push({ src: 'LICENSE', dest: '.' });

export default defineConfig({
    plugins: [
        viteStaticCopy({
            targets: copyTargets,
        }),
    ],
    build: {
        lib: {
            entry: './src/index.ts',
            formats: ['es'],
        },
        outDir: './dist-plugin',
        minify: false,
        rollupOptions: {
            external: ['floating-live'],
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'vendor/vendor-[hash].js',
                manualChunks: (id) => {
                    if (id.includes('node_modules')) {
                        return 'vendor';
                    }
                }
            }
        }
    }
});