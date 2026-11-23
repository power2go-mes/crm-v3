import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CompanySettingsModal } from '@/components/settings/company-settings-modal';
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}), useMutation: () => ({ isPending: false, mutate: vi.fn() }) }));
describe('Company editor authoritative data gate', () => {
  it('cannot render a save form from unavailable settings or invented defaults', () => {
    const html = renderToStaticMarkup(<CompanySettingsModal settings={null} isOpen onClose={() => undefined} />);
    expect(html).toContain('unavailable'); expect(html).not.toContain('<form'); expect(html).not.toContain('USD');
  });
  it('renders the actual settings snapshot', () => {
    const html = renderToStaticMarkup(<CompanySettingsModal settings={{ company_name: 'Fixture Company', currency: 'PKR', time_zone: 'Asia/Karachi' }} isOpen onClose={() => undefined} />);
    expect(html).toContain('Fixture Company'); expect(html).toContain('value="PKR" selected=""'); expect(html).toContain('value="Asia/Karachi" selected=""');
  });
});
