import Handlebars from 'handlebars';

import requestReceived from './templates/request-received.hbs';
import requestAccepted from './templates/request-accepted.hbs';
import requestDeclined from './templates/request-declined.hbs';
import requestCancelled from './templates/request-cancelled.hbs';
import waitlistPromoted from './templates/waitlist-promoted.hbs';
import serviceRemoved from './templates/service-removed.hbs';

const TEMPLATES: Record<string, string> = {
  'request-received': requestReceived,
  'request-accepted': requestAccepted,
  'request-declined': requestDeclined,
  'request-cancelled': requestCancelled,
  'waitlist-promoted': waitlistPromoted,
  'service-removed': serviceRemoved,
};

const cache = new Map<string, HandlebarsTemplateDelegate>();

export function renderTemplate(name: string, data: Record<string, unknown>): string {
  const source = TEMPLATES[name];
  if (source === undefined) throw new Error(`Unknown template: ${name}`);
  let fn = cache.get(name);
  if (!fn) {
    fn = Handlebars.compile(source);
    cache.set(name, fn);
  }
  return fn(data);
}
