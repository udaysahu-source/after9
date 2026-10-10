const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const data = JSON.parse(fs.readFileSync('after9_raipur_garba_poster_assets/after9_raipur_garba_events_2026_poster_enhanced.json', 'utf8'));

function toUuid(str) {
  const hash = crypto.createHash('md5').update('after9-raipur-garba-2026:' + str).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    'a' + hash.substring(17, 20),
    hash.substring(20, 32)
  ].join('-');
}

function getDates(start, end) {
  if (!start) return [];
  if (!end || start === end) return [start];
  const dates = [];
  let curr = new Date(start);
  const stop = new Date(end);
  while (curr <= stop) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

let sql = '-- Migration 0023: Add metadata columns and seed all 35 Raipur Garba Events 2026\n\n';
sql += 'ALTER TABLE public.events ADD COLUMN IF NOT EXISTS maps_url TEXT;\n';
sql += 'ALTER TABLE public.events ADD COLUMN IF NOT EXISTS instagram_handle TEXT;\n';
sql += 'ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_confidence TEXT;\n';
sql += 'ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_asset_file TEXT;\n';
sql += 'ALTER TABLE public.events ADD COLUMN IF NOT EXISTS poster_content_notes TEXT;\n';
sql += 'ALTER TABLE public.events ADD COLUMN IF NOT EXISTS verification_notes TEXT;\n\n';

for (const ev of data.events) {
  const uuid = toUuid(ev.id);
  const dates = getDates(ev.startDate, ev.endDate);
  let posterUrl = null;
  if (ev.imageAssetFile) {
    const filename = path.basename(ev.imageAssetFile);
    posterUrl = 'https://vjsqakziqyesruxggaik.supabase.co/storage/v1/object/public/event-posters/' + filename;
  } else if (ev.imageUrl) {
    posterUrl = ev.imageUrl;
  }

  const pubStatus = ev.status === 'listed' ? 'published' : 'draft';
  const verifStatus = ev.status === 'listed' ? 'verified' : 'pending_verification';
  
  let ticketRange = null;
  if (ev.priceMin !== null && ev.priceMin !== undefined) {
    if (ev.priceMin === 0) {
      ticketRange = 'Free Entry';
    } else if (ev.priceMax && ev.priceMax !== ev.priceMin) {
      ticketRange = '₹' + ev.priceMin + ' – ₹' + ev.priceMax;
    } else {
      ticketRange = '₹' + ev.priceMin + ' onwards';
    }
  } else {
    ticketRange = 'Passes announced soon';
  }

  const highlights = [];
  if (ev.area) highlights.push(ev.area);
  if (ev.organizer) highlights.push(ev.organizer);
  if (ev.posterContentNotes) {
    if (ev.posterContentNotes.includes('traditional')) highlights.push('Traditional Garba');
    if (ev.posterContentNotes.includes('family')) highlights.push('Family Friendly');
  }

  const entryRules = [];
  if (ev.posterContentNotes && ev.posterContentNotes.includes('no stag')) {
    entryRules.push('No stag entry');
  }
  if (ev.posterContentNotes && ev.posterContentNotes.includes('traditional')) {
    entryRules.push('Traditional attire required');
  }

  sql += `INSERT INTO public.events (
  id, slug, title, venue, area, address, city, state,
  start_date, end_date, start_time, dates, organizer,
  poster_url, image_asset_file, booking_url, maps_url, instagram_handle,
  min_price_inr, max_price_inr, ticket_price_range,
  contact_verified, location_confidence, source_notes, poster_content_notes, verification_notes,
  highlights, entry_rules, publication_status, verification_status, is_active
) VALUES (
  ${esc(uuid)}, ${esc(ev.id)}, ${esc(ev.name)}, ${esc(ev.venue)}, ${esc(ev.area)}, ${esc(ev.venueAddress)}, 'Raipur', 'Chhattisgarh',
  ${esc(ev.startDate)}, ${esc(ev.endDate)}, ${esc(ev.time)}, ${esc(JSON.stringify(dates))}::jsonb, ${esc(ev.organizer)},
  ${esc(posterUrl)}, ${esc(ev.imageAssetFile)}, ${esc(ev.bookingUrl)}, ${esc(ev.mapsUrl)}, ${esc(ev.instagramHandle)},
  ${esc(ev.priceMin)}, ${esc(ev.priceMax)}, ${esc(ticketRange)},
  ${esc(ev.contact)}, ${esc(ev.locationConfidence)}, ${esc(ev.verification)}, ${esc(ev.posterContentNotes)}, ${esc(ev.verification)},
  ${esc(JSON.stringify(highlights))}::jsonb, ${esc(JSON.stringify(entryRules))}::jsonb, ${esc(pubStatus)}, ${esc(verifStatus)}, TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  venue = EXCLUDED.venue,
  area = EXCLUDED.area,
  address = EXCLUDED.address,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  start_time = EXCLUDED.start_time,
  dates = EXCLUDED.dates,
  organizer = EXCLUDED.organizer,
  poster_url = COALESCE(EXCLUDED.poster_url, public.events.poster_url),
  image_asset_file = EXCLUDED.image_asset_file,
  booking_url = EXCLUDED.booking_url,
  maps_url = EXCLUDED.maps_url,
  instagram_handle = EXCLUDED.instagram_handle,
  min_price_inr = EXCLUDED.min_price_inr,
  max_price_inr = EXCLUDED.max_price_inr,
  ticket_price_range = EXCLUDED.ticket_price_range,
  contact_verified = EXCLUDED.contact_verified,
  location_confidence = EXCLUDED.location_confidence,
  source_notes = EXCLUDED.source_notes,
  poster_content_notes = EXCLUDED.poster_content_notes,
  verification_notes = EXCLUDED.verification_notes,
  publication_status = EXCLUDED.publication_status,
  verification_status = EXCLUDED.verification_status,
  updated_at = now();\n\n`;
}

fs.writeFileSync('drizzle/migrations/0023_add_event_maps_url_and_raipur_garba_events.sql', sql);
console.log('Generated migration file with length:', sql.length);
