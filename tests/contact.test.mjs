import assert from 'node:assert/strict';
import test from 'node:test';

import { CONTACT_EMAIL, buildContactMessage } from '../public/contact.js';

test('exports the configured contact address', () => {
  assert.equal(CONTACT_EMAIL, 'contact@smartterapy.ro');
});

test('builds a plain-text message and preserves diacritics and special characters', () => {
  const result = buildContactMessage({
    name: '  Ana-Maria Șerban  ',
    email: ' ana+copil@example.ro ',
    service: ' Logopedie & comunicare ',
    message: ' Bună ziua! Aș dori detalii pentru fiica mea, Ioana (6 ani). ',
    agreement: true,
  });

  assert.deepEqual(result, {
    ok: true,
    subject: 'Smart Therapy Educational — Logopedie & comunicare',
    body: [
      'Nume: Ana-Maria Șerban',
      'E-mail: ana+copil@example.ro',
      'Serviciu: Logopedie & comunicare',
      '',
      'Mesaj:',
      'Bună ziua! Aș dori detalii pentru fiica mea, Ioana (6 ani).',
      '',
      'Am citit Politica de confidențialitate și sunt de acord să fiu contactat(ă) pentru această solicitare.',
    ].join('\n'),
  });
});

test('accepts an omitted service without adding it to the subject', () => {
  const result = buildContactMessage({
    name: 'Ion Pop',
    email: 'ion@example.ro',
    message: 'Doresc să discut cu echipa.',
    agreement: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.subject, 'Smart Therapy Educational');
  assert.match(result.body, /Serviciu: Nespecificat/);
});

test('reports all blank required fields', () => {
  assert.deepEqual(buildContactMessage({ name: ' ', email: '\t', message: '\n' }), {
    ok: false,
    errors: {
      name: 'Completează numele.',
      email: 'Completează adresa de e-mail.',
      message: 'Scrie un mesaj.',
      agreement: 'Confirmă acordul pentru a pregăti mesajul.',
    },
  });
});

test('rejects invalid email addresses', () => {
  for (const email of ['ana', 'ana@', '@example.ro', 'ana @example.ro', 'ana@example']) {
    const result = buildContactMessage({ name: 'Ana', email, message: 'Mesaj.', agreement: true });
    assert.equal(result.ok, false, email);
    assert.equal(result.errors.email, 'Introdu o adresă de e-mail validă.', email);
  }
});

test('enforces field length limits after trimming', () => {
  const valid = buildContactMessage({
    name: ` ${'N'.repeat(80)} `,
    email: `${'a'.repeat(242)}@example.ro`,
    service: ` ${'S'.repeat(100)} `,
    message: ` ${'M'.repeat(1500)} `,
    agreement: true,
  });
  assert.equal(valid.ok, true);

  const invalid = buildContactMessage({
    name: 'N'.repeat(81),
    email: `${'a'.repeat(244)}@example.ro`,
    service: 'S'.repeat(101),
    message: 'M'.repeat(1501),
    agreement: true,
  });
  assert.equal(invalid.ok, false);
  assert.deepEqual(Object.keys(invalid.errors).sort(), ['email', 'message', 'name', 'service']);
});

test('rejects service newlines to prevent subject header injection', () => {
  for (const service of ['Logopedie\nBcc: attacker@example.com', 'ABA\r\nCc: other@example.com']) {
    const result = buildContactMessage({
      name: 'Ana',
      email: 'ana@example.ro',
      service,
      message: 'Mesaj.',
      agreement: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.errors.service, 'Serviciul trebuie scris pe un singur rând.');
  }
});

test('requires an explicit boolean agreement', () => {
  const base = {
    name: 'Ana',
    email: 'ana@example.ro',
    message: 'Doresc informații.',
  };

  for (const agreement of [undefined, false, 'true', 1, null]) {
    const result = buildContactMessage({ ...base, agreement });
    assert.equal(result.ok, false, String(agreement));
    assert.equal(
      result.errors.agreement,
      'Confirmă acordul pentru a pregăti mesajul.',
      String(agreement),
    );
  }

  const accepted = buildContactMessage({ ...base, agreement: true });
  assert.equal(accepted.ok, true);
  assert.match(
    accepted.body,
    /Am citit Politica de confidențialitate și sunt de acord să fiu contactat\(ă\)/,
  );
});
