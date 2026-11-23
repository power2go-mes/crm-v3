-- =============================================================================
-- FINLONEXA CRM v3 — Migration 202611200010: Phase 05B Sales Execution
-- Product Catalog, Price Books, Opportunity Line Items & Quotations
-- =============================================================================

BEGIN;

-- 1. Permissions Definition
INSERT INTO public.permissions (id, module, action, description) VALUES
  ('products.view', 'products', 'view', 'View products in the product catalog'),
  ('products.create', 'products', 'create', 'Create new products in catalog'),
  ('products.update', 'products', 'update', 'Edit product details, prices, and categories'),
  ('products.delete', 'products', 'delete', 'Deactivate or delete catalog products'),
  ('price_books.view', 'price_books', 'view', 'View price books and pricing schedules'),
  ('price_books.manage', 'price_books', 'manage', 'Create, edit, and manage price books and entries'),
  ('quotes.view', 'quotes', 'view', 'View sales quotations for accessible opportunities'),
  ('quotes.create', 'quotes', 'create', 'Create new sales quotations from opportunities'),
  ('quotes.update', 'quotes', 'update', 'Edit and revise sales quotations'),
  ('quotes.delete', 'quotes', 'delete', 'Delete draft sales quotations'),
  ('quotes.export', 'quotes', 'export', 'Export and print quotation PDF documents')
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description;

-- Grant permissions to canonical roles
DO $$
DECLARE
  v_perm text;
BEGIN
  -- SUPER_ADMIN & HEAD_OF_SALES get all 11 permissions
  FOR v_perm IN SELECT unnest(ARRAY[
    'products.view', 'products.create', 'products.update', 'products.delete',
    'price_books.view', 'price_books.manage',
    'quotes.view', 'quotes.create', 'quotes.update', 'quotes.delete', 'quotes.export'
  ]) LOOP
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES
      ('SUPER_ADMIN', v_perm),
      ('HEAD_OF_SALES', v_perm)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- RSM gets all except delete
  FOR v_perm IN SELECT unnest(ARRAY[
    'products.view', 'products.create', 'products.update',
    'price_books.view', 'price_books.manage',
    'quotes.view', 'quotes.create', 'quotes.update', 'quotes.delete', 'quotes.export'
  ]) LOOP
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES
      ('RSM', v_perm)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- SSM gets product view/create/update, price book view, quotes all
  FOR v_perm IN SELECT unnest(ARRAY[
    'products.view', 'products.create', 'products.update',
    'price_books.view', 'price_books.manage',
    'quotes.view', 'quotes.create', 'quotes.update', 'quotes.delete', 'quotes.export'
  ]) LOOP
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES
      ('SSM', v_perm)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ASM gets product view, price book view, quotes all
  FOR v_perm IN SELECT unnest(ARRAY[
    'products.view',
    'price_books.view',
    'quotes.view', 'quotes.create', 'quotes.update', 'quotes.delete', 'quotes.export'
  ]) LOOP
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES
      ('ASM', v_perm)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- BDO gets product view, price book view, quotes view/create/update/export
  FOR v_perm IN SELECT unnest(ARRAY[
    'products.view',
    'price_books.view',
    'quotes.view', 'quotes.create', 'quotes.update', 'quotes.export'
  ]) LOOP
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES
      ('BDO', v_perm)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 2. Products Table
CREATE TABLE IF NOT EXISTS public.crm_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  type TEXT NOT NULL DEFAULT 'product' CHECK (type IN ('product', 'service', 'subscription')),
  unit_of_measure TEXT NOT NULL DEFAULT 'Unit',
  default_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (default_price >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  tax_category TEXT DEFAULT 'standard',
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_products_sku_upper_idx ON public.crm_products (UPPER(btrim(sku)));
CREATE INDEX IF NOT EXISTS crm_products_category_idx ON public.crm_products (category);
CREATE INDEX IF NOT EXISTS crm_products_active_idx ON public.crm_products (is_active);

-- 3. Price Books Table
CREATE TABLE IF NOT EXISTS public.crm_price_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_standard BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  effective_from DATE,
  effective_to DATE,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT crm_price_books_date_range_check CHECK (effective_from IS NULL OR effective_to IS NULL OR effective_from <= effective_to)
);

CREATE INDEX IF NOT EXISTS crm_price_books_active_idx ON public.crm_price_books (is_active);
CREATE INDEX IF NOT EXISTS crm_price_books_standard_idx ON public.crm_price_books (is_standard);

-- Ensure Standard Price Book exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.crm_price_books WHERE is_standard = true) THEN
    INSERT INTO public.crm_price_books (name, description, is_standard, is_active, currency)
    VALUES ('Standard Price Book', 'Default base product pricing for the organization.', true, true, 'INR');
  END IF;
END $$;

-- 4. Price Book Entries Table
CREATE TABLE IF NOT EXISTS public.crm_price_book_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id UUID NOT NULL REFERENCES public.crm_price_books(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.crm_products(id) ON DELETE RESTRICT,
  unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT crm_pbe_unique_book_product_currency UNIQUE (price_book_id, product_id, currency)
);

CREATE INDEX IF NOT EXISTS crm_pbe_book_idx ON public.crm_price_book_entries (price_book_id);
CREATE INDEX IF NOT EXISTS crm_pbe_product_idx ON public.crm_price_book_entries (product_id);

-- 5. Extend Opportunities Table for Line Items Compatibility
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS price_sync_mode TEXT NOT NULL DEFAULT 'manual' CHECK (price_sync_mode IN ('manual', 'synced')),
  ADD COLUMN IF NOT EXISTS price_book_id UUID REFERENCES public.crm_price_books(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS items_subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS items_discount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS items_tax NUMERIC(15, 2) NOT NULL DEFAULT 0.00;

-- 6. Opportunity Line Items Table
CREATE TABLE IF NOT EXISTS public.crm_opportunity_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.crm_products(id) ON DELETE RESTRICT,
  price_book_entry_id UUID REFERENCES public.crm_price_book_entries(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
  unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_percent >= 0 AND tax_percent <= 100),
  tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  line_total NUMERIC(15, 2) NOT NULL CHECK (line_total >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS crm_opp_line_items_opp_idx ON public.crm_opportunity_line_items (opportunity_id);
CREATE INDEX IF NOT EXISTS crm_opp_line_items_product_idx ON public.crm_opportunity_line_items (product_id);

-- Trigger to recalculate opportunity item aggregates and sync amount if in 'synced' mode
CREATE OR REPLACE FUNCTION public.recalculate_opportunity_item_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_opp_id UUID;
  v_subtotal NUMERIC(15, 2) := 0.00;
  v_discount NUMERIC(15, 2) := 0.00;
  v_tax NUMERIC(15, 2) := 0.00;
  v_total NUMERIC(15, 2) := 0.00;
  v_sync_mode TEXT;
BEGIN
  v_opp_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.opportunity_id ELSE NEW.opportunity_id END;

  SELECT
    COALESCE(SUM(quantity * unit_price), 0.00),
    COALESCE(SUM(discount_amount), 0.00),
    COALESCE(SUM(tax_amount), 0.00),
    COALESCE(SUM(line_total), 0.00)
  INTO v_subtotal, v_discount, v_tax, v_total
  FROM public.crm_opportunity_line_items
  WHERE opportunity_id = v_opp_id;

  SELECT price_sync_mode INTO v_sync_mode FROM public.opportunities WHERE id = v_opp_id;

  IF v_sync_mode = 'synced' THEN
    UPDATE public.opportunities
    SET
      items_subtotal = v_subtotal,
      items_discount = v_discount,
      items_tax = v_tax,
      amount = v_total,
      updated_at = timezone('utc', now())
    WHERE id = v_opp_id;
  ELSE
    UPDATE public.opportunities
    SET
      items_subtotal = v_subtotal,
      items_discount = v_discount,
      items_tax = v_tax,
      updated_at = timezone('utc', now())
    WHERE id = v_opp_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_opp_item_totals ON public.crm_opportunity_line_items;
CREATE TRIGGER trg_recalc_opp_item_totals
AFTER INSERT OR UPDATE OR DELETE ON public.crm_opportunity_line_items
FOR EACH ROW EXECUTE FUNCTION public.recalculate_opportunity_item_totals();

-- RPC to toggle Opportunity price synchronization mode
CREATE OR REPLACE FUNCTION public.set_opportunity_price_sync_mode(p_opp_id UUID, p_mode TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_opp record;
  v_subtotal NUMERIC(15, 2) := 0.00;
  v_discount NUMERIC(15, 2) := 0.00;
  v_tax NUMERIC(15, 2) := 0.00;
  v_total NUMERIC(15, 2) := 0.00;
BEGIN
  IF p_mode NOT IN ('manual', 'synced') THEN
    RAISE EXCEPTION 'Invalid sync mode: must be manual or synced' USING errcode = '22023';
  END IF;

  SELECT * INTO v_opp FROM public.opportunities WHERE id = p_opp_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found' USING errcode = 'P0002';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NOT public.has_effective_permission(auth.uid(), 'opportunities.update') THEN
      RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
    END IF;

    IF NOT (
      v_opp.owner_id IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(auth.uid()))
      OR public.is_opportunity_team_member(p_opp_id, auth.uid(), 'edit')
    ) THEN
      RAISE EXCEPTION 'Access denied to update this opportunity' USING errcode = '42501';
    END IF;
  END IF;

  SELECT
    COALESCE(SUM(quantity * unit_price), 0.00),
    COALESCE(SUM(discount_amount), 0.00),
    COALESCE(SUM(tax_amount), 0.00),
    COALESCE(SUM(line_total), 0.00)
  INTO v_subtotal, v_discount, v_tax, v_total
  FROM public.crm_opportunity_line_items
  WHERE opportunity_id = p_opp_id;

  IF p_mode = 'synced' THEN
    UPDATE public.opportunities
    SET
      price_sync_mode = 'synced',
      items_subtotal = v_subtotal,
      items_discount = v_discount,
      items_tax = v_tax,
      amount = v_total,
      updated_at = timezone('utc', now())
    WHERE id = p_opp_id;
  ELSE
    UPDATE public.opportunities
    SET
      price_sync_mode = 'manual',
      items_subtotal = v_subtotal,
      items_discount = v_discount,
      items_tax = v_tax,
      updated_at = timezone('utc', now())
    WHERE id = p_opp_id;
  END IF;

  RETURN jsonb_build_object(
    'opportunity_id', p_opp_id,
    'price_sync_mode', p_mode,
    'amount', CASE WHEN p_mode = 'synced' THEN v_total ELSE v_opp.amount END,
    'items_subtotal', v_subtotal,
    'items_discount', v_discount,
    'items_tax', v_tax,
    'line_items_total', v_total
  );
END;
$$;

-- 7. Sequence for Quote Number Generation
CREATE SEQUENCE IF NOT EXISTS public.crm_quote_number_seq START WITH 1001;

CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_seq BIGINT;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YYYY');
  v_seq := nextval('public.crm_quote_number_seq');
  RETURN 'QT-' || v_year || '-' || lpad(v_seq::TEXT, 5, '0');
END;
$$;

-- 8. Quotes Table
CREATE TABLE IF NOT EXISTS public.crm_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE DEFAULT public.generate_quote_number(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL DEFAULT (CURRENT_DATE + 30),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  discount_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (discount_total >= 0),
  tax_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (tax_total >= 0),
  grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
  billing_address TEXT,
  shipping_address TEXT,
  terms_and_conditions TEXT,
  customer_notes TEXT,
  internal_notes TEXT,
  current_revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS crm_quotes_opp_idx ON public.crm_quotes (opportunity_id);
CREATE INDEX IF NOT EXISTS crm_quotes_status_idx ON public.crm_quotes (status);
CREATE INDEX IF NOT EXISTS crm_quotes_number_idx ON public.crm_quotes (quote_number);

-- 9. Quote Line Items Table
CREATE TABLE IF NOT EXISTS public.crm_quote_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.crm_quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.crm_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  description TEXT,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
  unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_percent >= 0 AND tax_percent <= 100),
  tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  line_total NUMERIC(15, 2) NOT NULL CHECK (line_total >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS crm_quote_line_items_quote_idx ON public.crm_quote_line_items (quote_id);

-- 10. Quote Revisions (Immutable Snapshots) Table
CREATE TABLE IF NOT EXISTS public.crm_quote_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.crm_quotes(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  snapshot_data JSONB NOT NULL,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT crm_quote_revisions_unique_rev UNIQUE (quote_id, revision_number)
);

CREATE INDEX IF NOT EXISTS crm_quote_revisions_quote_idx ON public.crm_quote_revisions (quote_id);

-- Helper to record an immutable quote revision snapshot
CREATE OR REPLACE FUNCTION public.save_quote_revision_snapshot(p_quote_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_quote record;
  v_items jsonb;
  v_company record;
  v_snapshot jsonb;
  v_rev integer;
BEGIN
  SELECT * INTO v_quote FROM public.crm_quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found' USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_company FROM public.company_settings WHERE id = 1;

  SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.sort_order, i.created_at), '[]'::jsonb)
  INTO v_items
  FROM public.crm_quote_line_items i
  WHERE i.quote_id = p_quote_id;

  SELECT COALESCE(MAX(revision_number), 0) + 1
  INTO v_rev
  FROM public.crm_quote_revisions
  WHERE quote_id = p_quote_id;

  v_snapshot := jsonb_build_object(
    'quote', to_jsonb(v_quote),
    'items', v_items,
    'company', to_jsonb(v_company),
    'snapshot_at', timezone('utc', now()),
    'revision', v_rev
  );

  INSERT INTO public.crm_quote_revisions (quote_id, revision_number, snapshot_data, created_by_id)
  VALUES (p_quote_id, v_rev, v_snapshot, auth.uid());

  UPDATE public.crm_quotes SET current_revision = v_rev WHERE id = p_quote_id;

  RETURN v_rev;
END;
$$;

-- 11. Row-Level Security (RLS) Policies

-- Enable RLS on all Phase 05B tables
ALTER TABLE public.crm_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_price_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_price_book_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_opportunity_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_quote_revisions ENABLE ROW LEVEL SECURITY;

-- crm_products Policies
CREATE POLICY crm_products_read ON public.crm_products
FOR SELECT TO authenticated
USING (public.has_effective_permission(auth.uid(), 'products.view'));

CREATE POLICY crm_products_insert ON public.crm_products
FOR INSERT TO authenticated
WITH CHECK (public.has_effective_permission(auth.uid(), 'products.create'));

CREATE POLICY crm_products_update ON public.crm_products
FOR UPDATE TO authenticated
USING (public.has_effective_permission(auth.uid(), 'products.update'))
WITH CHECK (public.has_effective_permission(auth.uid(), 'products.update'));

CREATE POLICY crm_products_delete ON public.crm_products
FOR DELETE TO authenticated
USING (public.has_effective_permission(auth.uid(), 'products.delete'));

-- crm_price_books Policies
CREATE POLICY crm_price_books_read ON public.crm_price_books
FOR SELECT TO authenticated
USING (public.has_effective_permission(auth.uid(), 'price_books.view'));

CREATE POLICY crm_price_books_insert ON public.crm_price_books
FOR INSERT TO authenticated
WITH CHECK (public.has_effective_permission(auth.uid(), 'price_books.manage'));

CREATE POLICY crm_price_books_update ON public.crm_price_books
FOR UPDATE TO authenticated
USING (public.has_effective_permission(auth.uid(), 'price_books.manage'))
WITH CHECK (public.has_effective_permission(auth.uid(), 'price_books.manage'));

CREATE POLICY crm_price_books_delete ON public.crm_price_books
FOR DELETE TO authenticated
USING (public.has_effective_permission(auth.uid(), 'price_books.manage'));

-- crm_price_book_entries Policies
CREATE POLICY crm_pbe_read ON public.crm_price_book_entries
FOR SELECT TO authenticated
USING (public.has_effective_permission(auth.uid(), 'price_books.view'));

CREATE POLICY crm_pbe_insert ON public.crm_price_book_entries
FOR INSERT TO authenticated
WITH CHECK (public.has_effective_permission(auth.uid(), 'price_books.manage'));

CREATE POLICY crm_pbe_update ON public.crm_price_book_entries
FOR UPDATE TO authenticated
USING (public.has_effective_permission(auth.uid(), 'price_books.manage'))
WITH CHECK (public.has_effective_permission(auth.uid(), 'price_books.manage'));

CREATE POLICY crm_pbe_delete ON public.crm_price_book_entries
FOR DELETE TO authenticated
USING (public.has_effective_permission(auth.uid(), 'price_books.manage'));

-- Helper function to check if caller has Opportunity Read access
CREATE OR REPLACE FUNCTION public.can_access_opportunity(p_opp_id UUID, p_level TEXT DEFAULT 'read')
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.opportunities WHERE id = p_opp_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF p_level = 'edit' THEN
    IF NOT public.has_effective_permission(auth.uid(), 'opportunities.update') THEN
      RETURN FALSE;
    END IF;
    RETURN (
      v_owner_id IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(auth.uid()))
      OR public.is_opportunity_team_member(p_opp_id, auth.uid(), 'edit')
    );
  ELSE
    IF NOT public.has_effective_permission(auth.uid(), 'opportunities.view') THEN
      RETURN FALSE;
    END IF;
    RETURN (
      v_owner_id IN (SELECT accessible_user_id FROM public.get_accessible_user_ids(auth.uid()))
      OR public.is_opportunity_team_member(p_opp_id, auth.uid(), NULL)
    );
  END IF;
END;
$$;

-- crm_opportunity_line_items Policies
CREATE POLICY crm_opp_items_read ON public.crm_opportunity_line_items
FOR SELECT TO authenticated
USING (public.can_access_opportunity(opportunity_id, 'read'));

CREATE POLICY crm_opp_items_insert ON public.crm_opportunity_line_items
FOR INSERT TO authenticated
WITH CHECK (public.can_access_opportunity(opportunity_id, 'edit'));

CREATE POLICY crm_opp_items_update ON public.crm_opportunity_line_items
FOR UPDATE TO authenticated
USING (public.can_access_opportunity(opportunity_id, 'edit'))
WITH CHECK (public.can_access_opportunity(opportunity_id, 'edit'));

CREATE POLICY crm_opp_items_delete ON public.crm_opportunity_line_items
FOR DELETE TO authenticated
USING (public.can_access_opportunity(opportunity_id, 'edit'));

-- crm_quotes Policies
CREATE POLICY crm_quotes_read ON public.crm_quotes
FOR SELECT TO authenticated
USING (
  public.has_effective_permission(auth.uid(), 'quotes.view')
  AND public.can_access_opportunity(opportunity_id, 'read')
);

CREATE POLICY crm_quotes_insert ON public.crm_quotes
FOR INSERT TO authenticated
WITH CHECK (
  public.has_effective_permission(auth.uid(), 'quotes.create')
  AND public.can_access_opportunity(opportunity_id, 'edit')
);

CREATE POLICY crm_quotes_update ON public.crm_quotes
FOR UPDATE TO authenticated
USING (
  public.has_effective_permission(auth.uid(), 'quotes.update')
  AND public.can_access_opportunity(opportunity_id, 'edit')
)
WITH CHECK (
  public.has_effective_permission(auth.uid(), 'quotes.update')
  AND public.can_access_opportunity(opportunity_id, 'edit')
);

CREATE POLICY crm_quotes_delete ON public.crm_quotes
FOR DELETE TO authenticated
USING (
  public.has_effective_permission(auth.uid(), 'quotes.delete')
  AND status = 'Draft'
  AND public.can_access_opportunity(opportunity_id, 'edit')
);

-- crm_quote_line_items Policies
CREATE POLICY crm_quote_items_read ON public.crm_quote_line_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_quotes q
    WHERE q.id = quote_id
      AND public.has_effective_permission(auth.uid(), 'quotes.view')
      AND public.can_access_opportunity(q.opportunity_id, 'read')
  )
);

CREATE POLICY crm_quote_items_insert ON public.crm_quote_line_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_quotes q
    WHERE q.id = quote_id
      AND public.has_effective_permission(auth.uid(), 'quotes.create')
      AND public.can_access_opportunity(q.opportunity_id, 'edit')
  )
);

CREATE POLICY crm_quote_items_update ON public.crm_quote_line_items
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_quotes q
    WHERE q.id = quote_id
      AND public.has_effective_permission(auth.uid(), 'quotes.update')
      AND public.can_access_opportunity(q.opportunity_id, 'edit')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_quotes q
    WHERE q.id = quote_id
      AND public.has_effective_permission(auth.uid(), 'quotes.update')
      AND public.can_access_opportunity(q.opportunity_id, 'edit')
  )
);

CREATE POLICY crm_quote_items_delete ON public.crm_quote_line_items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_quotes q
    WHERE q.id = quote_id
      AND public.has_effective_permission(auth.uid(), 'quotes.update')
      AND public.can_access_opportunity(q.opportunity_id, 'edit')
  )
);

-- crm_quote_revisions Policies
CREATE POLICY crm_quote_rev_read ON public.crm_quote_revisions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_quotes q
    WHERE q.id = quote_id
      AND public.has_effective_permission(auth.uid(), 'quotes.view')
      AND public.can_access_opportunity(q.opportunity_id, 'read')
  )
);

CREATE POLICY crm_quote_rev_insert ON public.crm_quote_revisions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_quotes q
    WHERE q.id = quote_id
      AND public.has_effective_permission(auth.uid(), 'quotes.update')
      AND public.can_access_opportunity(q.opportunity_id, 'edit')
  )
);

-- 12. Permissions grants to authenticated and crm_masked_reader
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_price_books TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_price_book_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_opportunity_line_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_quote_line_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_quote_revisions TO authenticated;

GRANT SELECT ON public.crm_products TO crm_masked_reader;
GRANT SELECT ON public.crm_price_books TO crm_masked_reader;
GRANT SELECT ON public.crm_price_book_entries TO crm_masked_reader;
GRANT SELECT ON public.crm_opportunity_line_items TO crm_masked_reader;
GRANT SELECT ON public.crm_quotes TO crm_masked_reader;
GRANT SELECT ON public.crm_quote_line_items TO crm_masked_reader;
GRANT SELECT ON public.crm_quote_revisions TO crm_masked_reader;

GRANT EXECUTE ON FUNCTION public.set_opportunity_price_sync_mode(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_quote_revision_snapshot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_opportunity(UUID, TEXT) TO authenticated, crm_masked_reader;
GRANT USAGE, SELECT ON SEQUENCE public.crm_quote_number_seq TO authenticated;

-- 13. Expose Phase 05B pricing fields in opportunities_readable
CREATE OR REPLACE VIEW public.opportunities_readable AS
SELECT
  id,
  name,
  account_id,
  owner_id,
  stage,
  amount,
  close_date,
  probability,
  created_at,
  updated_at,
  primary_campaign_source_id,
  CASE
    WHEN public.crm_shared_field_access((SELECT id FROM public.crm_field_definitions WHERE module = 'opportunities' AND key = 'lead_source' LIMIT 1))
    THEN lead_source
    ELSE NULL
  END AS lead_source,
  price_sync_mode,
  price_book_id,
  items_subtotal,
  items_discount,
  items_tax
FROM public.opportunities;

ALTER VIEW public.opportunities_readable OWNER TO crm_masked_reader;
GRANT SELECT ON public.opportunities_readable TO authenticated, anon;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
