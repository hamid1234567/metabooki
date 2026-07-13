# MetaBooki Next Chat Handoff

Last reviewed version: `1.0.715`

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
- Interactive V3 media selection now uses the shared editor book-image/reference media list and modal, supports multi-select for interactive placeholders, and uploads multiple interactive images after client-side compression.
- Interactive V3 reader blocks now render without an outer visible frame, use smaller typography, top-align text beside images, animate item changes, and render tabs with a dedicated reader component.
- Interactive V3 reader direction now comes from the first strong character of actual entered item text; if an interactive block has no text/title, it inherits the book/page direction instead of forcing LTR.
- Editor V2 now allows removing an inserted Interactive V3 block from the editor canvas.
- Reader page-engine placeholders now show a loading placeholder instead of the intentional empty-page message, preventing false empty pages while image-heavy pages are still loading.
- Interactive V3 hotspot blocks now use the image itself as the editor click target, support unlimited add/remove hotspot points, and render reader points as small red plus markers with animated in-image popovers and a show/hide-all control.
- Hotspot editor no longer uses the generic “add item” button; users add points only by clicking the image, and the new point opens a compact inline edit card.
- Hotspot editor point text now uses a fixed card area below the image instead of floating at the marker, so edge points remain editable.
- Hotspot reader popovers are no longer clipped by the image canvas and use physical left/right placement so RTL pages do not push edge popovers off-screen; hotspot images now store an adjustable width percent.
- Interactive V3 circular previous/next controls now center their arrow glyphs with grid alignment and LTR icon direction.
- Interactive V3 gallery, timeline, and storytelling previous/next controls now sit together in a bottom action row, with RTL-appropriate arrow directions for previous/next movement.
- Interactive V3 gallery was restored to the simpler previous layout and now adds only a default 3-second autoplay timer with a pause/play control.
- Interactive V3 simple gallery now uses a smoother eased slide transition, 5-second autoplay, overlay captions with gradient, and an in-image caption visibility toggle beside the play/pause control.
- Interactive V3 gallery RTL motion now keeps the first image at the right side and brings the next image in from left to right; the caption toggle icon is `CC`.
- Interactive V3 gallery thumbnails now switch to the selected gallery image without triggering the global image zoom; gallery empty image space uses a frosted glass surface, caption on/off is visually distinct, and the active thumbnail frame is stronger.
- Interactive V3 storytelling now has a dedicated reader layout with separated rounded images, colored active-step text accents, side step navigation, progress dots, and cleaner previous/next controls.
- Storytelling controls are direction-aware: the next button sits on the left in RTL and on the right in LTR; empty step titles stay empty instead of falling back to `مرحله n`.
- Storytelling mobile tabs use fixed-width horizontal scroll cards, and stage changes use a controlled fade-out/fade-in transition to avoid image flash/jump.
- Storytelling transitions now use a simultaneous crossfade: the outgoing panel fades out while the incoming panel fades in on top of it.
- Interactive V3 tabs use square-like top-rounded tab buttons connected to a faint themed content panel; active tab and panel share the same accent, and mobile tabs scroll horizontally.
- Interactive V3 tabs were shortened after the initial redesign, and active/inactive contrast is stronger so inactive tabs stay muted while the active tab carries the accent.
- Interactive V3 tabs were then shifted to the blue top-bar reference design: simple labels on a blue strip, muted inactive labels, white active label, and a rounded white marker under the active tab; the content panel uses a faint blue theme.
- Interactive V3 tabs now use an iOS-style segmented control: gray rounded track, white active pill with subtle shadow, muted inactive labels, and horizontal mobile scrolling.
- Interactive V3 tabs inherit book/page direction for tab ordering and media/text placement; the segmented track uses the site's frosted menu glass instead of flat gray.
- Interactive V3 tab items must always have a visible title. Empty tab titles fall back to `تب n` in the reader/editor and are filled during editor save; this exception does not apply to other interactive kinds.

- Interactive V3 author intro popovers animate out with a reverse close animation. Author editor placeholders now support adding multiple names from a line-by-line list and reusing saved author profiles from previous author interactive blocks inside the same author placeholder.
- Interactive V3 editor items now have up/down reorder controls next to delete, and selecting images from the book for an interactive item copies the source image caption into that item's empty description/caption field.
- AI gateway outputs are now listed as reusable saved outputs in the Editor V2 AI panel and in the user profile, covering both text and image results across books.
- Interactive image generation now requires an explicit cost approval, keeps the exact clicked placeholder in a loading/disabled state while waiting, and inserts the result back into that same placeholder.
- Reusing saved AI outputs can insert text into the editor or place saved images into the active interactive media placeholder.
- Editor V2 AI history remains user-scoped, now supports a current-book-only filter, and uses larger image thumbnails.
- Admin AI provider tests now show separate route results for text, image, and KIE audio using the selected models; KIE Qwen text-to-image uses `/api/v1/jobs/createTask` with `input.image_size`.
- Admin AI provider test UI now creates fallback route rows when an older edge response lacks `routes`, so text/image/audio model rows remain visible instead of only showing the main model.
- Missing fallback route rows now render as neutral `NOT REPORTED` instead of red errors; the old single-model success response is mapped to the text route.
- Interactive AI image approval closes immediately after confirmation; the selected placeholder owns the visible loading state until the image appears.
- Generated interactive images are compressed/uploaded before insertion when browser fetch permits it, and AI history image reuse uses a stable placeholder descriptor instead of only a transient DOM ref.
- Editor AI history uses stale-response protection around the current-book filter and shows explicit loading/empty/error messages.
- Editor V2 page-engine save failures now use a Persian user-facing connection/save retry message; raw Supabase details are kept only under `جزئیات فنی`.

- Editor V2 AI panel now labels the text action as callout suggestion generation; AI history/profile output lists expose loading/empty/error states, and AI gateway/history reads use client-side timeouts so stuck requests no longer look like empty lists.
- AI callout suggestions now use a stricter educational-editor prompt, may return no suggestions instead of forcing weak callouts, refresh history when the AI panel opens, and AI history images fall back to insertion as normal editor image blocks when no interactive placeholder is active.
- AI callout/text enhancement now uses the user's Persian professional digital-book editor prompt as the default admin-editable `readerCalloutSuggestions` prompt and renders actionable suggestion cards in Editor V2 with apply/dismiss controls.
- Editor V2 AI analysis now scopes to exact selected text, current block, or current page instead of the start of the full document; applying a suggested callout replaces the matched source quote with the callout rather than inserting below it.
- AI text cost estimates now use expected output tokens per action instead of charging the full model cap up front; callout suggestion estimates should be much closer to the configured provider formula.
- AI editorial suggestions now distinguish formatting/editing from educational callouts even when the model returns a `variant`, and common formatting actions can apply as heading, list, paragraph split, or bold instead of becoming callouts.
- AI formatting suggestions now apply more inline styles directly to the source text, including bold, italic, underline, strike, highlight/background color, text color, and font-size adjustments; block-level alignment/style suggestions are handled separately.
- AI text estimate preflight now uses a weighted range rule when output usage is bounded: `(2 * minimum + maximum) / 3`, while completed requests still charge by actual provider usage.
- Applied AI suggestions now stay visible as green completed cards instead of disappearing, and suggestion application computes the document change before committing so later suggestions do not get stuck after the first applied item.
- AI editorial suggestion classification now treats explicit `suggestionType: formatting` as formatting even when callout words appear in action/title; callouts are capped to at most two generated suggestions so the flow follows the admin prompt's formatting-first intent.
- AI text cost approval modal temporarily shows detailed estimate math for callout/editorial suggestions, including input tokens, min/max/weighted output tokens, model rates, multiplier, USD-to-toman conversion, and final credits.
- AI editorial suggestion approval now closes the cost modal immediately after confirmation; the approved payload is captured locally so generation can continue while the AI panel/loading state shows progress.

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

## Existing Git Checkpoints

These checkpoints are git tags already present in the repository. Prefer creating a new branch from a checkpoint for inspection or recovery. Do not use destructive reset unless the user explicitly asks.

Safe inspection:

```bash
git switch -c inspect/<name> <tag-name>
```

Safe file-level restore from a checkpoint:

```bash
git restore --source <tag-name> -- <file-or-folder>
```

Safe comparison:

```bash
git diff <tag-name>..HEAD -- <file-or-folder>
```

Known checkpoints:

| Tag | Commit | Purpose | When to use |
| --- | --- | --- | --- |
| `editor-text-complete-v1.0.393` | `327b41c` | Text editor baseline after central text editing became usable. | Recover core text toolbar/content editing behavior. |
| `checkpoint-callout-complete-20260625-011120` | `6ae1366` | Callout system completed before media panel fixes. | Recover callout behavior/design if later media or interactive changes break callouts. |
| `checkpoint/page-engine-before-implementation-20260629-0118` | `b0b1e70` | State before page-based content engine implementation. | Compare against pre-page-engine behavior only; avoid restoring wholesale unless explicitly requested. |
| `checkpoint/editor-v2-before-delta-save-20260628-2255` | `c6b3e44` | State before Editor V2 delta/page save work. | Investigate save regressions introduced by delta/page saving. |
| `checkpoint/editor-v2-current-1.0.597` | `4769756` | Editor V2 checkpoint around version 1.0.597. | Recover broad Editor V2 state after early page-engine/documentation stabilization. |
| `checkpoint/editor-v2-media-toc-stable-1.0.599` | `b12eae4` | Media and TOC stable checkpoint. | Recover media list / TOC navigation behavior if later changes break either one. |
| `editor-v2-references-checkpoint-v1.0.668` | `7db9775` | References panel and reader hover behavior completed. | Recover reference/link/footnote/image-reference behavior. |
| `editor-v2-save-checkpoint-v1.0.668` | `0fe2b16` | Page-based save payload and TOC manifest persistence stable. | Recover save payload reduction and TOC persistence behavior. |

Suggested recovery workflow:

1. Save the current work first:

```bash
git status --short
git diff > tmp/current-work-before-restore.patch
```

2. Compare checkpoint with current code:

```bash
git diff <tag-name>..HEAD -- src/features/editor-v2 src/lib/page-content-engine.ts src/components/book-content src/lib/book-document-v2
```

3. Restore only the broken area, not the entire repo:

```bash
git restore --source <tag-name> -- src/features/editor-v2/EditorV2Page.tsx
```

4. Build and test before continuing:

```bash
npm.cmd run build
```

## How To Resume In A New Chat

1. Read this file first.
2. Check `git status --short`.
3. Check current version from `src/lib/version.ts`.
4. Check tags with `git tag --list` if rollback or comparison is needed.
5. If editing code, run a targeted build/test after the change.
6. Keep responses concise and include only the final estimated cost at the end of the final response.

## User Preferences To Preserve

- Persian UI/text must stay proper Unicode and RTL-friendly.
- Do not reintroduce non-Unicode mojibake text.
- Avoid patch-on-patch editor changes. Prefer clean, centralized fixes.
- For long work, continue to completion without asking for confirmation unless genuinely blocked.
- At the end of each final response, include approximate cost using:
  - input token: `1 toman`
  - output token: `2 toman`
  - `170,000 toman = $1`
