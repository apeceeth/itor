// FevoStable — Supabase event service (Next.js reference implementation)
// Files: lib/supabase/client.ts, lib/supabase/events.ts, lib/supabase/useRealtimeEvents.ts
// The single-file HTML app implements the same logic inline against the CDN client.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---- client.ts ----
export const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { realtime: { params: { eventsPerSecond: 10 } } }
);

export type MarketplaceEvent = {
  id: number; created_at: string; block_number: number | null;
  transaction_hash: string; log_index: number; event_type: string;
  token_id: string | null; collection: string | null;
  nft_contract: string | null; marketplace_contract: string | null;
  seller: string | null; buyer: string | null; offer_maker: string | null;
  wallet_from: string | null; wallet_to: string | null;
  price: number | null; currency: string | null; status: string | null;
  network: string | null; image_url: string | null; explorer_url: string | null;
  metadata_json: Record<string, unknown> | null;
};

// ---- events.ts (Event Service) ----
// Insert a CONFIRMED on-chain event. transaction_hash + log_index is unique → dedupe.
export async function insertEvent(ev: Partial<MarketplaceEvent>) {
  const { error } = await supabase.from('marketplace_events').insert(ev);
  if (error && error.code !== '23505') throw error; // 23505 = unique violation (already stored)
  return { ok: !error || error.code === '23505' };
}

export async function fetchEvents(opts: {
  wallet?: string; tokenId?: string; type?: string; limit?: number;
} = {}) {
  let q = supabase.from('marketplace_events').select('*').order('created_at', { ascending: false });
  if (opts.tokenId) q = q.eq('token_id', opts.tokenId);
  if (opts.type && opts.type !== 'All') q = q.eq('event_type', opts.type);
  q = q.limit(opts.limit ?? 500);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data as MarketplaceEvent[];
  if (opts.wallet) {
    const w = opts.wallet.toLowerCase();
    rows = rows.filter(r => [r.wallet_from, r.wallet_to, r.seller, r.buyer, r.offer_maker]
      .some(x => (x || '').toLowerCase() === w));
  }
  return rows;
}

// ---- Volume Service ----
// Only "Sale" events count toward volume.
export function computeVolume(rows: MarketplaceEvent[]) {
  const now = Date.now(), DAY = 86400000, acc = { h24: 0, d7: 0, d30: 0, all: 0 };
  for (const r of rows) {
    if (r.event_type !== 'Sale') continue;
    const p = Number(r.price) || 0; if (!p) continue;
    acc.all += p;
    const age = now - new Date(r.created_at).getTime();
    if (age <= DAY) acc.h24 += p;
    if (age <= 7 * DAY) acc.d7 += p;
    if (age <= 30 * DAY) acc.d30 += p;
  }
  return acc;
}

// ---- useRealtimeEvents.ts (Realtime Hook) ----
// import { useEffect, useState } from 'react';
// export function useRealtimeEvents() {
//   const [rows, setRows] = useState<MarketplaceEvent[]>([]);
//   useEffect(() => {
//     fetchEvents().then(setRows);
//     const ch = supabase.channel('marketplace_events')
//       .on('postgres_changes',
//         { event: 'INSERT', schema: 'public', table: 'marketplace_events' },
//         payload => setRows(prev => [payload.new as MarketplaceEvent, ...prev]))
//       .subscribe();
//     return () => { supabase.removeChannel(ch); };
//   }, []);
//   return rows;
// }
