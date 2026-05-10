#!/usr/bin/env bun
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/bot/bot.ts'],
  bundle: true,
  platform: 'node',
  target: 'ES2021',
  outfile: 'dist-bundle/bot.js',
  minify: true,
  sourcemap: true,
  external: [
    'discord.js',
    'bun:sqlite',
    'winston',
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'info',
});

console.log('✓ Production bundle created at dist-bundle/bot.js');
