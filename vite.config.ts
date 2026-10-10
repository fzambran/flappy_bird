import { defineConfig } from 'vite';

// Relative assets keep forks deployable under any GitHub Pages repository path.
export default defineConfig({ base: './' });
