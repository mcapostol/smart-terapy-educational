# Smart Terapy

Site de prezentare în limba română pentru Smart Terapy, cu publicare pe GitHub Pages.

## Conținut și proveniență

Numele **Smart Terapy** și activitățile generale (ateliere creative și terapeutice pentru copii, activități educaționale pentru școli și grădinițe în programul Școala Altfel) provin din metadatele publice ale [profilului Instagram](https://www.instagram.com/smart_terapy_educational/), consultat la 28 octombrie 2026. Fotografia de profil provine din același cont; nu sunt folosite fotografii ale unor copii. Ilustrațiile site-ului sunt originale, vectoriale. Fonturile DM Sans și Fraunces sunt distribuite cu licențele OFL incluse în `public/assets`.

Oferta detaliată este o **propunere comercială**, etichetată explicit pe site, nu o listă de servicii sau prețuri confirmate de client. Nu au fost inventate calificări, recenzii, adrese, telefoane ori rezultate terapeutice.

| Program propus | Tarif propus | Format propus |
| --- | --- | --- |
| Atelier creativ | 55 lei/copil | 60 min, 6–20 copii |
| Explorare senzorială și emoții | 60 lei/copil | 60 min, 6–20 copii |
| Școala Altfel | 45 lei/copil | 60 min, 15–30 copii |
| Copil și părinte | 85 lei/pereche | 75 min, 6–15 perechi |

Calculatorul propune 10% reducere pentru 4 ateliere. Materialele de bază sunt incluse în propunere; transportul, spațiul și cerințele speciale se discută separat. Reducerea și formatele necesită confirmarea echipei, ca și tarifele.

Repere publice consultate pentru poziționarea propunerii: [Școala de Joacă](https://scoaladejoaca.ro/ateliere/scoala-altfel-scoala-verde/) afișează 40 lei/copil, iar [Fundația Calea Victoriei](https://www.fundatiacaleavictoriei.ro/scoala-altfel-ateliere-pentru-copii-si-adolescenti/) afișează 50 lei/participant pentru grupe de minimum 20. Aceste oferte au contexte și conținut diferite; nu constituie tarife ale Smart Terapy.

## Funcționare

Site static, fără servicii backend sau dependențe runtime. Calculatorul păstrează numai opțiunile nesensibile în localStorage. Copierea mesajului este locală; contactul se realizează manual pe Instagram, fără simularea unei rezervări. Pagina de confidențialitate descrie stocarea locală și găzduirea GitHub Pages.

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
TARGET_URL=http://127.0.0.1:4173 npm run verify:browser
```

`CHROMIUM_PATH` poate indica un executabil Chromium instalat; `EXPECTED_COMMIT` verifică build-ul vizitat. Dovezile și capturile sunt salvate în `artifacts/`, excluse din Git. În mediile minimale Linux sunt necesare bibliotecile native Chromium.
