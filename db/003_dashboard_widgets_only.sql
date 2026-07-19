-- ServiceUp 003: reserve "Widget" for dashboard components.
--
-- Earlier development schemas used public.widgets for frontend Hero/CTA/etc.
-- Those records are preserved under explicitly legacy names so an existing
-- installation can inspect or migrate its data into ordinary Content entries.
-- New installations do not create these tables.

do $$
begin
  if to_regclass('public.widgets') is not null
     and to_regclass('public.legacy_frontend_widgets') is null then
    alter table public.widgets rename to legacy_frontend_widgets;
  end if;

  if to_regclass('public.gadget_widgets') is not null
     and to_regclass('public.legacy_gadget_frontend_widgets') is null then
    alter table public.gadget_widgets rename to legacy_gadget_frontend_widgets;
  end if;

  if to_regclass('public.legacy_frontend_widgets') is not null then
    comment on table public.legacy_frontend_widgets is
      'Retired frontend widget records. Migrate useful values into ServiceUp Content entries.';
  end if;

  if to_regclass('public.legacy_gadget_frontend_widgets') is not null then
    comment on table public.legacy_gadget_frontend_widgets is
      'Retired Gadget-to-frontend-widget relationships retained for migration reference.';
  end if;
end $$;
