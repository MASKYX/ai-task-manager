import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        rollupOptions: {
            input: ['index.html', 'sign-in.html', 'callback.html'],
        },
    },
});
