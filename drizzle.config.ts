import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './src/bot/database/migrations',
  schema: './src/bot/database/schema',
  dialect: 'sqlite',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DB_PATH || './data/idle.db',
  },
});
