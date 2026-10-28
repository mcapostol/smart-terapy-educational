export const CONTACT_EMAIL = 'contact@smartterapy.ro';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalized(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildContactMessage({ name, email, service, message } = {}) {
  const fields = {
    name: normalized(name),
    email: normalized(email),
    service: normalized(service),
    message: normalized(message),
  };
  const errors = {};

  if (!fields.name) {
    errors.name = 'Completează numele.';
  } else if (fields.name.length > 80) {
    errors.name = 'Numele poate avea cel mult 80 de caractere.';
  }

  if (!fields.email) {
    errors.email = 'Completează adresa de e-mail.';
  } else if (fields.email.length > 254) {
    errors.email = 'Adresa de e-mail poate avea cel mult 254 de caractere.';
  } else if (!EMAIL_PATTERN.test(fields.email)) {
    errors.email = 'Introdu o adresă de e-mail validă.';
  }

  if (fields.service.length > 100) {
    errors.service = 'Serviciul poate avea cel mult 100 de caractere.';
  } else if (/[\r\n]/.test(fields.service)) {
    errors.service = 'Serviciul trebuie scris pe un singur rând.';
  }

  if (!fields.message) {
    errors.message = 'Scrie un mesaj.';
  } else if (fields.message.length > 1500) {
    errors.message = 'Mesajul poate avea cel mult 1500 de caractere.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const subject = fields.service
    ? `Smart Terapy Educational — ${fields.service}`
    : 'Smart Terapy Educational';
  const body = [
    `Nume: ${fields.name}`,
    `E-mail: ${fields.email}`,
    `Serviciu: ${fields.service || 'Nespecificat'}`,
    '',
    'Mesaj:',
    fields.message,
  ].join('\n');

  return { ok: true, subject, body };
}
