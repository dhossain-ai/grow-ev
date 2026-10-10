// Reuse the installed Expo/TypeScript rules for shared contracts and Edge Functions.
const driverConfig = require('./apps/driver/eslint.config.js');
module.exports = [
  ...driverConfig,
  { files: ['supabase/functions/**/*.ts'], languageOptions: { globals: { Deno: 'readonly' } } },
];
