// Copies the HTML, CSS, icons and manifest next to the bundles in dist/,
// with the manifest version taken from package.json.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const {version} = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

for (const file of fs.readdirSync(path.join(root, 'static'))) {
    if (file !== 'manifest.json') {
        fs.copyFileSync(path.join(root, 'static', file), path.join(dist, file));
    }
}
fs.cpSync(path.join(root, 'icons'), path.join(dist, 'icons'), {recursive: true});
for (const license of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    fs.copyFileSync(path.join(root, license), path.join(dist, license));
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'static', 'manifest.json'), 'utf8'));
manifest.version = version;
fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 4) + '\n');
console.log('dist/ ready, version ' + version);
