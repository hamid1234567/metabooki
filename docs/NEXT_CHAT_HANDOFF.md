# MetaBooki Next Chat Handoff

Last reviewed version: `1.0.672`

Use this file as the first reference in a fresh Codex chat before making changes.

## Current Stable Direction

- The active editor is **Editor V2**. Do not revive or patch old editor flows unless the user explicitly asks.
- Book content display rules must stay centralized. Text rendering, captions, footnotes, references, image captions, interactive blocks, callouts, page markers, and reader/editor preview paths should use the shared content/rendering utilities instead of separate one-off renderers.
- The save system is now a **page-based content engine**. Avoid returning to whole-book saves for normal editor work.
- Full-book fallback is disabled intentionally to prevent large payloads.
- Current autosave model: save dirty pages only, plus manifest/TOC/assets summary only when changed.

## Important Current Files

- `src/features/editor-v2/EditorV2Page.tsx`
  Main editor UI, save orchestration, dirty page tracking, media panel integration, references panel integration, interactive insertion.

- `src/lib/page-content-engine.ts`
  Page-based loading/saving, page manifests, TOC/assets/search summaries, deduplication before Supabase upsert.

- `src/features/interactive-v3/*`
  New clean interactive block system. Each component should own both editor and reader display behavior.

- `src/components/book-content/*` and `src/lib/book-document-v2/*`
  Shared book rendering/content normalization/schema utilities. Prefer changes here when behavior must apply everywhere.

- `docs/SYSTEM_ARCHITECTURE_REFERENCE.md`
  Main architecture reference.

- `docs/DFD_ERD_SECURITY_REFERENCE.md`
  DFD, ERD, security and sensitive-flow reference.

- `docs/VERSION_HISTORY.md`
  Version notes. Version source of truth is `src/lib/version.ts`.

## Recently Fixed / Do Not Regress

- Dynamic import refresh loop after quick-login or chunk cache mismatch was handled.
- Interactive V3 insertion now renders in the editor instead of doing nothing.
- User-uploaded images for interactive blocks are compressed client-side when larger than 1K.
- Page-based save payload was reduced from multi-MB full-book style payloads.
- Supabase `ON CONFLICT DO UPDATE command cannot affect row a second time` was handled by deduping page/search/asset rows before upsert.
- Reader route and local server were checked at `http://localhost:5173/`.

## Current Known Fragile Areas

- Editor save behavior should be tested after any change to:
  - page dirty tracking,
  - TOC updates,
  - media insertion/removal,
  - reference/link editing,
  - interactive block changes.

- TOC must remain independent of the currently loaded page window. Do not rebuild TOC only from the 50 loaded editor pages.
- Media list and image navigation must be able to jump to unloaded pages by loading the needed page window first.
- Search should include caption text and should clear state when search input is cleared.
- Reader and editor should share the same interactive block rendering source.

## Page-Based Engine Rules

- Initial load target: 50 pages.
- Navigation target window: 10 pages before and 40 pages after the requested page/heading.
- Dirty page save: only changed pages should be sent.
- If TOC changed, save the manifest TOC.
- If assets changed, update asset summary without sending the whole book.
- Before any `upsert`, dedupe rows by their conflict key:
  - `book_pages`: `book_id,page_index`
  - `book_search_index`: `book_id,page_index`
  - `book_assets`: `book_id,asset_id`

## Supabase / GitHub Notes

- Real data source should be Supabase, not local mock/cache, for publisher books and production-like flows.
- Local cache must not override newer Supabase data.
- Published books should not be editable by publishers unless unpublished and not purchased, per user rule.
- Private/unpublished publisher books must belong to exactly one publisher owner and must not be visible/editable by other publishers, including admin outside admin-only dashboards.

## Versioning Rule

- Do not bump version for every tiny action.
- Bump version only after a meaningful user-facing code change or deploy-worthy checkpoint.
- Keep these in sync:
  - `src/lib/version.ts`
  - `public/version.json`
  - `public/sw.js`
  - `docs/VERSION_HISTORY.md`

## How To Resume In A New Chat

1. Read this file first.
2. Check `git status --short`.
3. Check current version from `src/lib/version.ts`.
4. If editing code, run a targeted build/test after the change.
5. Keep responses concise and include only the final estimated cost at the end of the final response.

## User Preferences To Preserve

- Persian UI/text must stay proper Unicode and RTL-friendly.
- Do not reintroduce non-Unicode mojibake text.
- Avoid patch-on-patch editor changes. Prefer clean, centralized fixes.
- For long work, continue to completion without asking for confirmation unless genuinely blocked.
- At the end of each final response, include approximate cost using:
  - input token: `1 تومان`
  - output token: `2 تومان`
  - `170,000 تومان = $1`

