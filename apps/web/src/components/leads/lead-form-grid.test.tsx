import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { LeadFormGrid } from './lead-form-grid';

it('orders configured controls and keeps required controls reachable', () => {
  const markup = renderToStaticMarkup(
    <LeadFormGrid keepVisible={['email']} layout={[
      { field: 'title', sequence: 2, visible: true },
      { field: 'email', sequence: 1, visible: false },
      { field: 'fax', sequence: 0, visible: false },
    ]}>
      <label data-field="title">Title</label>
      <label data-field="fax">Fax</label>
      <label data-field="email">Email</label>
    </LeadFormGrid>,
  );
  expect(markup).not.toContain('Fax');
  expect(markup.indexOf('Email')).toBeLessThan(markup.indexOf('Title'));
});

it('omits hidden controls and disables read-only controls', () => {
  const markup = renderToStaticMarkup(
    <LeadFormGrid access={{ email: 'hidden', title: 'readonly' }} keepVisible={['email']}>
      <label data-field="email">Hidden email<input /></label>
      <label data-field="title">Title<input /></label>
    </LeadFormGrid>,
  );
  expect(markup).not.toContain('Hidden email');
  expect(markup).toContain('<fieldset disabled="">');
});
