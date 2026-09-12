import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';

const zipFile = resolve('leetpush.zip');
const distDir = resolve('dist');

if (existsSync(zipFile)) {
  rmSync(zipFile);
}


try {
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipFile}' -Force"`, {
      stdio: 'inherit',
    });
  } else {
    execSync(`cd "${distDir}" && zip -r "${zipFile}" .`, {
      stdio: 'inherit',
    });
  }
  console.log(`\n✓ Successfully packaged extension into ${zipFile}`);
  console.log('You can share this ZIP file or upload it directly to chrome://extensions (Load unpacked after unzipping).');
} catch (err) {
  console.error('Failed to create zip archive:', err);
  process.exit(1);
}

