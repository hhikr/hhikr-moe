import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const base = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(base, '../../..');
await fs.mkdir(path.join(base, 'state'), { recursive: true });
await fs.mkdir(path.join(base, 'browser-output'), { recursive: true });
const secretPath = path.join(base, 'connection-private.json');
try { await fs.access(secretPath); }
catch {
  await fs.writeFile(secretPath, JSON.stringify({
    token: crypto.randomBytes(32).toString('hex'),
    approvalToken: crypto.randomBytes(32).toString('hex'),
    projectRoots: [project],
    port: 19120,
    approvalPort: 19121,
  }, null, 2), { flag: 'wx' });
}
// Keep this tool's config in the private workspace without changing the user's home.
const vendorConfig = path.join(base, 'node_modules/@wonderwhy-er/desktop-commander/dist/config.js');
const source = await fs.readFile(vendorConfig, 'utf8');
const original = "const CONFIG_DIR = path.join(USER_HOME, '.claude-server-commander');";
if (source.includes(original)) {
  await fs.writeFile(vendorConfig, source.replace(original,
    "const CONFIG_DIR = process.env.HERMES_WINDOWS_CONFIG_DIR || path.join(USER_HOME, '.claude-server-commander');"));
} else if (!source.includes('process.env.HERMES_WINDOWS_CONFIG_DIR')) {
  throw new Error('工具配置接口已变化，暂停安装以避免写入错误位置。');
}
const configPath = path.join(base, 'state/config.json');
try { await fs.access(configPath); }
catch {
  await fs.writeFile(configPath, JSON.stringify({
    telemetryEnabled: false,
    allowedDirectories: [project],
    defaultShell: 'powershell.exe',
    fileReadLineLimit: 1000,
    fileWriteLineLimit: 1000,
    blockedCommands: ['format', 'diskpart', 'shutdown', 'reg', 'net', 'sc'],
    welcomeOnboardingEligible: false,
    pendingWelcomeOnboarding: false,
  }, null, 2), { flag: 'wx' });
}
const searchPath = path.join(base, 'node_modules/@wonderwhy-er/desktop-commander/dist/search-manager.js');
let searchSource = await fs.readFile(searchPath, 'utf8');
if (!searchSource.includes('HERMES_WINDOWS_EXCLUDE_DIRS')) {
  const addExclusions = "for (const dir of (process.env.HERMES_WINDOWS_EXCLUDE_DIRS || '').split(',').filter(Boolean)) args.push('--glob', `!**/${dir}/**`);";
  searchSource = searchSource.replace('args.push(options.rootPath);', addExclusions + '\n            args.push(options.rootPath);')
    .replace("args.push('--', options.pattern, options.rootPath);", addExclusions + "\n            args.push('--', options.pattern, options.rootPath);")
    .replaceAll('if (entry.isDirectory())', "if (entry.isDirectory() && !(process.env.HERMES_WINDOWS_EXCLUDE_DIRS || '').toLowerCase().split(',').includes(entry.name.toLowerCase()))");
  await fs.writeFile(searchPath, searchSource);
}
console.log('Windows 连接配置已准备，凭据未输出。');
