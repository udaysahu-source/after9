# After9 Garba poster assets

This bundle contains event-specific poster images extracted from the user-provided PDF plus two separate crops from the user-provided free BTI Ground/Ram Mangalam image.

## Important
- `imageAssetFile` is a relative path inside this bundle, not a hosted URL.
- Upload the files in `posters/` to your Supabase Storage bucket, e.g. `event-posters`.
- After upload, set each event's `imageUrl` to the corresponding public URL.
- Instagram handles are separate metadata fields; they are not watermarked onto posters.
- The BTI Ground and Ram Mangalam posters cropped from the separate free image intentionally have no Instagram handle.
- Confirm permission to republish extracted PDF poster artwork before making it public.
- Records without an `imageAssetFile` still need event-specific organiser-approved artwork. Do not use an unrelated event poster for them.
