# Architecture rules

- Keep all badge templates in the shared AusweisDesign configuration and render both sides through the existing badge components; previews and print output must stay identical.
- Store custom badge logos in the existing design configuration as resized PNG data URLs; this preserves transparency and uses the same tenant-protected persistence as other design fields.- Role "service" = dispatcher rights plus users (no admins), settings/ERP, badges, fleet; check via isAdminOrService / is_domain_service().
- User activity log: client hook in the authenticated layout batches inserts into nutzer_aktivitaet (no input values); retention via hourly pg_cron delete.
