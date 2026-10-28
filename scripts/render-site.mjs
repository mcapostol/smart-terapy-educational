import { therapies } from '../content/therapies.mjs';

export const SITE_URL = 'https://mcapostol.github.io/smart-terapy-educational/';
const instagram = 'https://www.instagram.com/smart_terapy_educational/';
const escape = (value) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const pageHref = (therapy, base = '') => `${base}terapii/${therapy.slug}/`;

export function renderNavigation(base = '', currentSlug = '') {
  return `<a href="${base}#poveste">Despre noi</a>
  <details class="therapy-menu" id="therapy-menu">
    <summary id="therapy-menu-toggle" aria-controls="therapy-submenu">Terapii <span aria-hidden="true">⌄</span></summary>
    <div class="therapy-submenu" id="therapy-submenu">
      <a class="therapy-menu-overview" href="${base}#terapii">Toate terapiile <span aria-hidden="true">↗</span></a>
      <ul>${therapies.map(item => `<li><a href="${pageHref(item, base)}"${item.slug === currentSlug ? ' aria-current="page"' : ''}>${escape(item.title)}</a></li>`).join('')}</ul>
    </div>
  </details>
  <a href="${base}#ateliere">Ateliere</a><a href="${base}#scoala-altfel">Școala Altfel</a><a href="${base}#tarife">Tarife</a><a class="button button-small" href="${base}#contact">Contact <span aria-hidden="true">↗</span></a>`;
}

function renderCard(item, index) {
  return `<article class="therapy-card therapy-${escape(item.tone)}">
    <div class="therapy-card-top"><span class="therapy-category">${escape(item.category)}</span><span class="therapy-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span></div>
    <h3>${escape(item.title)}</h3>${item.fullName ? `<p class="therapy-fullname">${escape(item.fullName)}</p>` : ''}
    <p class="therapy-description">${escape(item.summary)}</p>
    <a class="therapy-page-link" href="${pageHref(item)}" aria-label="Află mai multe: ${escape(item.title)}">Descoperă terapia <span aria-hidden="true">↗</span></a>
  </article>`;
}

export function renderHomepage(template) {
  if (!template.includes('<!-- SITE_NAV -->') || !template.includes('<!-- THERAPY_CARDS -->')) throw new Error('Homepage template is missing a required slot.');
  return template.replace('<!-- SITE_NAV -->', renderNavigation()).replace('<!-- THERAPY_CARDS -->', therapies.map(renderCard).join('\n')).replace('<!-- CONTACT_SERVICES -->', therapies.map(item => `<option value="${escape(item.title)}">${escape(item.title)}</option>`).join(''));
}

function sharedPart(template, tag, base, currentSlug) {
  const source = template.match(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`))?.[0];
  if (!source) throw new Error(`Homepage template has no ${tag}.`);
  return source.replace(/(href|src)="(?!https?:|mailto:|tel:)([^"]*)"/g, (_, attr, url) => `${attr}="${base}${url === '#' ? '' : url}"`)
    .replace('<!-- SITE_NAV -->', renderNavigation(base, currentSlug));
}

export function renderTherapyPage(item, template) {
  const base = '../../';
  const url = `${SITE_URL}terapii/${item.slug}/`;
  const title = `${item.title} — Smart Terapy Educational`;
  const otherTherapies = therapies.filter(other => other.slug !== item.slug);
  return `<!doctype html>
<html lang="ro"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#faf7f0"><title>${escape(title)}</title>
<meta name="description" content="${escape(item.summary)}">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(item.summary)}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE_URL}assets/social-card.png">
<link rel="canonical" href="${url}"><link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}styles.css"><script type="module" src="${base}app.js"></script>
</head><body class="therapy-detail-page therapy-${escape(item.tone)}">
<a class="skip-link" href="#main">Mergi la conținut</a>
${sharedPart(template, 'header', base, item.slug)}
<main id="main">
  <nav class="breadcrumbs wrap" aria-label="Traseu în site"><a href="${base}">Acasă</a><span aria-hidden="true">/</span><a href="${base}#terapii">Terapii</a><span aria-hidden="true">/</span><span aria-current="page">${escape(item.shortTitle)}</span></nav>
  <section class="therapy-detail-hero wrap" aria-labelledby="therapy-title">
    <div><p class="eyebrow">SMART TERAPY EDUCATIONAL · ${escape(item.category)}</p><h1 id="therapy-title" data-therapy-title>${escape(item.title)}</h1>${item.fullName ? `<p class="detail-fullname">${escape(item.fullName)}</p>` : ''}<p class="detail-lead">${escape(item.summary)}</p><a class="button" href="${base}#contact">Discută cu echipa <span aria-hidden="true">↗</span></a></div>
    <aside class="detail-hero-note"><span class="detail-symbol" aria-hidden="true">✳</span><p>Fiecare copil,<br><em>în ritmul său.</em></p><span>Comunicare. Încredere. Pași mici.</span></aside>
  </section>
  <div class="therapy-detail-layout wrap">
    <article class="therapy-detail-content">
      <section aria-labelledby="about-therapy"><p class="eyebrow">DESPRE ACEASTĂ TERAPIE</p><h2 id="about-therapy">Un sprijin care începe<br>cu <em>înțelegere.</em></h2><p>${escape(item.intro)}</p></section>
      <section aria-labelledby="therapy-focus"><h2 id="therapy-focus">Ce putem <em>explora?</em></h2><p>Direcțiile de lucru se discută cu echipa, în funcție de nevoile copilului.</p><ul class="therapy-focus-list">${item.focus.map((focus, index) => `<li><span aria-hidden="true">0${index + 1}</span><p>${escape(focus)}</p></li>`).join('')}</ul></section>
      <section class="detail-first-step" aria-labelledby="first-step"><p class="eyebrow">PRIMUL PAS</p><h2 id="first-step">Hai să <em>povestim.</em></h2><p>Spune-ne vârsta copilului și ce ai vrea să discuți cu echipa. Împreună clarificăm formatul, disponibilitatea, frecvența și tariful ședințelor.</p><a class="text-link" href="${base}#contact">Completează formularul de contact <span aria-hidden="true">↗</span></a></section>
      <section class="detail-faq" aria-labelledby="therapy-questions"><h2 id="therapy-questions">Întrebări <em>firești.</em></h2><div class="faq-items">${item.questions.map(question => `<details><summary>${escape(question.question)}<span aria-hidden="true">+</span></summary><p>${escape(question.answer)}</p></details>`).join('')}</div></section>
    </article>
    <aside class="therapy-detail-sidebar"><nav class="therapy-page-nav" aria-label="Toate tipurile de terapie"><p class="eyebrow">TERAPII PENTRU COPII</p><ul>${therapies.map(other => `<li><a href="${pageHref(other, base)}"${other.slug === item.slug ? ' aria-current="page"' : ''}>${escape(other.title)}<span aria-hidden="true">${other.slug === item.slug ? '●' : '↗'}</span></a></li>`).join('')}</ul><a class="therapy-overview-link" href="${base}#terapii">← Înapoi la toate terapiile</a></nav></aside>
  </div>
  <section class="detail-bottom wrap"><p class="eyebrow">MAI DEPARTE, ÎMPREUNĂ</p><h2>Descoperă și alte<br><em>forme de sprijin.</em></h2><div class="related-therapies">${otherTherapies.slice(0, 3).map(other => `<a href="${pageHref(other, base)}">${escape(other.title)} <span aria-hidden="true">↗</span></a>`).join('')}</div></section>
</main>
${sharedPart(template, 'footer', base, item.slug)}
</body></html>`;
}

export function renderSitemap(template) {
  if (!template.includes('<!-- SITE_URLS -->')) throw new Error('Sitemap template is missing its URL slot.');
  return template.replace('<!-- SITE_URLS -->', ['', ...therapies.map(item => `terapii/${item.slug}/`)].map(route => `<url><loc>${SITE_URL}${route}</loc></url>`).join(''));
}
