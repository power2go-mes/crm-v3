# FINLONEXA CRM v2 → v3 Parity Specification & Governance Standard

> **MANDATORY POLICY**: FINLONEXA CRM v3 is a strict technology migration (Next.js 16 App Router, React 19, TypeScript, Supabase PostgreSQL RLS, TanStack Query, Tailwind CSS), **NOT** a UI/UX redesign. CRM v2 (`C:\Users\izhar\Desktop\crm-v2`) is the authoritative source of truth for visual layout, controls, workflows, and business rules.

---

## 1. Architectural Mandate & Governance

### 1.1 Source of Truth
* **CRM v2 (`C:\Users\izhar\Desktop\crm-v2`)** is the read-only functional and visual blueprint.
* No UI element, button label, modal structure, field ordering, pipeline stage, or workflow may be simplified, relocated, removed, or redesigned without explicit authorization.
* **Sole Documented Exception**: The MES-style collapsible unified navigation sidebar, which was designed and approved during Phase 2 to provide unified multi-level navigation across screen viewports while preserving all v2 routing targets.

### 1.2 Module Completion Gate Criteria
A module in CRM v3 is **NOT** complete until it passes the six mandatory acceptance gates:
1. **Route & Layout Inspection**: Every page structure and URL path mapped 1:1 against CRM v2 views.
2. **Visible Controls Parity**: Exact action bars, buttons, dropdowns, view switchers (Table, Kanban, Split), filters, search bars, and column customizers reproduced.
3. **User Workflows Matching**: Record creation, editing, in-line updates, pipeline transitions, conversion, re-assignment, bulk updates, and single/bulk deletion.
4. **Business Rules Verification**: Canonical sales hierarchy scoping, field validation rules, default pipeline probabilities, mandatory triggers, and RLS constraints.
5. **Cross-Viewport Responsiveness**: Verification across Desktop (1440px), Tablet (768px), and Mobile (375px) matching v2's responsive breakpoints.
6. **Zero-Discrepancy Sign-Off**: Verification checklist executed with evidence, with all intentional technical enhancements (e.g. optimistic cache updates, real-time subscriptions) documented.

---

## 2. Core Generics & System-Wide UI Patterns (from `finlo/contrib/generics`)

### 2.1 Standard Toolbar / Action Bar (`navbar.html`)
Every list view in CRM v2 has a standardized 2-row header:
* **Row 1 (Left)**: Module title (e.g. `Leads`, `Opportunities`) + View Type selector dropdown (`All Items`, `Recently Viewed`, `Recently Created`, `Recently Modified`, `Oldest First`, `+ List View` saved filter creation) + Pin view button.
* **Row 1 (Right)**:
  * **Search Input**: Instant search with debounce (`500ms`), placeholder `Search`, magnifying glass icon.
  * **Action Icon Cluster**:
    * **Reload**: Circular refresh icon (`#f3f4f6` square rounded button).
    * **Filter Toggle**: Filter funnel icon with badge showing count of active filters.
    * **View Switcher Dropdown**: Dropdown with icons for Table View, Kanban View, and Split View.
    * **Actions Menu**: Three-dots / actions menu for export, import, bulk update.
  * **Primary Action Buttons**:
    * **Primary Button**: `New` (solid blue `#2563eb`, opens modal or creation page).
    * **Secondary Button** (when applicable): Outline secondary button (e.g. `Create`).
* **Row 2**: Subtitle / description text (e.g. `Manage your sales pipeline and track deal progress`).

### 2.2 Table & List View (`list_view.html`)
* **Bulk Selection Bar** (appears dynamically when rows are selected):
  * `Select (N)` green pill (`#0aa10a1a` bg, `#0ba10a` border).
  * `Unselect (N)` purple pill (`#ba10bf2a` bg, `#ba10bf` border).
  * `Export Selected` blue button (`#009dff25` bg, `#009fff` border).
  * `Bulk Update` pink button (`#d5095726` bg, `#d50957` border, opens multi-field update modal).
  * `Bulk Delete` red button (`#c0392b26` bg, `#c0392b` border, opens safe dependency check / delete mode modal).
* **Data Table Structure**:
  * Checkbox column for row selection.
  * Sortable column headers with sort direction indicators.
  * Status and badge pills with exact semantic colors.
  * Row actions menu (`...` button): `View`, `Edit`, `Delete`, and module-specific actions (e.g. `Convert`).
* **Pagination Bar**:
  * Records count indicator: `Showing X to Y of Z entries`.
  * Rows per page dropdown (`10`, `25`, `50`, `100`).
  * Page navigation buttons (`Previous`, `1`, `2`, `...`, `Next`).

### 2.3 Record Detail View (`detail_view.html`)
* **Breadcrumbs Bar**: Full hierarchy breadcrumbs with chevron separators + `Fields` configuration button.
* **Top Record Header Card**:
  * Record primary title (e.g. Lead Name, Opportunity Title) + Badge indicators (e.g. Status, Priority).
  * Record pagination navigation (`Previous` / `Next` circular chevron buttons).
  * Actions dropdown (`Edit`, `Delete`, `Convert`, `Clone`).
  * 3-column / 2-column quick fields grid (`Label: Value`).
* **Pipeline Chevron Stage Bar** (`partials/pipeline_choices.html`):
  * Interactive stage chevrons displayed horizontally with status indicators:
    * Green: Completed stages.
    * Blue: Current active stage.
    * Gray: Upcoming stages.
    * Red/Green: Closed Lost / Closed Won.
  * Clicking a stage prompts confirmation dialog to transition the record.
* **Tabs Section** (`tab_view.html`):
  * `Details`: Grouped fieldsets with inline editing capability.
  * `Related Lists`: Sub-tables for linked entities (e.g. Contacts, Quotes, Opportunities).
  * `Activity`: Tasks, Meetings, Calls timeline with quick creation buttons.
  * `History`: Audit trail of all field changes (Old Value → New Value, Changed By, Timestamp).
  * `Notes & Attachments`: File uploads and rich-text notes.
  * Expand/Collapse Tab button (`fa-expand` icon) to toggle full-screen tab view.

### 2.4 Modal Form View (`form_view.html`)
* **Header**: Title + Close `X` icon.
* **Step Progress Bar** (for multi-step wizards): Numbered circles with connecting line.
* **Form Grid**: Responsive 2-column layout (`grid md:grid-cols-2 grid-cols-1 gap-4`).
* **Field Types**:
  * Text / Number / Email / Phone inputs with floating/clean labels and red asterisk for required fields.
  * Select2-style searchable dropdowns.
  * Toggle switches for booleans.
  * Image upload with circular dropzone and camera badge.
  * Lock icon and `(Read Only)` indicator for non-editable fields.
* **Footer Actions**:
  * `Previous` (outline button on step > 1).
  * `Next` (solid primary on step < total).
  * `Save & New` (secondary outline button on create).
  * `Save` (solid primary button).

---

## 3. Module-by-Module Parity Specification

### Module 1: Dashboard & KPI Analytics (`/`, `/analytics`)
* **Source in v2**: `finlo/contrib/dashboard`
* **V3 Route**: `apps/web/src/app/(dashboard)/page.tsx`
* **Controls & Components**:
  * Welcome header: `Welcome, <User Name>` + subtitle.
  * Date range filter: `Today`, `This Week`, `This Month`, `This Quarter`, `This Year`, `Custom`.
  * `Reorder` button: Enables drag-and-drop dashboard reordering with `Save`, `Set to Default`, and `Cancel`.
  * `View All Dashboards` button linking to `/analytics`.
  * KPI Metric Cards:
    1. Total Leads (Count, icon, color badge).
    2. Total Opportunities / Pipeline Value (Currency formatting, count).
    3. Won Deals / Revenue (Currency, percentage change).
    4. Active Tasks / Overdue Activities (Count, urgent warning style).
  * Visual Charts (12-column grid):
    * Chart 1 (4 cols): Lead Conversion Funnel / Status breakdown.
    * Chart 2 (4 cols): Opportunities by Pipeline Stage.
    * Table 1 (4 cols): Recent Leads / Critical Tasks table.

### Module 2: Leads Management & Conversion (`/leads`)
* **Source in v2**: `finlo_crm/leads`
* **V3 Route**: `apps/web/src/app/(dashboard)/leads/page.tsx`
* **Views**: Table View, Kanban View (by Lead Status), Split View.
* **Lead Status Stages (in exact order)**:
  1. `New` (Order 1, Probability: 10%, is_final: false)
  2. `Contacted` (Order 2, Probability: 30%, is_final: false)
  3. `Qualified` (Order 3, Probability: 60%, is_final: false)
  4. `Proposal` (Order 4, Probability: 80%, is_final: false)
  5. `Lost` (Order 5, Probability: 0%, is_final: false)
  6. `Convert` (Order 6, Probability: 100%, is_final: true)
* **Lead Conversion Workflow (`lead_convert.html`)**:
  * Trigger: `Convert` button in detail view or status bar transition to `Convert`.
  * Modal Sections:
    1. **Account**: Radio `Create New` (prefilled with lead company) vs `Select Existing` (searchable select).
    2. **Contact**: Radio `Create New` (first/last name, email, phone) vs `Select Existing`.
    3. **Opportunity**: Radio `Create New` (title, stage, amount, close date) vs `Select Existing` or `Do not create opportunity`.
    4. **Record Owner**: Select owner dropdown defaulting to current user.
  * Execution: Creates/links Account, Contact, and Opportunity in a single atomic transaction; marks lead as converted.

### Module 3: Contacts Management (`/contacts`)
* **Source in v2**: `finlo_crm/contacts`
* **V3 Route**: `apps/web/src/app/(dashboard)/contacts/page.tsx`
* **Fields**: First Name, Last Name, Title, Email, Contact Number, Secondary Number, Account (FK), Address (Country, State, City, Street, Postal Code), Contact Owner.
* **Views**: Table View with sorting, search, column filters; Detail View with linked Account, Opportunities, Activities, and History.

### Module 4: Accounts Management (`/accounts`)
* **Source in v2**: `finlo_crm/accounts`
* **V3 Route**: `apps/web/src/app/(dashboard)/accounts/page.tsx`
* **Fields**: Account Name, Parent Account, Industry (`finance`, `healthcare`, `manufacturing`, `agriculture`, `construction`, etc.), Account Type (`prospect`, `customer_direct`, `customer_channel`, `channel_partner_reseller`, etc.), Account Source, Phone, Website, Billing Address, Shipping Address, Owner.
* **Related Lists**: Contacts, Opportunities, Open Activities, Activity History, Notes.

### Module 5: Opportunities & Sales Pipeline (`/opportunities`)
* **Source in v2**: `finlo_crm/opportunities`
* **V3 Route**: `apps/web/src/app/(dashboard)/opportunities/page.tsx`
* **Opportunity Stages (in exact order)**:
  1. `Prospecting` (Order 1, Probability: 10%)
  2. `Qualification` (Order 2, Probability: 20%)
  3. `Needs Analysis` (Order 3, Probability: 30%)
  4. `Value Proposition` (Order 4, Probability: 50%)
  5. `Id. Decision Makers` (Order 5, Probability: 60%)
  6. `Perception Analysis` (Order 6, Probability: 70%)
  7. `Proposal/Price Quote` (Order 7, Probability: 80%)
  8. `Negotiation/Review` (Order 8, Probability: 90%)
  9. `Closed Lost` (Order 9, Probability: 0%)
  10. `Closed Won` (Order 10, Probability: 100%, is_final: true)
* **Kanban Board**: Drag-and-drop cards between stages, column headers displaying stage total amount and deal count, automatic probability recalculation on stage drop.

### Module 6: Activities & Tasks (`/tasks`, `/activities`)
* **Source in v2**: `finlo/contrib/activity`
* **V3 Route**: `apps/web/src/app/(dashboard)/tasks/page.tsx`
* **Activity Types**: `Task`, `Meeting`, `Call`, `Event`.
* **Task Fields**: Subject, Due Date, Priority (`High`, `Medium`, `Low`), Status (`Not Started`, `Scheduled`, `In Progress`, `Waiting on Someone`, `Completed`, `Cancelled`, `Deferred`), Related To (Lead, Account, Contact, Opportunity), Assigned To.
* **Call Logging**: Call Type (`Inbound`, `Outbound`, `Missed`), Call Result (`Interested`, `Left Message`, `No Answer`, `Callback Requested`, `Wrong Number`, `Not Interested`), Duration, Notes.

### Module 7: Sales Performance & Hierarchy Analytics (`/sales-performance`)
* **Source in v2**: `finlo_crm/forecast` & Sales Reporting System
* **V3 Route**: `apps/web/src/app/(dashboard)/sales-performance/page.tsx`
* **Hierarchy Scoping**:
  * `SUPER_ADMIN` / `HEAD_OF_SALES`: Full company visibility across North and South regional branches.
  * `RSM`: Regional branch scoped (North or South).
  * `SSM` / `ASM`: Area sales team and subordinate BDO rollup.
  * `BDO`: Individual performance metrics and own quota attainment.
* **Metrics**: Quota vs Achieved, Win Rate %, Average Deal Size, Sales Cycle Length, Active Pipeline vs Target.

### Module 8: Reports & Exports (`/reports`)
* **Source in v2**: `finlo/contrib/reports`
* **V3 Route**: `apps/web/src/app/(dashboard)/reports/page.tsx`
* **Capabilities**: Standard sales reports, export to Excel (`.xlsx`), CSV (`.csv`), and PDF (`.pdf`), custom date range filters, column selection modal.

### Module 9: Role Manager & System Administration (`/settings/roles`)
* **Source in v2**: Custom role administration & CRM v3 Dynamic Permission Architecture
* **V3 Route**: `apps/web/src/app/(dashboard)/settings/roles/page.tsx`
* **Security Rules**:
  * 6 canonical roles (`SUPER_ADMIN`, `HEAD_OF_SALES`, `RSM`, `SSM`, `ASM`, `BDO`) are protected from deletion or rename.
  * Dynamic permissions toggleable per role and immediately effective without redeployment.
  * Scoping invariants strictly enforced by PostgreSQL RLS.

---

## 4. Parity Verification Protocol

For every module implementation:
1. **Source Inspection**: Examine corresponding files in `C:\Users\izhar\Desktop\crm-v2` (`models.py`, `forms.py`, `views/`, `templates/`).
2. **Visual Snapshot Comparison**:
   * Inspect CRM v2 rendering or templates.
   * Verify CRM v3 implementation matches button positions, colors, field order, and typography.
3. **Behavioral Acceptance Test**:
   * Verify all inputs, validations, dropdown options, and keyboard interactions.
   * Verify submit, error handling, and success notifications.
4. **Sign-off Checklist Entry**: Complete the module checklist in `docs/PARITY_CHECKLIST.md` before claiming module completion.
