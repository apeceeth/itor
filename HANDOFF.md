# FevoStable Marketplace — Developer Handoff

This package pairs the **visual/interaction source of truth** (`FevoStable Marketplace.dc.html`,
a fully interactive HTML build) with everything a developer or Claude Code needs to
implement the production **Next.js 15** marketplace wired to live blockchain data.

The HTML build is the design spec: every screen, layout, state, animation, and modal flow
described in the PRD is realized in it. Treat it as the pixel/behavior reference; port it to
React components and replace all seeded market data with real on-chain / indexer reads.

---

## What's in this package

| Path | Purpose |
|---|---|
| `FevoStable Marketplace.dc.html` | Interactive design — Home, Collection, Item, Mint, Profile + all modals |
| `docs/NFT_Marketplace_PRD.md` | Full product requirement document (the blueprint) |
| `abis/marketplace.json` | Marketplace contract ABI (renamed from `marketplace abi.txt`) |
| `abis/fevostable.json` | FevoStable NFT ABI — ERC-721A (renamed from `fevostable nft abi.txt`) |
| `metadata/fevostable.dataset.json` | 2,222-token trait data + computed rarity + facets (built from the CSV) |
| `uploads/FevoStable_metadata.csv` | Raw token metadata (traits per token) |
| `public/images/fevostable-logo.png` | Brand logo |

---

## Stack (per PRD)

Next.js 15 · React 19 · TypeScript · Tailwind · shadcn/ui · Framer Motion ·
React Query · RainbowKit · Wagmi · Viem · React Hook Form · Zod.

Chain: **Stable Mainnet**. Payment token: an **ERC-20** (referred to as `STBL` in the UI —
the marketplace constructor takes `_paymentToken`). Offers use a **wrapped** variant (`wSTBL`).

---

## Environment variables (`.env.local` — never hardcode)

```
NEXT_PUBLIC_CHAIN_ID=
NEXT_PUBLIC_RPC_URL=
NEXT_PUBLIC_EXPLORER_URL=
NEXT_PUBLIC_WALLETCONNECT_ID=
NEXT_PUBLIC_ALCHEMY_KEY=
NEXT_PUBLIC_MARKETPLACE_ADDRESS=
NEXT_PUBLIC_FEVOSTABLE_ADDRESS=
NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS=
```

Config files to create: `config/site.ts`, `config/theme.ts`, `config/contracts.ts`,
`config/blockchain.ts`, `config/alchemy.ts` — each reads only from the env above.

---

## Design tokens (lift these into `config/theme.ts` / Tailwind)

```
bg base        #050d0a      panel glass  rgba(10,23,18,.6)
elevated       #0a1712      border       rgba(57,245,166,.12)
text primary   #EAF4EF      muted        #8FA69D    faint  #5F7269
accent (mint)  #39F5A6      teal         #2CE0E0    brand red #FF3B47
positive #39F5A6  negative #FF6B78  warn #FFC24B
radius: chips/buttons 12px · cards 16px · modals 22px · avatars/pills full
fonts: 'Space Grotesk' (display/headings, numerics) · 'Manrope' (UI/body)
prices: font-variant-numeric: tabular-nums
```

NFT media in the design uses a **generative trait-tinted guardian mask** as a placeholder.
In production, replace with the real token media resolved from `tokenURI` → IPFS/CDN.

---

## Screen → contract map

The write actions below come from `abis/marketplace.json`. All are `nonpayable`; the
marketplace moves funds via the ERC-20 payment token, so **approvals are required first**
(the UI already models the Approve → Confirm stepper).

| UI action (where) | Contract call | Args |
|---|---|---|
| Buy Now (item card / item page / listings row) | `buyNFT` | `nft, tokenId` |
| Cart / batch buy | loop `buyNFT` (or aggregate) | per item |
| List for sale | `listNFT` | `nft, tokenId, price` |
| Bulk list (profile) | `batchList` | `nfts[], tokenIds[], prices[]` |
| Edit listing | `listNFT` (re-list) | `nft, tokenId, newPrice` |
| Cancel listing | `cancelListing` | `nft, tokenId` |
| Bulk cancel | `batchCancel` | `nfts[], tokenIds[]` |
| Make offer | `makeOffer` | `nft, tokenId, price, duration(uint64)` |
| Cancel offer | `cancelOffer` | `nft, tokenId` |
| Accept offer (owner) | `acceptOffer` | `nft, tokenId, buyer` |
| Mint (mint page) | FevoStable NFT contract mint fn | `quantity` (check ABI; ERC-721A, has whitelist/`addWhitelist`) |

Approvals:
- **Selling** → `setApprovalForAll(marketplace, true)` on the NFT (once per collection).
  Contract reverts with `MarketplaceNotApproved` otherwise.
- **Buying / offering** with the ERC-20 → `approve(marketplace, amount)` on the payment token.

Read/state (use marketplace `view` fns + events, or an indexer):
- Listings, offers, floor, active price → marketplace view functions + `NFTListed` /
  `ListingUpdated` / `ListingCancelled` / offer events.
- Ownership, balances, tokenURI → FevoStable NFT contract + Alchemy NFT API.
- Activity feed → subscribe to marketplace events (`NFTListed`, sale, offer, transfer).

Custom errors to surface as human-readable failure copy (already have UI slots for these):
`CannotBuyOwnNFT`, `ListingNotActive`, `ListingExists`, `MarketplaceNotApproved`,
`NotNFTOwner`, `OfferExpired`, `OfferNotActive`, `InvalidPrice`, `TransferFailed`,
`CollectionNotRegistered` / `CollectionNotActive`.

---

## Data / rarity

`metadata/fevostable.dataset.json` is generated from the CSV and contains:
- `stats` — supply (2222), listed count, owners, floor, top offer, volumes, royalty (5%).
  **Market values (floor/volume/prices/owners) are illustrative** — bind them to on-chain
  reads. Trait data and rarity are real.
- `facets` — every trait type → values with counts and % of supply (drives filters + Traits tab).
- `grid` / `notable` — enriched token samples (id, name, traits, rarity rank, glow palette).
- Rarity rank uses the standard sum-of-inverse-trait-frequency method across all 2,222 tokens.

`Background` is a single value for the whole collection, so it's excluded from filter facets.

---

## Porting notes

- The HTML organizes UI into: header/footer, Home, Collection (Items/Activity/Traits/Offers
  tabs + filter sidebar + cart bar), Item detail (media + price panel + accordions),
  Mint, Profile, and a shared modal layer (wallet, buy, offer, list, cart, mint) implementing
  the PRD's transaction lifecycle (idle → approve → awaiting → pending → success/failure).
- Map each `<section>`/modal to a React component under the PRD's `components/` structure.
- Replace the internal `setState` demo flows with Wagmi `useWriteContract` + `useWaitForTransactionReceipt`;
  keep the exact same visual states (they already match §23 of the PRD).
- Use React Query for all reads; keep skeleton dimensions identical to prevent layout shift (§33).


---

## Part 3A — Real blockchain constants (Next.js wiring)

**Live NFT images are already wired in the UI:** every card and the item page loads
`https://raw.githubusercontent.com/FevoStable/fevostableimage/main/images/{tokenId}.jpg`
with a silent fallback to the generative trait art if the image fails. In production, prefer
Alchemy metadata's image and fall back to this URL pattern.

### Network
- Name: **Stable Mainnet** · Chain ID: **988** · RPC: `https://rpc.stable.xyz`
- Currency / payment token: **USDT0** (ERC-20) — never ETH, never any other token.

### Contracts
- NFT (ERC-721A): `0x26d17f15F467e5BAD9CB816235d856b317D45007` (ABI: `abis/fevostable.json`)
- Marketplace: `0x4c88b742D501D69C86c9CfF92bBbd81BE3AF0B2e` (ABI: `abis/marketplace.json`)
- USDT0 token: `0x779ded0c9e1022225f8e0630b35a9b54be713736`

### Alchemy endpoints — implement automatic failover (1 → 2 → 3, never stop loading)
1. `https://stable-mainnet.g.alchemy.com/v2/alch_WV_rxIrdGNksgTX-pgohg`
2. `https://stable-mainnet.g.alchemy.com/v2/alch_TpQ756y73jjEJBTM8dt3e`
3. `https://stable-mainnet.g.alchemy.com/v2/alch_N5qjELiELs8NlCE7Md4bA`
Wrap in a provider array; on RPC error advance to the next endpoint transparently.

### .env.local (fill the keys above)
```
NEXT_PUBLIC_CHAIN_ID=988
NEXT_PUBLIC_RPC_URL=https://rpc.stable.xyz
NEXT_PUBLIC_EXPLORER_URL=
NEXT_PUBLIC_WALLETCONNECT_ID=
NEXT_PUBLIC_ALCHEMY_URL_1=https://stable-mainnet.g.alchemy.com/v2/alch_WV_rxIrdGNksgTX-pgohg
NEXT_PUBLIC_ALCHEMY_URL_2=https://stable-mainnet.g.alchemy.com/v2/alch_TpQ756y73jjEJBTM8dt3e
NEXT_PUBLIC_ALCHEMY_URL_3=https://stable-mainnet.g.alchemy.com/v2/alch_N5qjELiELs8NlCE7Md4bA
NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x4c88b742D501D69C86c9CfF92bBbd81BE3AF0B2e
NEXT_PUBLIC_FEVOSTABLE_ADDRESS=0x26d17f15F467e5BAD9CB816235d856b317D45007
NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS=0x779ded0c9e1022225f8e0630b35a9b54be713736
NEXT_PUBLIC_NFT_IMAGE_BASE=https://raw.githubusercontent.com/FevoStable/fevostableimage/main/images
```

### Wallet (RainbowKit + Wagmi + Viem + WalletConnect)
Auto-reconnect, network detection, wrong-network detection + switch, and the pending/success/
failure/rejected transaction states (already designed in the modal layer — reuse verbatim).

### Data rules
- Remove all seeded/illustrative market values (prices, floor, volume, offers, activity, owners)
  and bind to on-chain reads + the Alchemy failover provider. Token IDs/traits/rarity stay real.
- **Traits:** Alchemy metadata first; fall back to `metadata/fevostable.dataset.json` / the CSV,
  matched exactly by token ID — never randomize.
- **Payment:** all buy/list/offer amounts are USDT0; approve USDT0 spend before buy/offer,
  and `setApprovalForAll` on the NFT before first listing.

### Contract behavior notes
- **Ignore all lock / trading-lock logic** in the NFT contract — do not surface or enforce it.
- **Free mint:** first 100 eligible wallets mint 1 free; afterwards use the NFT contract's own
  mint rules/pricing — do not reimplement a separate mint flow.


---

## Part 3B — Production marketplace logic (Next.js codebase)

The UI/UX for every flow below is fully realized in the design component (modals, states,
toolbars, Sweep select mode with "Sweep all listed"). Wire each to the contracts; do not
redesign. Remove all seeded market values and read everything from Stable Mainnet.

### Transaction flows → contract calls (all amounts in USDT0)
- **Buy Now:** verify `ownerOf`/listing active + price via marketplace view fns → ensure USDT0
  `allowance(marketplace) >= price` (else `approve`) → `buyNFT(nft, tokenId)` → pending → on receipt
  refetch the item + grid tile only.
- **List / Sell:** verify `ownerOf` → ensure `isApprovedForAll(owner, marketplace)` (else
  `setApprovalForAll(marketplace,true)`) → `listNFT(nft, tokenId, price)`; edit = re-`listNFT`,
  cancel = `cancelListing(nft, tokenId)`.
- **Offers:** ensure USDT0 allowance → `makeOffer(nft, tokenId, price, duration)`;
  `cancelOffer(nft, tokenId)`; owner `acceptOffer(nft, tokenId, buyer)`; hide/expire offers past duration.
- **Sweep / batch buy:** cart → `batchList`/`batchCancel` exist for sellers; for buying, call
  `buyNFT` per item — atomically if the protocol supports it, else sequential with the per-item
  progress checklist already in the cart modal. Partial-failure summary as designed.
- **Mint:** free for first 100 eligible wallets, then the NFT contract's own mint fn/pricing.

### Reads (Alchemy failover provider 1→2→3)
- Collection stats: supply, owners, floor (min active listing), 24h/total volume (event sums),
  listed count, royalty %, mint status — all live, auto-refreshing.
- Item: `ownerOf`, active listing price, best offer, `tokenURI` metadata + traits (fallback to
  `metadata/fevostable.dataset.json`), price history (Sale events), full offers/activity tables.
- Profile: owned (Alchemy NFT-by-owner), listed, minted (Transfer from 0x0), offers made/received.
- Search: collection name, token ID, wallet address, NFT name, owner, listed — resolve on-chain/indexer.

### Activity feed (newest first, real events)
Subscribe to marketplace + NFT events: Mint, Transfer, Listing, Sale, Offer, CancelListing,
CancelOffer, AcceptOffer, PriceUpdate (`ListingUpdated`), MetadataUpdate. Prepend with the
highlight-fade already specified in PRD §17.

### Auto-refresh
After any successful tx, invalidate React Query keys for the affected Marketplace / Profile /
Item / Collection / Activity / Offers surfaces (scoped, not full-page).

### Error taxonomy → UI (map to the existing failure modal / toast copy)
RPC failure & Alchemy failure → advance provider, retry, never stop loading. Wrong network →
switch prompt. User reject → neutral "declined". Gas/out-of-gas/contract-revert → decode reason
(`CannotBuyOwnNFT`, `ListingNotActive`, `MarketplaceNotApproved`, `NotNFTOwner`, `OfferExpired`,
`InsufficientBalance`/allowance, `TransferFailed`). NFT/collection not found, metadata failure →
scoped empty/error state. Image failure → GitHub URL pattern → transparent (art) fallback (done).

### Performance & security
Lazy images, infinite scroll + virtualized grids, React Query + RPC caching, automatic retry,
background refresh, optimistic UI. Never trust frontend state — re-verify ownership/listing/
approval/balance on-chain before every write; disable buttons during pending to prevent double
submits and race conditions.


---

## App Router pages & folder structure (Next.js)

The HTML build renders every screen via an internal route switch. In the Next.js codebase,
split each into its own App Router page so all are bookmarkable and refresh-safe, sharing one
layout (header/footer/theme/animations) via `app/layout.tsx`.

```
app/
  layout.tsx            // shared Header + Footer + providers (wallet, react-query)
  page.tsx              // /                       Home
  marketplace/page.tsx  // /marketplace            Marketplace grid + Bulk Buy
  collections/page.tsx  // /collections            Collections index
  collection/[slug]/page.tsx   // /collection/fevostable-genesis
  nft/[tokenId]/page.tsx       // /nft/1           NFT detail
  profile/[wallet]/page.tsx    // /profile/0x…     Profile
  activity/page.tsx     // /activity
  drops/page.tsx        // /drops                  Mint
  studio/page.tsx       // /studio                 locked Coming Soon
  search/page.tsx       // /search
  favorites/page.tsx    // /favorites
  watchlist/page.tsx    // /watchlist
  settings/page.tsx     // /settings
  notifications/page.tsx// /notifications
```

Map the HTML `route` states to these paths one-to-one. Use `next/link` + `next/navigation`
(`usePathname` for active-nav highlighting — the header already models active state per link).
No `#` links; browser back/forward and refresh must work. Clean routes for fevostable.xyz:
`/marketplace`, `/drops`, `/studio`, `/activity`, `/profile/0x…`, `/nft/1`.

### Header layout (already implemented in the HTML)
Three balanced zones: **left** = logo + search bar, **center** = Marketplace / Studio / Activity /
Drops (absolutely centered, active-highlighted), **right** = search icon / notifications / profile /
Connect Wallet (pinned far right; becomes address + avatar + network + dropdown once connected).
Search bar hides ≤1080px, center nav hides ≤940px (swap in a mobile drawer in production).

### Language
English only throughout — no localization strings to strip.


---

## Production restructure spec (App Router + components + lib)

The HTML build (`FevoStable Marketplace.dc.html`) is the single visual/interaction source of truth.
Port it into the Next.js repo **without changing appearance or blockchain logic** — only split the
one internal `route` switch into real App Router pages and lift shared UI into components.

### app/ (routes — each directly accessible, refresh/back/deep-link safe)
```
app/
  layout.tsx                 // Root layout: Header, Footer, theme, fonts, providers, wallet — loaded ONCE globally
  page.tsx                   // /                         Home  (isHome view)
  marketplace/page.tsx       // /marketplace              Marketplace grid + Filters + BulkBuy  (isCollection/items)
  drops/page.tsx             // /drops                    Drops / mint  (isMint view)
  studio/page.tsx            // /studio                   locked Coming Soon  (isStudio view)
  activity/page.tsx          // /activity                 global activity + "No activity yet."
  collection/[slug]/page.tsx // /collection/fevostable-genesis   collection header + tabs
  nft/[tokenId]/page.tsx     // /nft/1                    NFT detail  (isItem view)
  profile/[wallet]/page.tsx  // /profile/0x…              Profile  (isProfile view)
  search/page.tsx            // /search                   Search
  favorites/page.tsx         // /favorites                Favorites
  watchlist/page.tsx         // /watchlist                Watchlist
  settings/page.tsx          // /settings                 Settings
  notifications/page.tsx     // /notifications            Notifications
```
Replace the internal `this.state.route` switch with routing: nav uses `next/link`; active highlight
via `usePathname()` (header already computes active state). No `#` links. Item click →
`router.push('/nft/'+id)`. Collection stats/tabs live under `/collection/[slug]`; `/marketplace` is
the browse grid.

### components/ (lift these blocks out of the single file — 1:1 with the HTML)
```
components/
  Layout/         RootLayout, PageShell (max-width + padding wrapper)
  Header/         Header (3-zone), MobileNavMenu, SearchBar, AccountMenu
  Footer/         Footer (Marketplace / Resources / Community[X] / Legal)
  NFTCard/        NFTCard (image + rank + price + hover Buy), CardSkeleton
  Marketplace/    MarketplaceGrid, SortControl, ResultsHeader
  Filters/        FilterSidebar, StatusFilter, PriceFilter, TraitFacets   // facets from MINTED tokens only
  BulkBuy/        BulkBuyPanel (50-cap, max-price, select-all, est. total + gas)
  Collection/     CollectionHeader (banner/avatar/stats bar), CollectionTabs (Items/Activity/Traits/Offers)
  Activity/       ActivityTable, ActivityFilters, EmptyState
  Drops/          DropCard, MintPanel (qty, free-remaining, price)
  Studio/         StudioComingSoon
  Wallet/         ConnectModal (MetaMask/Rabby/OKX/WalletConnect/Keplr), WalletButton, NetworkBadge, WrongNetworkBanner
  Modal/          ModalShell, TxFlow (review→approve→awaiting→pending→success/failed/rejected)
  Buttons/        PrimaryButton, GhostButton, IconButton
```

### lib/ (business logic — no UI)
```
lib/
  config/     chain (988), addresses (NFT/Marketplace/USDT0), image base, env readers
  contracts/  fevostable.ts, marketplace.ts (ABIs from /abis + typed viem calls)
  alchemy/    client with 3-endpoint failover (URLs in .env)
  wallet/     multi-wallet detect (the connectWallet logic), add/switch Stable Mainnet
  providers/  WagmiProvider, RainbowKitProvider, ReactQueryProvider
  hooks/      useSupply, useListings, useToken, useTraits(mintedOnly), useOffers, useMint, useBulkBuy
  utils/      format (USDT0/decimals), rarity, addresses (shorten), image fallback (Alchemy→GitHub)
```

### Invariants to preserve during the move
- Appearance, spacing, animations, theme — unchanged (inline styles port verbatim).
- Traits/counts derive from **minted tokens only** (never the full CSV).
- All market data from chain reads or honest empty states ("—", "No activity yet.", "Not listed").
- Payment token USDT0 everywhere; ignore NFT-contract lock logic; free mint = first 100 wallets.
- Header/Footer/providers mount once in `app/layout.tsx` — never duplicated per page.
