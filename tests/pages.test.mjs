import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { therapies } from "../content/therapies.mjs";
import {
  SITE_URL,
  renderHomepage,
  renderNavigation,
  renderTherapyPage,
} from "../scripts/render-site.mjs";

const EXPECTED_SLUGS = [
  "aba",
  "pecs",
  "logopedie",
  "terapie-ocupationala",
  "integrare-senzoriala",
  "ludoterapie",
  "terapie-cognitiv-comportamentala",
  "meloterapie-art-terapie",
  "terapie-de-grup",
];

const template = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

function countMatches(source, expression) {
  return [...source.matchAll(expression)].length;
}

test("therapy data defines exactly the nine canonical, unique routes", () => {
  assert.equal(therapies.length, 9);
  assert.deepEqual(
    therapies.map(({ slug }) => slug),
    EXPECTED_SLUGS,
  );
  assert.equal(new Set(therapies.map(({ slug }) => slug)).size, therapies.length);

  for (const therapy of therapies) {
    assert.match(therapy.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(typeof therapy.title, "string");
    assert(therapy.title.trim().length > 1, `${therapy.slug} needs a visible page heading`);
    assert.equal(typeof therapy.summary, "string");
    assert(therapy.summary.trim().length > 20, `${therapy.slug} needs a useful summary`);
  }
});

test("homepage navigation and cards link once to every therapy page", () => {
  const navigation = renderNavigation();
  const homepage = renderHomepage(template);

  assert.match(navigation, /<details class="therapy-menu" id="therapy-menu">/);
  assert.match(navigation, /<summary id="therapy-menu-toggle" aria-controls="therapy-submenu">/);
  assert.match(navigation, /id="therapy-submenu"/);
  assert.match(navigation, /href="#terapii"/);
  assert.doesNotMatch(homepage, /<!--\s*(?:SITE_NAV|THERAPY_CARDS)\s*-->/);

  for (const therapy of therapies) {
    const route = `terapii/${therapy.slug}/`;
    assert.equal(
      countMatches(navigation, new RegExp(`href="${route}"`, "g")),
      1,
      `${route} must occur once in the therapy menu`,
    );
    assert.equal(
      countMatches(homepage, new RegExp(`href="${route}"`, "g")),
      2,
      `${route} must occur once in the menu and once in its homepage card`,
    );
  }

  const menuRoutes = [...navigation.matchAll(/href="terapii\/([^/]+)\/"/g)].map((match) => match[1]);
  assert.deepEqual(menuRoutes, EXPECTED_SLUGS);
});

test("each therapy page renders its own metadata, heading, nested assets, and active sidebar link", () => {
  for (const therapy of therapies) {
    const html = renderTherapyPage(therapy, template);
    const canonical = `${SITE_URL}terapii/${therapy.slug}/`;
    const activeSidebarLink = `href="../../terapii/${therapy.slug}/" aria-current="page"`;

    assert(html.includes(`<title>${therapy.title} — Smart Therapy Educational</title>`));
    assert(html.includes(`<link rel="canonical" href="${canonical}">`));
    assert(html.includes(`<h1 id="therapy-title" data-therapy-title>${therapy.title}</h1>`));
    assert(html.includes('class="breadcrumbs wrap"'));
    assert(html.includes('href="../../">Acasă</a>'));
    assert(html.includes('class="therapy-page-nav"'));
    assert(html.includes(activeSidebarLink));
    assert.equal(countMatches(html, /class="therapy-page-nav"/g), 1);
    assert.equal(countMatches(html, /aria-current="page"/g), 3);
    assert(html.includes('class="therapy-overview-link" href="../../#terapii"'));
    assert(html.includes('href="../../styles.css"'));
    assert(html.includes('src="../../app.js"'));
    assert(html.includes('href="../../assets/favicon.svg"'));
    assert.doesNotMatch(html, /<!--\s*(?:SITE_NAV|THERAPY_CARDS)\s*-->/);

    const sidebar = html.match(/<nav class="therapy-page-nav"[\s\S]*?<\/nav>/)?.[0];
    assert(sidebar, `${therapy.slug} must render the therapy sidebar`);
    assert.equal(countMatches(sidebar, /<li><a href="\.\.\/\.\.\/terapii\//g), 9);
    assert.equal(countMatches(sidebar, /aria-current="page"/g), 1);
  }
});
