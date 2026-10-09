#!/usr/bin/env node
/* Safely copy Cloudflare R2 environment variables from the invoking shell.
 * This script intentionally never contains, prints or generates credentials.
 * Existing application R2 credentials must be supplied outside source control.
 */
import fs from 'node:fs';
import path from 'node:path';

const required = ['R2_ACCOUNT_ID','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'];
const missing = required.filter(name => !process.env[name]?.trim());
if (missing.length) {
  console.error('Missing environment variable names: '+missing.join(', '));
  process.exit(1);
}
const filepath = path.join(process.cwd(),'.env.local');
let lines=[];
try {lines=fs.readFileSync(filepath,'utf8').split(/\r?\n/);}catch(error) {
  if (error.code!=='ENOENT') throw error;
}
const kept=lines.filter(line=>!required.some(key=>line.startsWith(key+'=')));
const values=required.map(key=>key+'='+JSON.stringify(process.env[key].trim()));
fs.writeFileSync(filepath,[...kept,...values,''].join('\n'),{encoding:'utf8',mode:0o600});
console.log('Updated local R2 environment variables (values hidden).');
