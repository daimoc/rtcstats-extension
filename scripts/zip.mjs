// dist/ as the zip to upload to the Chrome Web Store.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const {version} = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const zip = path.join(root, 'release', `rtcstats-extension-${version}.zip`);

fs.mkdirSync(path.dirname(zip), {recursive: true});
fs.rmSync(zip, {force: true});
execFileSync('zip', ['-r', '-X', '-q', zip, '.'], {cwd: path.join(root, 'dist'), stdio: 'inherit'});
console.log(zip);
