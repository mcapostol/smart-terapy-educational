# Smart Therapy Educational

Site de prezentare în limba română pentru Smart Therapy Educational, cu publicare pe GitHub Pages.

## Conținut și proveniență

Numele inițial **Smart Terapy** și activitățile generale (ateliere creative și terapeutice pentru copii, activități educaționale pentru școli și grădinițe în programul Școala Altfel) provin din metadatele publice ale [profilului Instagram](https://www.instagram.com/smart_terapy_educational/), consultat la 28 octombrie 2026. Fotografia de profil provine din același cont; nu sunt folosite fotografii ale unor copii. Ilustrațiile site-ului sunt originale, vectoriale. Fonturile DM Sans și Fraunces sunt distribuite cu licențele OFL incluse în `public/assets`.

Numele complet **Smart Therapy Educational** și cele nouă servicii de terapie au fost precizate ulterior de client, prin imaginea furnizată în conversație: ABA (Applied Behavior Analysis), PECS (Picture Exchange Communication System), logopedie, terapie ocupațională, terapie de integrare senzorială, ludoterapie, terapie cognitiv-comportamentală, meloterapie și art-terapie, terapie de grup pentru abilități sociale. Acestea sunt prezentate în secțiunea `#terapii`, cu descrieri concise și fără promisiuni de rezultate. Formulările generale au fost verificate și față de [prezentarea CDC a tipurilor de intervenții](https://www.cdc.gov/autism/treatment/index.html). Nu au fost inventate calificări, recenzii, adrese, telefoane ori rezultate terapeutice.

Datele operatorului și ale sediului profesional au fost transcrise din certificatul de înregistrare furnizat de client: Badea R. Mihaela-Cristina Persoană Fizică Autorizată, CUI 51852961, Reg. Com. F2025018416009, Strada Elena Caragiani nr. 11, camera 3, bl. 2H, sc. A, et. 3, ap. 15, Sector 1, București. Adresa este prezentată ca sediu profesional, fără a o echivala cu locul desfășurării tuturor activităților. Imaginea documentului nu este publicată în site.

Oferta detaliată de **ateliere creative** și tarifele aferente rămân o **propunere comercială**, etichetată explicit pe site. Calculatorul privește exclusiv aceste ateliere. Tarifele ședințelor de terapie și logopedie se comunică direct de echipă.

| Program propus | Tarif propus | Format propus |
| --- | --- | --- |
| Atelier creativ | 55 lei/copil | 60 min, 6–20 copii |
| Explorare senzorială și emoții | 60 lei/copil | 60 min, 6–20 copii |
| Școala Altfel | 45 lei/copil | 60 min, 15–30 copii |
| Copil și părinte | 85 lei/pereche | 75 min, 6–15 perechi |

Calculatorul propune 10% reducere pentru 4 ateliere. Materialele de bază sunt incluse în propunere; transportul, spațiul și cerințele speciale se discută separat. Reducerea și formatele necesită confirmarea echipei, ca și tarifele.

Repere publice consultate pentru poziționarea propunerii: [Școala de Joacă](https://scoaladejoaca.ro/ateliere/scoala-altfel-scoala-verde/) afișează 40 lei/copil, iar [Fundația Calea Victoriei](https://www.fundatiacaleavictoriei.ro/scoala-altfel-ateliere-pentru-copii-si-adolescenti/) afișează 50 lei/participant pentru grupe de minimum 20. Aceste oferte au contexte și conținut diferite; nu constituie tarife ale Smart Therapy Educational.

Atelierul de educație juridică **„Dă mâna cu Dreptul”**, descrierea, durata de 60–90 minute, publicul de 7–16 ani, temele și obiectivele au fost furnizate de client. Apare în secțiunea Ateliere și la `ateliere/da-mana-cu-dreptul/`; `content/legal-workshop.html` este inclus în build-ul paginii. Tariful este la cerere și nu este estimat de calculatorul atelierelor creative.

Denumirea afișată a fost corectată la **Smart Therapy Educational** la cererea clientului, pe 29 octombrie 2026. Adresa de e-mail, contul Instagram și URL-ul GitHub rămân cele furnizate inițial.

## Funcționare

Site static, fără servicii backend sau dependențe runtime. Fiecare dintre cele nouă terapii are propria pagină HTML la `terapii/<slug>/`, cu adresă canonică, descriere, direcții de lucru, întrebări frecvente și navigare între servicii. Meniul „Terapii” și cardurile de pe prima pagină duc direct la aceste pagini.

`content/therapies.mjs` este sursa unică pentru denumiri, rezumate, rute și conținutul paginilor. `scripts/render-site.mjs`, importat de build, generează prima pagină, paginile de terapie și sitemap-ul. Antetul și subsolul folosesc structura comună din `public/index.html`. Fișierele din `public` cu marcaje HTML sunt șabloane; previzualizarea se face din `dist`, după build.

Formularul de contact pregătește local un e-mail către `contact@smartterapy.ro`, cu nume, adresă de răspuns, serviciu opțional și mesaj. Cere o confirmare nebifată implicit privind informarea GDPR și contactarea pentru solicitarea respectivă; include confirmarea în mesaj. Validează câmpurile, oferă link `mailto:` și copiere cu variantă manuală; utilizatorul trimite e-mailul din aplicația sa. Formularul nu afișează confirmări fictive de livrare și nu stochează datele personale în localStorage. `public/contact.js` conține validarea și compunerea mesajului, importate de `public/app.js`. Pentru trimitere directă din browser este necesar ulterior un endpoint configurat; [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) găzduiește fișiere statice. Publicarea adresei nu creează și nu verifică existența căsuței poștale.

Meniul de terapii folosește un element HTML `details`; JavaScript adaugă închiderea la Escape, click în exterior și selectarea unui link. Pe mobil, lista poate fi derulată fără a depăși înălțimea ecranului. Dialogul comun `public/consent.js` apare la prima vizită pe orice pagină și permite acceptarea, refuzul ori salvarea selecției. Alegerea este păstrată 180 de zile și se poate modifica din Setări cookies. Calculatorul păstrează opțiunile nesensibile în localStorage numai dacă vizitatorul acceptă preferințele opționale sau bifează explicit salvarea pe dispozitiv. Ambele controale folosesc `public/preferences.js`. Debifarea ori butonul de ștergere din politica de cookies elimină cele două chei opționale și păstrează refuzul în cheia esențială de consimțământ; calculatorul funcționează și fără salvare. Politicile separate `confidentialitate.html` și `cookies.html` descriu funcționarea actuală, operatorul și opțiunile vizitatorului; trebuie actualizate odată cu migrarea pe Hostinger sau conectarea unui serviciu de trimitere. Copierea mesajului este locală; contactul se realizează manual pe Instagram, fără simularea unei rezervări. Pagina de confidențialitate descrie stocarea locală și găzduirea GitHub Pages.

## Verificare și publicare

```sh
npm ci
npm test
git status --porcelain
npm run build
```

Build-ul refuză un working tree cu modificări necomise. `dist/build-info.json` identifică exact commit-ul folosit. Push-ul pe `main` declanșează testele, build-ul și publicarea GitHub Pages din `.github/workflows/deploy.yml`.

Verificare browser (după pornirea unui server pentru `dist`):

```sh
TARGET_URL=http://127.0.0.1:4174 npm run verify:browser
TARGET_URL=http://127.0.0.1:4174 npm run verify:pages
TARGET_URL=http://127.0.0.1:4174 npm run verify:contact
TARGET_URL=http://127.0.0.1:4174 npm run verify:consent
```

`CHROMIUM_PATH` poate indica un executabil Chromium instalat; `EXPECTED_COMMIT` verifică build-ul vizitat. Dovezile și capturile sunt salvate în `artifacts/`, excluse din Git. În mediile minimale Linux sunt necesare bibliotecile native Chromium.
