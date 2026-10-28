import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { therapies } from '../content/therapies.mjs';
import { renderHomepage, renderTherapyPage, renderSitemap } from './render-site.mjs';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain')) throw new Error('Build requires a clean committed working tree.');
const commit = git('rev-parse', 'HEAD');
const template = await readFile('public/index.html', 'utf8');
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await writeFile('dist/index.html', renderHomepage(template));
for (const therapy of therapies) {
  const folder = `dist/terapii/${therapy.slug}`;
  await mkdir(folder, { recursive: true });
  await writeFile(`${folder}/index.html`, renderTherapyPage(therapy, template));
}
await writeFile('dist/sitemap.xml', renderSitemap(await readFile('public/sitemap.xml', 'utf8')));
await writeFile('dist/.nojekyll', '');
await writeFile('dist/build-info.json', JSON.stringify({ commit, builtAt: new Date().toISOString(), therapyPages: therapies.map(item => `terapii/${item.slug}/`) }, null, 2));
console.log(`Built Smart Terapy Educational and ${therapies.length} therapy pages from ${commit}`);
