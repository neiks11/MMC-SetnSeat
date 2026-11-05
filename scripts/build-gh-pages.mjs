import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.cwd();
const apiDir = path.join(root, 'src', 'app', 'api');
const tempApiDir = path.join(root, 'src', '_api_server_backup');
const outDir = path.join(root, 'out');

try {
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, tempApiDir);
  }

  console.log('Building static GitHub Pages bundle for /MMC-SetnSeat...');
  execSync('npx next build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      GITHUB_PAGES: 'true',
      NEXT_PUBLIC_BASE_PATH: '/MMC-SetnSeat',
      NEXT_PUBLIC_STATIC_EXPORT: 'true',
    },
  });

  if (fs.existsSync(outDir)) {
    fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
    console.log('Created out/.nojekyll for GitHub Pages.');
  }
} finally {
  if (fs.existsSync(tempApiDir)) {
    fs.renameSync(tempApiDir, apiDir);
  }
}

