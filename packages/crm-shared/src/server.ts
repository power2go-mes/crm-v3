// Server entry point: importing it into browser code fails immediately.
if (typeof window !== 'undefined') throw new Error('CRM shared services are server-only');
export * from './services';
export * from './exports';
