import { describe, it, expect, vi } from 'vitest';
import { renderTemplate } from '../email.renderer.js';

describe('renderTemplate', () => {
  it('renders request-received with all fields including notes', () => {
    const html = renderTemplate('request-received', {
      customerFirstName: 'Alice',
      serviceName: 'Haircut',
      formattedProposedAt: 'Friday, March 7 at 2:30 PM',
      notes: 'Please use scissors only',
    });
    expect(html).toContain('Alice');
    expect(html).toContain('Haircut');
    expect(html).toContain('Friday, March 7 at 2:30 PM');
    expect(html).toContain('scissors only');
    expect(html).toMatchSnapshot();
  });

  it('renders request-received without notes — notes block absent', () => {
    const html = renderTemplate('request-received', {
      customerFirstName: 'Bob',
      serviceName: 'Massage',
      formattedProposedAt: 'Saturday, March 8 at 10:00 AM',
    });
    expect(html).not.toContain('Notes:');
    expect(html).toMatchSnapshot();
  });

  it('renders request-accepted', () => {
    const html = renderTemplate('request-accepted', {
      businessName: 'Acme Salon',
      serviceName: 'Haircut',
      formattedProposedAt: 'Friday, March 7 at 2:30 PM',
    });
    expect(html).toContain('Acme Salon');
    expect(html).toContain('Haircut');
    expect(html).toContain('Friday, March 7 at 2:30 PM');
    expect(html).toMatchSnapshot();
  });

  it('renders request-declined with rebook copy', () => {
    const html = renderTemplate('request-declined', {
      businessName: 'Acme Salon',
      serviceName: 'Haircut',
    });
    expect(html).toContain('Acme Salon');
    expect(html).toContain('Haircut');
    expect(html).toContain('rebook or join the waitlist');
    expect(html).toMatchSnapshot();
  });

  it('renders request-cancelled', () => {
    const html = renderTemplate('request-cancelled', {
      customerFirstName: 'Carol',
      serviceName: 'Facial',
      formattedProposedAt: 'Monday, March 10 at 9:00 AM',
    });
    expect(html).toContain('Carol');
    expect(html).toContain('Facial');
    expect(html).toContain('Monday, March 10 at 9:00 AM');
    expect(html).toMatchSnapshot();
  });

  it('renders waitlist-promoted with booking CTA', () => {
    const html = renderTemplate('waitlist-promoted', {
      businessName: 'Acme Salon',
      serviceName: 'Haircut',
    });
    expect(html).toContain('Acme Salon');
    expect(html).toContain('Haircut');
    expect(html).toContain('book your appointment');
    expect(html).toMatchSnapshot();
  });

  it('renders service-removed with apology copy', () => {
    const html = renderTemplate('service-removed', {
      businessName: 'Acme Salon',
      serviceName: 'Deep Tissue Massage',
    });
    expect(html).toContain('Acme Salon');
    expect(html).toContain('Deep Tissue Massage');
    expect(html).toContain('apologise');
    expect(html).toMatchSnapshot();
  });

  it('throws for unknown template name', () => {
    expect(() => renderTemplate('unknown-template', {})).toThrow('Unknown template: unknown-template');
  });

  it('compiles each template at most once per module lifetime (caching)', async () => {
    vi.resetModules();
    const HBS = (await import('handlebars')).default;
    const compileSpy = vi.spyOn(HBS, 'compile');
    const { renderTemplate: fresh } = await import('../email.renderer.js');

    const data = { businessName: 'B', serviceName: 'S', formattedProposedAt: 'T' };
    fresh('request-accepted', data);
    fresh('request-accepted', data);
    fresh('request-accepted', data);

    expect(compileSpy).toHaveBeenCalledTimes(1);
    compileSpy.mockRestore();
  });
});
