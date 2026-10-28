import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { therapies } from '../content/therapies.mjs';
import { renderHomepage, renderTherapyPage, renderSitemap, renderLegalWorkshop } from './render-site.mjs';
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
await mkdir('dist/ateliere/da-mana-cu-dreptul', { recursive: true });
await writeFile('dist/ateliere/da-mana-cu-dreptul/index.html', renderLegalWorkshop(template, await readFile('content/legal-workshop.html', 'utf8')));
await writeFile('dist/sitemap.xml', renderSitemap(await readFile('public/sitemap.xml', 'utf8')));
await writeFile('dist/.nojekyll', '');
await writeFile('dist/build-info.json', JSON.stringify({ commit, builtAt: new Date().toISOString(), therapyPages: therapies.map(item => `terapii/${item.slug}/`), workshopPages: ['ateliere/da-mana-cu-dreptul/'], policyPages: ['confidentialitate.html', 'cookies.html'] }, null, 2));
console.log(`Built Smart Terapy Educational, ${therapies.length} therapy pages, workshop and policies from ${commit}`);
