-- =============================================================================
-- Phase 11: indexes for hot query paths found by the foreign-key index audit.
-- Chosen for list pages, RLS predicates, views and tenant-scoped cascades. Audit-only columns
-- (created_by, decided_by, …) are intentionally left unindexed; see docs/operations/performance.md.
-- =============================================================================

create index if not exists bills_account_idx on public.bills (bill_account_id);
create index if not exists bookings_service_request_idx on public.bookings (service_request_id) where service_request_id is not null;
create index if not exists bookings_quotation_idx on public.bookings (quotation_id) where quotation_id is not null;
create index if not exists bookings_provider_service_idx on public.bookings (provider_service_id);
create index if not exists bookings_org_status_idx on public.bookings (organization_id, status, scheduled_start);
create index if not exists bookings_household_start_idx on public.bookings (household_id, scheduled_start);
create index if not exists quotations_org_idx on public.quotations (organization_id);
create index if not exists quotations_household_idx on public.quotations (household_id);
create index if not exists work_orders_household_idx on public.work_orders (household_id);
create index if not exists work_orders_project_idx on public.work_orders (project_id) where project_id is not null;
create index if not exists work_orders_org_start_idx on public.work_orders (organization_id, scheduled_start);
create index if not exists work_order_assignments_worker_idx on public.work_order_assignments (worker_id) where active;
create index if not exists work_order_assignments_org_idx on public.work_order_assignments (organization_id);
create index if not exists notifications_reminder_idx on public.notifications (reminder_id) where reminder_id is not null;
create index if not exists notifications_org_idx on public.notifications (organization_id) where organization_id is not null;
create index if not exists disputes_org_idx on public.disputes (organization_id);
create index if not exists disputes_household_idx on public.disputes (household_id);
create index if not exists refunds_org_status_idx on public.refunds (organization_id, status);
create index if not exists settlement_items_settlement_idx on public.settlement_items (settlement_id);
create index if not exists stock_movements_po_idx on public.stock_movements (purchase_order_id) where purchase_order_id is not null;
-- product_inventory sums reserved quantities per product.
create index if not exists purchase_order_lines_product_idx on public.purchase_order_lines (product_id);
create index if not exists projects_service_request_idx on public.projects (service_request_id) where service_request_id is not null;
create index if not exists projects_property_idx on public.projects (property_id);
create index if not exists files_household_idx on public.files (household_id);
create index if not exists reviews_household_idx on public.reviews (household_id);
create index if not exists pet_health_records_pet_idx on public.pet_health_records (pet_id, occurred_on desc);
create index if not exists vehicle_service_records_vehicle_idx on public.vehicle_service_records (vehicle_id);
create index if not exists asset_service_records_asset_idx on public.asset_service_records (asset_id);
create index if not exists verification_items_org_idx on public.verification_items (organization_id);
create index if not exists organization_files_org_idx on public.organization_files (organization_id);
create index if not exists payment_events_refund_idx on public.payment_events (refund_id) where refund_id is not null;
create index if not exists reconciliation_items_intent_idx on public.reconciliation_items (payment_intent_id) where payment_intent_id is not null;
create index if not exists calendar_assignments_user_idx on public.calendar_assignments (user_id);
