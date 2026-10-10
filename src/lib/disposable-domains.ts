/**
 * List of known disposable / temporary email providers.
 * Used to prevent bot registrations and fake user creation.
 */
export const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "pokemail.net",
  "spam4.me",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.net",
  "trashmail.org",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "cool.fr.nf",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "nomail.xl.cx",
  "mega.zik.dj",
  "speed.1s.fr",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  "dispostable.com",
  "getnada.com",
  "inboxkitten.com",
  "fakeinbox.com",
  "mohmal.com",
  "mytemp.email",
  "generator.email",
  "emailondeck.com",
  "burnermail.io",
  "crazymailing.com",
  "maildrop.cc",
  "discard.email",
  "discardmail.com",
  "spambog.com",
  "tempinbox.com",
  "minuteinbox.com",
  "harakirimail.com",
  "mytempemail.com",
  "mytempmail.com",
  "zillamail.com",
  "zoemail.org",
  "crazymail.com",
  "dropmail.me",
  "fakemailgenerator.com",
  "generator.email",
  "nada.ltd",
  "nada.email",
  "tempm.com",
]);

/**
 * Checks if an email uses a disposable/temporary email provider.
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];
  if (!domain) return false;
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
