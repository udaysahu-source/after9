-- Publish all 35 Raipur Garba 2026 events for public app discovery
UPDATE public.events
SET publication_status = 'published'
WHERE is_active = true;
