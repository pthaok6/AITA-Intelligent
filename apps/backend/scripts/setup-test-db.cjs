const { spawnSync } = require('node:child_process');
require('dotenv').config(); require('dotenv').config({ path: '.env.test' });
const value = process.env.TEST_DATABASE_URL;
if (!value || !new URL(value).pathname.includes('test') || value === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL must identify a separate database containing test in its name.');
const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: value }, windowsHide: true });
process.exitCode = result.status ?? 1;
