# Metabooki Version History and Decision Log

Ù†Ø³Ø®Ù‡ ÙØ¹Ù„ÛŒ ÙØ§ÛŒÙ„ Ø±Ø³Ù…ÛŒ: `1.0.720`
Ù…Ù†Ø¨Ø¹ Ù†Ø³Ø®Ù‡: `src/lib/version.ts`

Ø§ÛŒÙ† ÙØ§ÛŒÙ„ ØªØ§Ø±ÛŒØ®Ú†Ù‡ Ù…Ø­ØµÙˆÙ„ÛŒ Ú©Ø§Ù…Ù„ Ù†ÛŒØ³ØªØ› Ù‡Ø¯Ù Ø¢Ù† Ø«Ø¨Øª ØªØµÙ…ÛŒÙ…â€ŒÙ‡Ø§ÛŒ Ù…Ø¹Ù…Ø§Ø±ÛŒ Ùˆ Ø¹Ù„Øª ØªØºÛŒÛŒØ±Ø§Øª Ù…Ù‡Ù… Ø§Ø³Øª ØªØ§ Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ†ÙˆÛŒØ³ Ø¨Ø¹Ø¯ÛŒ Ø¨Ø¯Ø§Ù†Ø¯ Ú†Ø±Ø§ Ù…Ø³ÛŒØ± ÙØ¹Ù„ÛŒ Ø§Ù†ØªØ®Ø§Ø¨ Ø´Ø¯Ù‡ Ø§Ø³Øª.

## Ù‚ÙˆØ§Ø¹Ø¯ Ù†Ú¯Ù‡Ø¯Ø§Ø±ÛŒ Ù†Ø³Ø®Ù‡

1. Ø¹Ø¯Ø¯ Ù…Ø¹ØªØ¨Ø± Ù†Ø³Ø®Ù‡ ÙÙ‚Ø· `APP_VERSION` Ø¯Ø± `src/lib/version.ts` Ø§Ø³Øª.
2. Ù‚Ø¨Ù„ Ø§Ø² deployØŒ `public/version.json` Ùˆ `public/sw.js` Ø¨Ø§ÛŒØ¯ Ø¨Ø§ Ø¢Ù† Ù‡Ù…Ø§Ù‡Ù†Ú¯ Ø¨Ø§Ø´Ù†Ø¯.
3. Ù‡Ø± ØªØºÛŒÛŒØ± Ù…Ø¹Ù…Ø§Ø±ÛŒ ÛŒØ§ ØªØºÛŒÛŒØ± Ø±ÙØªØ§Ø± cache/save/render Ø¨Ø§ÛŒØ¯ Ø¯Ø± Ø§ÛŒÙ† ÙØ§ÛŒÙ„ Ø«Ø¨Øª Ø´ÙˆØ¯.
4. Ø§Ú¯Ø± ØªØºÛŒÛŒØ±ÛŒ ÙÙ‚Ø· UI Ú©ÙˆÚ†Ú© Ø§Ø³ØªØŒ Ø«Ø¨Øª Ø¯Ø± commit Ú©Ø§ÙÛŒ Ø§Ø³Øª.
5. Ø¨Ø§ Ù‡Ø± Ø§ÙØ²Ø§ÛŒØ´ Ù†Ø³Ø®Ù‡ Ø³Ø§ÛŒØªØŒ Ø¹Ù„Øª Ø§ÙØ²Ø§ÛŒØ´ Ù†Ø³Ø®Ù‡ Ø¨Ø§ÛŒØ¯ Ø¯Ø± Ù‡Ù…ÛŒÙ† ÙØ§ÛŒÙ„ ÛŒØ§ Ø¯Ø± Ø¨Ø®Ø´ ØªØµÙ…ÛŒÙ…â€ŒÙ‡Ø§ÛŒ Ù…Ø¹Ù…Ø§Ø±ÛŒ Ù…Ø±ØªØ¨Ø· Ø«Ø¨Øª Ø´ÙˆØ¯.

## Ø®Ù„Ø§ØµÙ‡ Ù…Ø³ÛŒØ± Ù†Ø³Ø®Ù‡â€ŒÙ‡Ø§

### 1.0.720 - AI long response continuation

- Text/editorial AI requests now detect truncated or invalid structured JSON and automatically ask the provider to continue or repair the response before parsing.
- Actual token usage now includes continuation/repair calls, and successful long responses are saved to the user's AI history with a continuation marker.
- If a long response still cannot be parsed, the raw output is stored in the same user's AI history instead of disappearing, and the editor refreshes the AI panel after the error.

### 1.0.719 - KIE model list refresh

- KIE text model options now include GPT 5.6 Luna, Terra, and Sol, with GPT 5.6/5.5/5.4 routed through `/codex/v1/responses` and GPT 5.2 kept on its chat-completions route.
- KIE image model options now include GPT Image 1.5, Seedream v4, and Seedream 5 Lite/Pro text-to-image entries, with legacy short aliases normalized before sending requests.
- KIE default settings now start with GPT 5.6 Luna and GPT Image 1.5, while existing saved KIE audio aliases remain normalized.

### 1.0.718 - AI suggestions scale by analyzed pages

- Editor V2 now calculates how many pages are included in the AI editorial analysis source and requests at least three suggestions per analyzed page.
- The AI approval modal displays the analyzed page count and requested minimum suggestion count.
- The deployed `ai-gateway` Edge Function now receives these values, injects them into the callout/editorial prompt, and scales max/estimated output tokens for cost estimation.

### 1.0.717 - Local route preload relief

- Development builds now skip background preloading of heavy route chunks such as Reader, Editor V2, and Upload.
- This avoids compiling/loading Reader in the background while opening Editor V2 on localhost, reducing perceived local slowness.
- Production route preloading remains unchanged.

### 1.0.716 - AI heading-section source

- Editor V2 AI editorial/callout suggestions now use the user's current heading section as the default input instead of only the active page.
- The source range starts at the nearest previous/current heading and stops at the next same-or-higher-level heading or 8,000 characters, whichever comes first.
- Explicit text selections remain honored as the exact AI input, still capped at 8,000 characters.

### 1.0.715 - AI approval modal closes on run

- The Editor V2 AI editorial suggestion approval modal now closes immediately when the user confirms generation instead of staying visible during or after generation.
- The approved estimate payload is captured locally before clearing approval state, so generation continues safely after the modal closes.
- Current AI source selection remains selection, then selected block, then current page fallback; heading-section input should be considered as a capped option because token use depends on section length.

### 1.0.714 - Temporary AI cost formula display

- The Editor V2 AI approval modal now temporarily displays detailed cost-estimate math for editorial/callout suggestions.
- The AI gateway text estimate response now includes `estimateDetails` with input tokens, min/max/weighted output tokens, provider rates, multiplier, USD-to-toman conversion, credit value, and final charged credits.
- The approval modal copy was updated to describe mixed formatting/callout suggestions instead of saying the operation only creates callouts.

### 1.0.713 - AI formatting-first suggestion balance

- AI editorial suggestion classification now honors explicit `suggestionType: formatting` before checking callout-like action/title text, preventing formatting suggestions from turning into callouts.
- The editor normalizes AI suggestion batches so at most two items remain `educational_callout`; the rest are routed as formatting suggestions.
- The Edge Function callout suggestion prompt now explicitly asks for 70-80% formatting suggestions and at most one or two educational callouts.

### 1.0.712 - AI callout detection fix

- AI callout suggestion detection now prioritizes explicit callout signals such as `educational_callout`, `callout`, and Persian callout titles before checking formatting labels.
- Legacy or mixed model outputs that include both formatting and callout wording no longer get routed through formatting, so educational callout cards can convert into real callout blocks again.
- The AI gateway prompt schema now tells models to return exactly one suggestionType value and not a combined value.

### 1.0.711 - AI suggestion applied state

- Applied AI editorial suggestion cards now remain visible as green completed items with a disabled apply button and an applied status message.
- AI suggestion application now computes the document change before committing instead of depending on a mutable flag inside the React state updater, preventing later suggestions from getting stuck after one item is applied.
- Generated AI suggestions now store their likely target block so follow-up suggestions can still apply even after the first change updates the editor surface.

### 1.0.710 - Complete AI formatting application

- AI formatting suggestions now apply inline styles to the exact source text in the document model instead of relying only on DOM selection.
- Supported AI formatting actions now include bold, italic, underline, strike, highlight/background color, text color, font-size changes, and clear-format handling.
- Block-level AI formatting can apply alignment and simple block text styling without converting the suggestion into a callout.
- AI estimate preflight now uses the requested weighted range rule for bounded output usage: `(2 * minimum + maximum) / 3`; completed requests still charge by actual provider token usage.

### 1.0.709 - AI suggestion cost and formatting actions

- AI text cost estimates now use action-specific expected output tokens instead of billing the full generation cap during preflight; callout suggestion estimates no longer include the old 15% max-token padding.
- The callout suggestion generation cap was reduced to better match the stricter editorial prompt while keeping actual post-run credit charging based on real provider token usage.
- Editor V2 now classifies AI suggestions as formatting/editing before checking callout variants, so formatting cards are no longer converted into educational callouts just because `variant` is present.
- Common formatting suggestions can now apply directly as bold text, heading/subheading, list conversion, or paragraph splitting; unsupported formatting suggestions stay non-callout and show a clear message.

### 1.0.708 - Current-page AI source and replacement callouts

- Editor V2 AI text analysis now uses the exact selected text, current selected block, or current editor page instead of falling back to the beginning of the full document.
- Applying an AI educational callout now replaces the matched source text with a callout block, preserving surrounding paragraph text when the quote is inside a larger paragraph.
- AI callout application now uses the original selected/source quote inside the callout body so the author's wording is preserved instead of adding explanatory text under the original passage.

### 1.0.707 - Actionable AI editorial suggestions

- The default admin-editable callout suggestion prompt now uses the user's Persian professional digital-book editor prompt and is applied by default even when the stored setting is empty.
- AI callout/text enhancement output now returns actionable formatting/callout suggestions instead of a generic explanatory paragraph.
- Editor V2 shows the current AI suggestions as a separate list with apply/dismiss actions; educational callouts insert real callout blocks and bold/highlight suggestions can apply directly when the source quote is found.
- The edge prompt schema now asks for suggestion type, exact source quote, proposed action, short reason, importance, and location-ordered suggestions.

### 1.0.706 - AI callout prompt and image history reuse

- The callout suggestion prompt now behaves like an educational editor: it only suggests strong callout-worthy fragments, anchors each suggestion to an exact source quote, and can return no suggestions instead of forcing a weak callout.
- Editor V2 no longer inserts fallback page text when AI returns no strong callout suggestion; it records usage/history and reports that no strong callout was found.
- Reusing an image from AI history now places it in the active interactive placeholder when available, or inserts it as a normal image block in the editor text when no placeholder is active.
- Opening the Editor V2 AI panel refreshes AI history again so old outputs are less likely to appear missing after initial load/session timing issues.

### 1.0.705 - AI history visibility and gateway timeouts

- Editor V2 AI panel now labels the text action as a callout suggestion flow and explains that it inserts a new callout without replacing the original text.
- Saved AI output history now applies the current-book filter before ordering/limiting, has a client-side timeout, and surfaces read errors instead of silently looking empty.
- The user profile AI output section now separates loading, empty, and error states so intermittent Supabase/RLS/network failures are visible.
- AI gateway calls now have client-side timeouts for estimate/run/test/image routes, preventing the UI from staying stuck on cost estimation forever.

### 1.0.704 - User-friendly save failure messages

- Editor V2 save failures caused by `Failed to fetch` now show a Persian user-facing connection message instead of the raw page-engine/full-book fallback text.
- Technical Supabase details are still included under a short `Ø¬Ø²Ø¦ÛŒØ§Øª ÙÙ†ÛŒ` section for debugging, while the main message explains that changes remain in the editor and the user can retry saving.

### 1.0.703 - Interactive AI image placement and history stability

- Interactive image generation approval now closes immediately after user confirmation, while the requested placeholder stays in a visible AI loading state until the image is inserted.
- Generated interactive images are fetched, compressed to the existing 1K interactive-image rule when possible, uploaded, and then inserted from the lighter stored URL.
- Interactive media placeholders now keep a stable target descriptor so images selected from AI history can be inserted even after panel changes or DOM refreshes.
- AI history loading now ignores stale responses when the current-book filter changes quickly, shows loading/empty/error messages, and no longer silently disables image reuse.

### 1.0.702 - Softer AI route fallback states

- Admin AI route fallback no longer marks image/audio as errors when an older single-model test response does not include detailed route results.
- The old successful single-model response is mapped to the text route, while image/audio rows appear as neutral `NOT REPORTED` rows with their selected models.

### 1.0.701 - AI provider route report fallback

- Admin AI provider test results now always display the expected text/image/audio route rows for KIE, even if the deployed edge function returns only the older single-model response.
- The test card now shows a compact route model summary and per-route status/sample text so image and audio models are visible separately from the main text model.

### 1.0.700 - Scoped AI history and KIE route tests

- AI saved output loading now remains explicitly user-scoped and can be filtered to the current book from the Editor V2 AI panel.
- Editor AI history image thumbnails are larger, making generated image reuse easier to inspect before insertion.
- AI saved output RLS is reinforced with an idempotent migration so only the owning user can select their saved AI outputs.
- Admin AI provider testing now reports text, image, and KIE audio routes separately, using the selected text/image/audio models.
- KIE Qwen text-to-image requests remain aligned with the documented `createTask` payload using `model: qwen/text-to-image` and `input.image_size`.

### 1.0.699 - AI output history and interactive image approvals

- AI gateway outputs are now surfaced as reusable saved outputs in the Editor V2 AI panel, with text/image type, creation time, action, and source labels.
- User profiles now list saved AI outputs across books so generated text and images remain available for later reuse and review.
- Interactive image generation now opens an explicit cost approval step before sending the request, keeps the exact clicked placeholder in a loading/disabled state, and inserts the returned image into that same placeholder.
- Interactive generated-image usage now avoids duplicate client-side credit animation when the gateway reports an already charged/polled result.

### 1.0.698 - Interactive item ordering and image captions

- Interactive V3 editor items now include up/down controls beside delete so users can reorder item-based interactive content while keeping each item's full data together.
- Book-image selection for interactive media now carries the source image caption into the matching interactive item description field when that field is empty.
- Gallery images receive the source caption as their caption, while tabs/accordion/timeline/storytelling receive it as description, flashcards as back text, authors as bio, and hotspot images as caption/text where applicable.

### 1.0.697 - Reusable author blocks

- Author interactive editor placeholders now support adding multiple author names from a line-by-line list.
- Saved author data from previous author interactive blocks is shown inside new author placeholders so users can reuse selected authors without recreating their image, role, and bio.
- The earlier author text lookup action was removed in favor of explicit author reuse from saved interactive author data.

### 1.0.696 - Author intro exit and text lookup

- Interactive V3 author intro popovers now keep a short exiting state so their close animation mirrors the opening animation instead of disappearing instantly.
- Author items in the editor now include a direct action to find a matching author name in the editable book text, scroll to it, and select the matched text.

### 1.0.695 - Tabs require item titles

- Interactive V3 tabs are now the exception to the empty-title rule: every tab item gets a title fallback such as `ØªØ¨ 1`.
- New tab blocks start with titled tab items, old empty tab titles render with a fallback, and editor saves fill cleared tab titles back in.

### 1.0.694 - Interactive tabs inherited direction and frosted track

- Interactive V3 tabs now inherit the book/page direction for tab ordering instead of deriving layout direction from tab text.
- Tab media/text layout now follows the inherited book direction, while mobile stays single-column.
- The iOS-style segmented track now uses the site's frosted menu glass surface instead of a flat gray background.

### 1.0.693 - Interactive tabs iOS segmented style

- Interactive V3 tabs now use an iOS-style segmented control with a soft gray rounded track.
- The active tab is a white rounded pill with a subtle iOS-like shadow, while inactive labels remain muted.
- Mobile keeps the same segmented style with horizontal scrolling when tab labels do not fit.

### 1.0.692 - Interactive tabs blue bar reference design

- Interactive V3 tabs now follow the blue top-bar reference style with simple tab labels and a white rounded active marker at the bottom of the active tab.
- The content panel uses a faint blue themed background connected to the tab bar, while mobile keeps the same design with horizontal scrolling when needed.

### 1.0.691 - Interactive tabs height and active contrast polish

- Interactive V3 tab buttons are shorter on desktop and mobile so they read more like tabs than tall cards.
- Active and inactive tab states are now more distinct: inactive tabs are flatter and muted, while the active tab uses a stronger shared accent.

### 1.0.690 - Interactive tabs visual redesign

- Interactive V3 tabs now use square-like tab buttons with rounded top corners and flat bottoms connected to the content panel.
- The active tab and tab content panel share a faint accent theme that changes with the active tab.
- Tab labels are larger than normal body text, and mobile tabs keep the same shape with horizontal scrolling when needed.

### 1.0.689 - Storytelling simultaneous crossfade

- Storytelling stage changes now render outgoing and incoming panels at the same time for a true crossfade.
- The old sequential fade-out then fade-in blank gap was removed to avoid the visible flash/jump between images.

### 1.0.688 - Storytelling mobile tabs and fade transition

- Storytelling mobile step tabs now render as fixed-width horizontal cards with overflow scrolling, so small screens do not squeeze titles into broken narrow columns.
- Storytelling step changes now use a controlled fade-out/fade-in sequence instead of remounting the image panel with a flash-like jump.
- The storytelling navigation and empty-title behavior from 1.0.687 remain unchanged.

### 1.0.687 - Storytelling direction and empty-title polish

- Storytelling previous/next controls now place the next button at the visual end of the inherited text direction: left for RTL and right for LTR.
- Storytelling no longer creates artificial step titles when a step title is empty.
- The dedicated storytelling reader markup still uses the shared Interactive V3 block wrapper, item normalization, and direction utilities.

### 1.0.686 - Storytelling reader redesign

- Interactive V3 storytelling now uses a dedicated reader layout with separated image and text areas.
- Story images have rounded framed media treatment, while text cards use colored step accents for the active story stage.
- Step navigation was redesigned with clearer side step buttons, progress dots, and cleaner previous/next controls.

### 1.0.685 - Gallery thumbnail and visual state polish

- Gallery thumbnails now change the active gallery image without bubbling to the global image zoom handler.
- Gallery empty image space now uses a frosted glass surface instead of a flat gray fill.
- Caption toggle on/off state and the active thumbnail frame are now visually clearer.

### 1.0.684 - Gallery RTL motion direction

- Gallery RTL slide order now keeps the first image on the right and moves to the next image from left to right.
- The paused play icon now points in the actual gallery movement direction.
- The caption visibility control now uses a `CC` label.

### 1.0.683 - Simple gallery motion and captions

- Simple Interactive V3 gallery now moves between images with an eased horizontal transition instead of a flash-style swap.
- Gallery autoplay interval changed from three seconds to five seconds.
- Captions now render over the image with a bottom gradient and can be hidden or shown from an in-image control next to play/pause.

### 1.0.682 - Restore simple gallery with timer

- Restored the Interactive V3 gallery to the simpler pre-redesign layout so the reader route can load the gallery component again.
- Added default 3-second autoplay to the simple gallery, with a small pause/play control in the existing navigation row.
- Removed the failed carousel-shell styling from the active gallery CSS path.

### 1.0.681 - Interactive nav row placement

- Gallery, timeline, and storytelling previous/next controls now render together in a bottom action row instead of flanking the content.
- Previous and next arrow glyphs were swapped to match the RTL reading flow and actual slide movement.

### 1.0.680 - Interactive nav arrow centering

- Circular previous/next buttons in Interactive V3 gallery, timeline, and storytelling views now center their arrow glyphs reliably.
- Nav buttons use grid centering, fixed flex basis, zero padding, and LTR icon direction so RTL page alignment does not shift the markers.

### 1.0.679 - Hotspot popover clipping and image sizing

- Reader hotspot popovers no longer clip at the image border and use physical left/right placement so RTL direction does not push edge labels off-screen.
- Hotspot images now keep an `imageWidthPercent` payload value and render at that width in editor and reader.
- Editor hotspot blocks now include the same width range control pattern used for regular images.

### 1.0.678 - Hotspot fixed editor text panel

- Hotspot marker clicks now open the matching point editor in a fixed card area below the image.
- Newly added points open the fixed text card immediately and focus the description field.
- Edge points no longer place editable fields outside the editor canvas.

### 1.0.677 - Hotspot editor click-to-add fix

- Hotspot blocks no longer render the generic interactive add-item button.
- New hotspot blocks start with an image placeholder and no forced point; users add points by clicking the selected image.
- Clicking a hotspot marker in the editor opens only that compact edit card, and deleting the final point is allowed.

### 1.0.676 - Interactive V3 hotspot redesign

- Hotspot editor blocks now show the full image as the click target and add new points at the clicked image coordinate.
- Hotspot points can be added and removed without the normal interactive item limit.
- Reader hotspots now render as compact red plus markers with animated popovers, automatic inward placement, connector lines, a show/hide-all control, and smaller text when many points exist.

### 1.0.675 - Reader page-engine loading placeholder

- Reader no longer shows the intentional empty-page message while a page-engine page is still a loading placeholder.
- BookRenderer V2 now treats `pageEnginePlaceholder` pages as loading pages, not empty content pages.
- Page-engine window loading in Reader reruns when the current placeholder state changes, reducing cases where navigation was needed to refresh image-heavy pages.

### 1.0.674 - Interactive V3 inherited direction

- Interactive V3 reader blocks now derive RTL/LTR from the first strong character in the actual entered item text.
- Empty-title/empty-text interactive blocks no longer force LTR; they inherit the surrounding book direction for tabs, buttons, and layout alignment.
- Interactive text and controls use logical `text-align: start` so Persian content aligns right and English content aligns left.

### 1.0.673 - Interactive V3 editor and reader polish

- Interactive image selection now reuses the editor media/reference image list and shared book-image modal, with multi-select support for interactive placeholders.
- Interactive uploads accept multiple files, compress oversized images before server upload, and notify the user when compression happens.
- Interactive blocks can be removed from Editor V2, empty interactive titles stay hidden in the reader, and tabs now render with their own reader component.
- Reader-side interactive blocks now sit transparently in the book flow, use smaller typography, top-align text beside images, and animate item transitions.

### 1.0.672 - prevent route preload refresh loops

- Background route preloads no longer trigger dynamic-import recovery reloads.
- Dynamic import recovery now ignores `appVersion` and `recover` query parameters when creating its once-per-route marker.
- This prevents non-home routes from entering a reload loop when a stale chunk, cache, or service worker is still present.

### 1.0.671 - Ø§ØµÙ„Ø§Ø­ Ø´Ù†Ø§Ø³Ù‡ Ùˆ payload Ù…Ø¯Ù„â€ŒÙ‡Ø§ÛŒ Nano Banana Ø¯Ø± KIE

- Ø´Ù†Ø§Ø³Ù‡â€ŒÙ‡Ø§ÛŒ ØªØµÙˆÛŒØ±ÛŒ Google Nano Banana Ø§Ø² `google/nano-banana-*` Ø¨Ù‡ `nano-banana-*` ØªØºÛŒÛŒØ± Ú©Ø±Ø¯Ù†Ø¯.
- payload Ù…Ø¯Ù„â€ŒÙ‡Ø§ÛŒ Nano Banana Ø¨Ø§ Ù…Ø³ÛŒØ± Ø¹Ù…ÙˆÙ…ÛŒ KIE Ù‡Ù…Ø§Ù‡Ù†Ú¯ Ø´Ø¯ Ùˆ Ø¯ÛŒÚ¯Ø± Ù…Ø«Ù„ Qwen Ø¨Ø§ `image_size` Ø§Ø±Ø³Ø§Ù„ Ù†Ù…ÛŒâ€ŒØ´ÙˆØ¯.

### 1.0.670 - ØªØ¨Ø¯ÛŒÙ„ ØªÙˆÙ„ÛŒØ¯ ØªØµÙˆÛŒØ± KIE Ø¨Ù‡ task polling

- ØªÙˆÙ„ÛŒØ¯ ØªØµÙˆÛŒØ± KIE Ø§Ø² Ø§Ù†ØªØ¸Ø§Ø± Ø·ÙˆÙ„Ø§Ù†ÛŒ Ø¯Ø§Ø®Ù„ Edge Function Ø¨Ù‡ start/poll Ú©ÙˆØªØ§Ù‡ Ù…Ù†ØªÙ‚Ù„ Ø´Ø¯ ØªØ§ Ø®Ø·Ø§ÛŒ compute resources Ø±Ø® Ù†Ø¯Ù‡Ø¯.
- Ø§Ø³ØªØ®Ø±Ø§Ø¬ task id Ø¨Ø±Ø§ÛŒ Ù¾Ø§Ø³Ø®â€ŒÙ‡Ø§ÛŒ Ù…Ø®ØªÙ„Ù KIE Ù…Ù‚Ø§ÙˆÙ…â€ŒØªØ± Ø´Ø¯.
- Ù‡Ø²ÛŒÙ†Ù‡ ØªØµÙˆÛŒØ± ÙÙ‚Ø· Ø¨Ø¹Ø¯ Ø§Ø² Ø¯Ø±ÛŒØ§ÙØª URL Ù†Ù‡Ø§ÛŒÛŒ ØªØµÙˆÛŒØ± Ú©Ø³Ø± Ù…ÛŒâ€ŒØ´ÙˆØ¯.

### 1.0.669 - Ø§ØµÙ„Ø§Ø­ Ù…Ø³ÛŒØ± Ù…Ø¯Ù„â€ŒÙ‡Ø§ÛŒ KIE

- Ù…Ø³ÛŒØ± ÙØ±Ø§Ø®ÙˆØ§Ù†ÛŒ KIE Ø¨Ø±Ø§ÛŒ Ø®Ø§Ù†ÙˆØ§Ø¯Ù‡â€ŒÙ‡Ø§ÛŒ Ù…Ø®ØªÙ„Ù Ù…Ø¯Ù„ Ø¬Ø¯Ø§ Ø´Ø¯ ØªØ§ Ù…Ø¯Ù„ Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡ Ø¯Ø± Ù¾Ù†Ù„ Ø§Ø¯Ù…ÛŒÙ† Ø¯Ù‚ÛŒÙ‚Ø§Ù‹ Ù‡Ù…Ø§Ù† Ù…Ø¯Ù„ Ø§Ø±Ø³Ø§Ù„â€ŒØ´Ø¯Ù‡ Ø¨Ù‡ KIE Ø¨Ø§Ø´Ø¯.
- Ù…Ø³ÛŒØ±Ù‡Ø§ÛŒ Codex responsesØŒ GPT 5.2 chat completionsØŒ Claude messagesØŒ Gemini chat completions Ùˆ Grok responses Ø§Ø² Ù‡Ù… ØªÙÚ©ÛŒÚ© Ø´Ø¯Ù†Ø¯.
- Ø´Ù†Ø§Ø³Ù‡â€ŒÙ‡Ø§ÛŒ Ù…Ø¯Ù„ ØªØµÙˆÛŒØ± KIE Ø¨Ù‡ Ø´Ù†Ø§Ø³Ù‡â€ŒÙ‡Ø§ÛŒ Ù…Ø¹ØªØ¨Ø± Ù…Ø«Ù„ `qwen/text-to-image` Ø§ØµÙ„Ø§Ø­ Ø´Ø¯Ù†Ø¯.
- Edge Function `ai-gateway` Ø¨Ø¹Ø¯ Ø§Ø² Ø§ØµÙ„Ø§Ø­ routeÙ‡Ø§ Ù…Ø¬Ø¯Ø¯Ø§Ù‹ Ø±ÙˆÛŒ Supabase deploy Ø´Ø¯.

### 1.0.3xx - Ø´Ø±ÙˆØ¹ Editor V2

- Ø§Ø¯ÛŒØªÙˆØ± Ø¬Ø¯ÛŒØ¯ Ø¨Ø§ Ø¨ÙˆÙ… Ù…Ø±Ú©Ø²ÛŒ Ùˆ Ù¾Ù†Ù„ Ø³Ù…Øª Ø±Ø§Ø³Øª Ø·Ø±Ø§Ø­ÛŒ Ø´Ø¯.
- Ù‡Ø¯Ù: Ø¬Ø§ÛŒÚ¯Ø²ÛŒÙ†ÛŒ Ø§Ø¯ÛŒØªÙˆØ± Ù‚Ø¯ÛŒÙ…ÛŒ Ùˆ Ù¾Ø§ÛŒØ§Ù† Ø¯Ø§Ø¯Ù† Ø¨Ù‡ patchÙ‡Ø§ÛŒ Ù¾Ø±Ø§Ú©Ù†Ø¯Ù‡.
- Ú¯Ø²Ø§Ø±Ø´ Ø§ÙˆÙ„ÛŒÙ‡ Ø¯Ø± `docs/editor-v2-implementation-report.md` Ø¨Ø§Ù‚ÛŒ Ù…Ø§Ù†Ø¯Ù‡ Ø§Ø³Øª.

### 1.0.4xx - Ø¹Ù…Ù„ÛŒØ§ØªÛŒâ€ŒØ³Ø§Ø²ÛŒ Ù†Ø´Ø± Ùˆ Supabase

- Ù¾Ù†Ù„ Ù†Ø´Ø±ØŒ Ù‚ÙØ³Ù‡ Ù…Ù†ØŒ ÙØ±ÙˆØ´Ú¯Ø§Ù‡ Ùˆ Admin Ø¨Ù‡ Supabase Ù†Ø²Ø¯ÛŒÚ©â€ŒØªØ± Ø´Ø¯Ù†Ø¯.
- Ù…Ø´Ú©Ù„ Ø§Ø®ØªÙ„Ø§Ù local/GitHub/VS Code browser Ø´Ù†Ø§Ø³Ø§ÛŒÛŒ Ø´Ø¯.
- ØªØµÙ…ÛŒÙ… Ù…Ø¹Ù…Ø§Ø±ÛŒ: Supabase Ø¨Ø§ÛŒØ¯ source of truth Ø¨Ø§Ø´Ø¯ Ùˆ local fallback ÙÙ‚Ø· dev/demo Ø¨Ù…Ø§Ù†Ø¯.

### 1.0.50x - ÛŒÚ©Ù¾Ø§Ø±Ú†Ù‡â€ŒØ³Ø§Ø²ÛŒ Ù†Ù…Ø§ÛŒØ´ Ù…Ø­ØªÙˆØ§

- `book-content.ts` Ùˆ `BookContentBlocks.tsx` Ø¨Ù‡â€ŒØ¹Ù†ÙˆØ§Ù† Ù…Ø³ÛŒØ± Ù…Ø´ØªØ±Ú© Ù†Ù…Ø§ÛŒØ´ Ù…ØªÙ†ØŒ calloutØŒ interactiveØŒ caption Ùˆ tooltip ØªØ«Ø¨ÛŒØª Ø´Ø¯Ù†Ø¯.
- ZWS/ZWNJØŒ Ù¾Ø§ÙˆØ±Ù‚ÛŒØŒ Ø±ÙØ±Ù†Ø³ØŒ Ù„ÛŒÙ†Ú©ØŒ subscript/superscript Ùˆ ÙØ±Ù…ÙˆÙ„â€ŒÙ‡Ø§ Ø¨Ø§ÛŒØ¯ Ø§Ø² Ù‡Ù…ÛŒÙ† Ù…Ø³ÛŒØ±Ù‡Ø§ Ú©Ù†ØªØ±Ù„ Ø´ÙˆÙ†Ø¯.

### 1.0.54x - Ø¨Ù‡Ø¨ÙˆØ¯ Ø§Ø¯ÛŒØªÙˆØ± Ù…ØªÙ† Ùˆ Ø±Ø³Ø§Ù†Ù‡

- toolbar Ù…ØªÙ† Ú©ÙˆÚ†Ú©â€ŒØªØ± Ùˆ Ø¹Ù…Ù„ÛŒØ§ØªÛŒâ€ŒØªØ± Ø´Ø¯.
- autosave Ø§Ø² Ø±ÙØªØ§Ø± Ù…Ø²Ø§Ø­Ù… Ø¨Ù‡ Ø°Ø®ÛŒØ±Ù‡ Ø²Ù…Ø§Ù†â€ŒØ¨Ù†Ø¯ÛŒâ€ŒØ´Ø¯Ù‡ Ù†Ø²Ø¯ÛŒÚ© Ø´Ø¯.
- Ú©Ù¾Ø´Ù† ØªØµÙˆÛŒØ±ØŒ zoom modalØŒ ØªØ´Ø®ÛŒØµ Ø®ÙˆØ¯Ú©Ø§Ø± Ú©Ù¾Ø´Ù† Ùˆ media panel Ø§ØµÙ„Ø§Ø­ Ø´Ø¯Ù†Ø¯.
- ØªØµÙ…ÛŒÙ…: media edit Ø¨Ø§ÛŒØ¯ Ø¯Ø§Ø®Ù„ Ù‡Ù…Ø§Ù† Ø¨Ù„ÙˆÚ©/Ø¨ÙˆÙ… ÛŒØ§ Ù¾Ù†Ù„ Ù…Ø±ØªØ¨Ø· Ø§Ù†Ø¬Ø§Ù… Ø´ÙˆØ¯ØŒ Ù†Ù‡ Ø¯Ø± Ù…Ø³ÛŒØ±Ù‡Ø§ÛŒ Ø¬Ø¯Ø§Ú¯Ø§Ù†Ù‡.

### 1.0.57x - Page-Based Content Engine

- Ø¨Ø±Ø§ÛŒ Ú©ØªØ§Ø¨â€ŒÙ‡Ø§ÛŒ Ø¨Ø²Ø±Ú¯ØŒ Ù„ÙˆØ¯ Ùˆ Ø°Ø®ÛŒØ±Ù‡ Ú©Ù„ Ú©ØªØ§Ø¨ Ú©Ù†Ø§Ø± Ú¯Ø°Ø§Ø´ØªÙ‡ Ø´Ø¯.
- `book_content_manifests`, `book_pages`, `book_assets`, `book_search_index` Ø§Ø¶Ø§ÙÙ‡ Ø´Ø¯Ù†Ø¯.
- Ø§ÙˆÙ„ÛŒÙ† Ù„ÙˆØ¯ 50 ØµÙØ­Ù‡ Ø§Ø³Øª Ùˆ Ø¨Ø±Ø§ÛŒ Ù¾Ø±Ø´â€ŒÙ‡Ø§ window Ø´Ø§Ù…Ù„ 10 ØµÙØ­Ù‡ Ù‚Ø¨Ù„ Ùˆ 40 ØµÙØ­Ù‡ Ø¨Ø¹Ø¯ Ú¯Ø±ÙØªÙ‡ Ù…ÛŒâ€ŒØ´ÙˆØ¯.
- Ø°Ø®ÛŒØ±Ù‡ ÙÙ‚Ø· dirty pageÙ‡Ø§ Ø±Ø§ Ù…ÛŒâ€ŒÙØ±Ø³ØªØ¯Ø› manifest ÙÙ‚Ø· Ù‡Ù†Ú¯Ø§Ù… ØªØºÛŒÛŒØ± TOC/assets/search metadata refresh Ù…ÛŒâ€ŒØ´ÙˆØ¯.
- Reader Ùˆ Editor Ø¨Ø§ÛŒØ¯ TOC Ú©Ø§Ù…Ù„ Ø±Ø§ Ø§Ø² manifest Ø¨Ø®ÙˆØ§Ù†Ù†Ø¯ØŒ Ù†Ù‡ ÙÙ‚Ø· Ø§Ø² ØµÙØ­Ù‡â€ŒÙ‡Ø§ÛŒ Ù„ÙˆØ¯ Ø´Ø¯Ù‡.

### 1.0.578 - Ù¾Ø§Ú©Ø³Ø§Ø²ÛŒ Ù…Ø±Ø¬Ø¹ Ùˆ Ø­Ø°Ù legacy

- Ø§Ø¯ÛŒØªÙˆØ± legacy (`src/pages/Edit.tsx`) Ø­Ø°Ù Ø´Ø¯.
- route Ù‚Ø¯ÛŒÙ…ÛŒ `/edit-legacy/:id` Ø­Ø°Ù Ø´Ø¯.
- Ø¯Ú©Ù…Ù‡ Â«Ø§Ø¯ÛŒØªÙˆØ± Ù‚Ø¨Ù„ÛŒÂ» Ø§Ø² Ù¾Ù†Ù„ Ù†Ø´Ø± Ø­Ø°Ù Ø´Ø¯.
- Ø³Ù†Ø¯ Ù†Ø§Ù…Ø±ØªØ¨Ø· `docs/CARDIAC_CYCLE_PLAN.md` Ø­Ø°Ù Ø´Ø¯.
- Ù…Ø³ØªÙ†Ø¯Ø§Øª Ù…Ø¹Ù…Ø§Ø±ÛŒ Ùˆ DFD/ERD/Ø§Ù…Ù†ÛŒØª Ø¨Ø± Ø§Ø³Ø§Ø³ ÙˆØ¶Ø¹ÛŒØª ÙØ¹Ù„ÛŒ Ø¨Ø§Ø²Ù†ÙˆÛŒØ³ÛŒ Ø´Ø¯Ù†Ø¯.
- Supabase client Ø¯Ø§Ø±Ø§ÛŒ retry Ù…Ø­Ø¯ÙˆØ¯ read/auth Ø§Ø³Øª ØªØ§ timeoutÙ‡Ø§ÛŒ Ù…Ø³ØªÙ‚ÛŒÙ… Ø´Ø¨Ú©Ù‡â€ŒØ§ÛŒ Ø¨Ù‡ØªØ± Ù…Ø¯ÛŒØ±ÛŒØª Ø´ÙˆØ¯ØŒ Ø¨Ø¯ÙˆÙ† retry Ø¨Ø±Ø§ÛŒ writeÙ‡Ø§ÛŒ Ø§Ø¯ÛŒØªÙˆØ±.

### 1.0.593 - ØªØ«Ø¨ÛŒØª ØµÙØ­Ù‡ Ø®Ø§Ù„ÛŒØŒ Undo Ùˆ ÙÙ‡Ø±Ø³Øª Ø§Ø¯ÛŒØªÙˆØ±

- ØªØ´Ø®ÛŒØµ ØµÙØ­Ù‡ Ø®Ø§Ù„ÛŒ Ø¯Ø± Editor V2ØŒ Reader Ùˆ renderer Ù…Ø­ØªÙˆØ§ÛŒ V2 Ø§Ø² `blocks.length` Ø¨Ù‡ Â«Ù…Ø­ØªÙˆØ§ÛŒ Ù‚Ø§Ø¨Ù„ Ù†Ù…Ø§ÛŒØ´Â» ØªØºÛŒÛŒØ± Ú©Ø±Ø¯.
- ØµÙØ­Ù‡â€ŒØ§ÛŒ Ú©Ù‡ ÙÙ‚Ø· Ù¾Ø§Ø±Ø§Ú¯Ø±Ø§Ù ÛŒØ§ heading Ø®Ø§Ù„ÛŒ Ø¯Ø§Ø±Ø¯ØŒ Ø¯Ø± Ø§Ø¯ÛŒØªÙˆØ± placeholder Ù‚Ø§Ø¨Ù„ Ú©Ù„ÛŒÚ© Ùˆ Ø¯Ø± Ú©ØªØ§Ø¨Ø®ÙˆØ§Ù† Ù¾ÛŒØ§Ù… ØµÙØ­Ù‡ Ø®Ø§Ù„ÛŒ Ù…ÛŒâ€ŒÚ¯ÛŒØ±Ø¯.
- Undo/Redo Ø¨Ø¹Ø¯ Ø§Ø² Ø¨Ø§Ø²Ú¯Ø±Ø¯Ø§Ù†ÛŒ HTMLØŒ Ù…Ø¯Ù„ `BookDocumentV2` Ø±Ø§ Ø¯ÙˆØ¨Ø§Ø±Ù‡ Ø§Ø² DOM Ù…ÛŒâ€ŒØ³Ø§Ø²Ø¯ Ùˆ ØµÙØ­Ù‡â€ŒÙ‡Ø§ÛŒ Ù„ÙˆØ¯Ø´Ø¯Ù‡ Ø±Ø§ dirty Ù…ÛŒâ€ŒÚ©Ù†Ø¯ ØªØ§ save Ø¨Ø¹Ø¯ÛŒ Ù†ØªÛŒØ¬Ù‡ Undo Ø±Ø§ Ø°Ø®ÛŒØ±Ù‡ Ú©Ù†Ø¯.
- ØªØºÛŒÛŒØ± Ù…Ø³ØªÙ‚ÛŒÙ… Ù…ØªÙ† heading Ø¯Ø± Ø¨ÙˆÙ… Ù…Ø±Ú©Ø²ÛŒ Ø³Ø±ÛŒØ¹â€ŒØªØ± Ø¨Ù‡ Ù…Ø¯Ù„ Ø³Ù†Ø¯ Ùˆ ÙÙ‡Ø±Ø³Øª Ù…Ù†ØªÙ‚Ù„ Ù…ÛŒâ€ŒØ´ÙˆØ¯.
- heading Ø¨Ø¯ÙˆÙ† Ù…ØªÙ† Ø§Ø² TOC Ø­Ø°Ù Ù…ÛŒâ€ŒØ´ÙˆØ¯ ØªØ§ Ø¬Ø§ÛŒ Ø®Ø§Ù„ÛŒ Ø¹Ù†ÙˆØ§Ù† Ø¯Ø± ÙÙ‡Ø±Ø³Øª Ø¨Ø§Ù‚ÛŒ Ù†Ù…Ø§Ù†Ø¯.

### 1.0.597 - Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ Ù†Ø³Ø®Ù‡ Ùˆ checkpoint Ø§Ø¯ÛŒØªÙˆØ±

- `APP_VERSION`ØŒ `public/version.json` Ùˆ `public/sw.js` Ø¨Ø¹Ø¯ Ø§Ø² sync Ø®ÙˆØ¯Ú©Ø§Ø± ØªØ§ 1.0.597 Ø¨Ø§Ù„Ø§ Ø±ÙØªÙ†Ø¯.
- Ø³Ù†Ø¯Ù‡Ø§ÛŒ Ù…Ø±Ø¬Ø¹ Ù…Ø¹Ù…Ø§Ø±ÛŒ Ùˆ DFD/ERD/Ø§Ù…Ù†ÛŒØª Ø¨Ø§ Ù†Ø³Ø®Ù‡ ÙˆØ§Ù‚Ø¹ÛŒ Ø³Ø§ÛŒØª Ù‡Ù…Ø§Ù‡Ù†Ú¯ Ø´Ø¯Ù†Ø¯.
- checkpoint ÙˆØ¶Ø¹ÛŒØª ÙØ¹Ù„ÛŒ Editor V2 Ø¨Ø±Ø§ÛŒ Ø§Ø¯Ø§Ù…Ù‡ Ú©Ø§Ø± Ø±ÙˆÛŒ Ø§Ø¯ÛŒØªÙˆØ± Ø«Ø¨Øª Ø´Ø¯.
- Ø§Ø² Ø§ÛŒÙ† Ù†Ø³Ø®Ù‡ Ø¨Ù‡ Ø¨Ø¹Ø¯ØŒ Ù‡Ø± Ø§ÙØ²Ø§ÛŒØ´ Ù†Ø³Ø®Ù‡ Ø¨Ø§ÛŒØ¯ Ù‡Ù…Ø±Ø§Ù‡ Ø¨Ø§ Ø¹Ù„Øª Ø¯Ø± Ù‡Ù…ÛŒÙ† ÙØ§ÛŒÙ„ Ø«Ø¨Øª Ø´ÙˆØ¯.

### 1.0.599 - Ø§Ø³ØªÙ‚Ù„Ø§Ù„ ÙÙ‡Ø±Ø³Øª Ùˆ Ø±Ø³Ø§Ù†Ù‡ Ø§Ø² window Ù¾Ù†Ø¬Ø§Ù‡ ØµÙØ­Ù‡â€ŒØ§ÛŒ Ø§Ø¯ÛŒØªÙˆØ±

- Ø´Ø±Ø· recovery ÙÙ‡Ø±Ø³Øª Ú©ØªØ§Ø¨â€ŒÙ‡Ø§ÛŒ Ø¨Ø²Ø±Ú¯ Ø§ØµÙ„Ø§Ø­ Ø´Ø¯ ØªØ§ Ù†Ø§Ù‚Øµ Ø¨ÙˆØ¯Ù† TOC ÙÙ‚Ø· Ø¨Ù‡ 50 ØµÙØ­Ù‡ Ø§ÙˆÙ„ Ù…Ø­Ø¯ÙˆØ¯ ØªØ´Ø®ÛŒØµ Ø¯Ø§Ø¯Ù‡ Ù†Ø´ÙˆØ¯.
- Ù‡Ù†Ú¯Ø§Ù… load Ø§Ø¯ÛŒØªÙˆØ±/Ú©ØªØ§Ø¨Ø®ÙˆØ§Ù†ØŒ manifest Ù…ÛŒâ€ŒØªÙˆØ§Ù†Ø¯ TOC Ùˆ `assets_summary` Ø±Ø§ Ø§Ø² Ú©Ù„ `book_pages` Ùˆ `book_assets` ØªØ±Ù…ÛŒÙ… Ú©Ù†Ø¯.
- `BookAssetV2` Ø§Ú©Ù†ÙˆÙ† `blockId` Ø±Ø§ Ù‡Ù… Ù†Ú¯Ù‡ Ù…ÛŒâ€ŒØ¯Ø§Ø±Ø¯ ØªØ§ Ù¾Ù†Ù„ Ø±Ø³Ø§Ù†Ù‡ Ø¨ØªÙˆØ§Ù†Ø¯ ØªØµÙˆÛŒØ±Ù‡Ø§ÛŒ Ø®Ø§Ø±Ø¬ Ø§Ø² window ÙØ¹Ù„ÛŒ Ø±Ø§ Ù¾ÛŒØ¯Ø§ Ú©Ù†Ø¯.
- Ú©Ù„ÛŒÚ© Ø±ÙˆÛŒ ØªØµÙˆÛŒØ±Ù‡Ø§ÛŒ Ù¾Ù†Ù„ Ø±Ø³Ø§Ù†Ù‡ ÛŒØ§ Ø§Ø±Ø¬Ø§Ø¹Ø§ØªØŒ Ø§Ú¯Ø± Ø¨Ù„ÙˆÚ© Ù‡Ù†ÙˆØ² Ù„ÙˆØ¯ Ù†Ø´Ø¯Ù‡ Ø¨Ø§Ø´Ø¯ØŒ window Ù‡Ù…Ø§Ù† ØµÙØ­Ù‡ Ø±Ø§ Ù„ÙˆØ¯ Ù…ÛŒâ€ŒÚ©Ù†Ø¯ Ùˆ Ø³Ù¾Ø³ Ø¨Ù‡ ØµÙØ­Ù‡/ØªØµÙˆÛŒØ± Ù…ÛŒâ€ŒØ±ÙˆØ¯.
- Ø°Ø®ÛŒØ±Ù‡ ØµÙØ­Ù‡â€ŒØ§ÛŒØŒ Ø®Ù„Ø§ØµÙ‡ assets ØµÙØ­Ù‡â€ŒÙ‡Ø§ÛŒ dirty Ø±Ø§ Ø¨Ø§ Ø®Ù„Ø§ØµÙ‡ Ú©Ø§Ù…Ù„ Ù‚Ø¨Ù„ÛŒ merge Ù…ÛŒâ€ŒÚ©Ù†Ø¯ ØªØ§ save ÛŒÚ© ØµÙØ­Ù‡ Ø¨Ø§Ø¹Ø« Ø­Ø°Ù Ø¯Ø§Ø±Ø§ÛŒÛŒâ€ŒÙ‡Ø§ÛŒ ØµÙØ­Ø§Øª Ø¯ÛŒÚ¯Ø± Ø§Ø² manifest Ù†Ø´ÙˆØ¯.

### 1.0.615 - Ø´Ø±ÙˆØ¹ Ø¨Ø§Ø²Ø·Ø±Ø§Ø­ÛŒ ÛŒÚ©Ù¾Ø§Ø±Ú†Ù‡ Ù¾Ù†Ù„ Ø§Ø±Ø¬Ø§Ø¹Ø§Øª

- ÙØ§ÛŒÙ„ Ù…Ø´ØªØ±Ú© `src/lib/book-references.ts` Ø¨Ø±Ø§ÛŒ ØªØ´Ø®ÛŒØµ Ù†ÙˆØ¹ Ø§Ø±Ø¬Ø§Ø¹ØŒ Ú©Ù„Ø§Ø³â€ŒÙ‡Ø§ÛŒ Ù…Ø´ØªØ±Ú©ØŒ tooltip Ùˆ preview Ø§ÛŒØ¬Ø§Ø¯ Ø´Ø¯.
- `InlineTextV2` Ùˆ HTML Ø§Ø¯ÛŒØªÙˆØ± Ø§Ø² Ù‚ÙˆØ§Ù†ÛŒÙ† Ù…Ø´ØªØ±Ú© Ø§Ø±Ø¬Ø§Ø¹Ø§Øª Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù…ÛŒâ€ŒÚ©Ù†Ù†Ø¯.
- Ù¾Ù†Ù„ Ø§Ø±Ø¬Ø§Ø¹Ø§Øª Ø§Ø¯ÛŒØªÙˆØ± Ø§Ø² Ù„ÛŒÙ†Ú© Ø³Ø§Ø¯Ù‡ Ø¨Ù‡ Ú†Ù†Ø¯ Ø¢Ú©Ø§Ø±Ø¯Ø¦ÙˆÙ† Ø¨Ø±Ø§ÛŒ Ù„ÛŒÙ†Ú© Ø®Ø§Ø±Ø¬ÛŒØŒ Ø³Ø±ÙØµÙ„ØŒ Ù¾Ø§ÙˆØ±Ù‚ÛŒØŒ Ø±ÙØ±Ù†Ø³ Ø¯Ø§Ø®Ù„ Ù…ØªÙ† Ùˆ Ø§ØªØµØ§Ù„ ØªØµÙˆÛŒØ± ØªØ¨Ø¯ÛŒÙ„ Ø´Ø¯.
- Ú©Ù„ÛŒÚ© Ø±ÙˆÛŒ Ø§Ø±Ø¬Ø§Ø¹ Ù…ÙˆØ¬ÙˆØ¯ Ø¯Ø± Ø¨ÙˆÙ… Ø§Ø¯ÛŒØªÙˆØ±ØŒ Ù¾Ù†Ù„ Ø§Ø±Ø¬Ø§Ø¹Ø§Øª Ø±Ø§ Ø¨Ø§Ø² Ù…ÛŒâ€ŒÚ©Ù†Ø¯ Ùˆ Ù‡Ù…Ø§Ù† Ø§Ø±Ø¬Ø§Ø¹ Ø±Ø§ Ø¨Ø±Ø§ÛŒ ÙˆÛŒØ±Ø§ÛŒØ´ ÙØ¹Ø§Ù„ Ù…ÛŒâ€ŒÚ©Ù†Ø¯.
- Ø§Ø¹Ù…Ø§Ù„/Ø­Ø°Ù Ø§Ø±Ø¬Ø§Ø¹ Ø§Ø² ÛŒÚ© Ù…Ø³ÛŒØ± Ù…Ø´ØªØ±Ú© Ø§Ù†Ø¬Ø§Ù… Ù…ÛŒâ€ŒØ´ÙˆØ¯ Ùˆ Ù†ØªÛŒØ¬Ù‡ Ø¯Ø± Ù‡Ù…Ø§Ù† ØµÙØ­Ù‡ dirty Ù…ÛŒâ€ŒØ´ÙˆØ¯ ØªØ§ Ø°Ø®ÛŒØ±Ù‡ ØµÙØ­Ù‡â€ŒØ§ÛŒ Ø¨Ø§Ù‚ÛŒ Ø¨Ù…Ø§Ù†Ø¯.
- Ù¾ÛŒØ´â€ŒÙ†Ù…Ø§ÛŒØ´ hover Ù„ÛŒÙ†Ú© ØªØµÙˆÛŒØ± Ø¯Ø± renderer ÙÙ‚Ø· 20 Ú©Ø§Ø±Ø§Ú©ØªØ± Ù†Ø®Ø³Øª Ú©Ù¾Ø´Ù† Ø±Ø§ Ù†Ø´Ø§Ù† Ù…ÛŒâ€ŒØ¯Ù‡Ø¯ Ùˆ Ú©Ù„ÛŒÚ© Ø±ÙˆÛŒ Ù„ÛŒÙ†Ú© ØªØµÙˆÛŒØ± Ø²ÙˆÙ… Ù‡Ù…Ø§Ù† Ø¹Ú©Ø³ Ø±Ø§ Ø¨Ø¯ÙˆÙ† Ø¬Ø§Ø¨Ù‡â€ŒØ¬Ø§ÛŒÛŒ ØµÙØ­Ù‡ Ø¨Ø§Ø² Ù…ÛŒâ€ŒÚ©Ù†Ø¯.

### 1.0.619 - Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ Ù†Ø³Ø®Ù‡ Ù¾Ø³ Ø§Ø² auto-sync Ø§Ø±Ø¬Ø§Ø¹Ø§Øª

- auto-sync Ù¾Ø³ Ø§Ø² commitÙ‡Ø§ÛŒ Ø§Ø±Ø¬Ø§Ø¹Ø§ØªØŒ `APP_VERSION`, `public/version.json` Ùˆ `public/sw.js` Ø±Ø§ ØªØ§ 1.0.619 Ø¨Ø§Ù„Ø§ Ø¨Ø±Ø¯.
- Ø§ÛŒÙ† entry ÙÙ‚Ø· Ø¨Ø±Ø§ÛŒ Ù‡Ù…Ú¯Ø§Ù… Ù†Ú¯Ù‡ Ø¯Ø§Ø´ØªÙ† Ø³Ù†Ø¯ Ø±Ø³Ù…ÛŒ Ù†Ø³Ø®Ù‡ Ø¨Ø§ Ø¹Ø¯Ø¯ ÙˆØ§Ù‚Ø¹ÛŒ Ø¨Ø±Ù†Ø§Ù…Ù‡ Ø§Ø¶Ø§ÙÙ‡ Ø´Ø¯Ø› ØªØºÛŒÛŒØ± Ø±ÙØªØ§Ø±ÛŒ Ø¬Ø¯ÛŒØ¯ÛŒ Ù†Ø³Ø¨Øª Ø¨Ù‡ 1.0.615 Ù†Ø¯Ø§Ø±Ø¯.

### 1.0.620 - Ø«Ø¨Øª Ù†Ø³Ø®Ù‡ ÙˆØ§Ù‚Ø¹ÛŒ Ù¾Ø³ Ø§Ø² Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ Ø®ÙˆØ¯Ú©Ø§Ø±

- `APP_VERSION`, `public/version.json` Ùˆ `public/sw.js` Ø¨Ù‡ 1.0.620 Ø±Ø³ÛŒØ¯Ù‡â€ŒØ§Ù†Ø¯.
- Ø§ÛŒÙ† entry Ø¨Ø±Ø§ÛŒ Ø¬Ù„ÙˆÚ¯ÛŒØ±ÛŒ Ø§Ø² Ø§Ø®ØªÙ„Ø§Ù Ø¹Ø¯Ø¯ Ù†Ø³Ø®Ù‡ Ø¨Ø±Ù†Ø§Ù…Ù‡ Ø¨Ø§ Ø³Ù†Ø¯ Ø±Ø³Ù…ÛŒ Ø§Ø¶Ø§ÙÙ‡ Ø´Ø¯Ø› ØªØºÛŒÛŒØ± Ø±ÙØªØ§Ø±ÛŒ Ø¬Ø¯ÛŒØ¯ÛŒ Ù†Ø³Ø¨Øª Ø¨Ù‡ Ø§ØµÙ„Ø§Ø­Ø§Øª Ù…Ø³ØªÙ‚Ù„â€ŒØ³Ø§Ø²ÛŒ ÙÙ‡Ø±Ø³Øª/Ø±Ø³Ø§Ù†Ù‡ Ùˆ Ù¾Ù†Ù„ Ø§Ø±Ø¬Ø§Ø¹Ø§Øª Ù†Ø¯Ø§Ø±Ø¯.

### 1.0.630 - ØªÚ©Ù…ÛŒÙ„ Ù…Ø±Ø­Ù„Ù‡ Ø§ÙˆÙ„ Ù¾Ù†Ù„ Ø§Ø±Ø¬Ø§Ø¹Ø§Øª

- Ù¾Ù†Ù„ Ø§Ø±Ø¬Ø§Ø¹Ø§Øª Ø§Ø² Ù„ÛŒØ³Øª read-only Ø¨Ù‡ Ù…Ø³ÛŒØ± Ù‚Ø§Ø¨Ù„ ÙˆÛŒØ±Ø§ÛŒØ´ Ù†Ø²Ø¯ÛŒÚ©â€ŒØªØ± Ø´Ø¯: Ø¢ÛŒØªÙ…â€ŒÙ‡Ø§ÛŒ Ù…ÙˆØ¬ÙˆØ¯ Ø¯Ø± Ù„ÛŒØ³Øª Ø§Ø±Ø¬Ø§Ø¹Ø§Øª Ù…ÛŒâ€ŒØªÙˆØ§Ù†Ù†Ø¯ Ù‡Ù…Ø§Ù† Ø§Ø±Ø¬Ø§Ø¹ Ø±Ø§ Ø¯Ø± Ø¨ÙˆÙ… Ù…Ø±Ú©Ø²ÛŒ Ù¾ÛŒØ¯Ø§ Ùˆ ÙØ¹Ø§Ù„ Ú©Ù†Ù†Ø¯.
- Ø¨Ø§ Ø§Ù†ØªØ®Ø§Ø¨ ÛŒÚ© Ø§Ø±Ø¬Ø§Ø¹ Ù…ÙˆØ¬ÙˆØ¯ØŒ ÙØ±Ù… Ù‡Ù…Ø§Ù† Ù†ÙˆØ¹ Ø§Ø±Ø¬Ø§Ø¹ Ø¯Ø± Ù¾Ù†Ù„ Ø¨Ø§Ù„Ø§ Ù¾Ø± Ù…ÛŒâ€ŒØ´ÙˆØ¯ Ùˆ Ø§Ø¹Ù…Ø§Ù„/Ø­Ø°Ù Ø§Ø² Ù‡Ù…Ø§Ù† Ù…Ø³ÛŒØ± Ù…Ø´ØªØ±Ú© `replaceOrWrapReferenceSelection` Ùˆ `removeReferenceFromSelection` Ø§Ù†Ø¬Ø§Ù… Ù…ÛŒâ€ŒØ´ÙˆØ¯.
- Ù†ÙˆØ§Ø± Ø§Ø¨Ø²Ø§Ø± Ù…ØªÙ† Ø¨Ø§ Ø¯Ú©Ù…Ù‡ Ù„ÛŒÙ†Ú© Ù‡Ù…Ú†Ù†Ø§Ù† ÙÙ‚Ø· ØªØ¨ Ø§Ø±Ø¬Ø§Ø¹Ø§Øª Ø±Ø§ Ø¨Ø§Ø² Ù…ÛŒâ€ŒÚ©Ù†Ø¯ Ùˆ Ù…Ù†Ø·Ù‚ Ù„ÛŒÙ†Ú©/Ù¾Ø§ÙˆØ±Ù‚ÛŒ/Ø±ÙØ±Ù†Ø³/ØªØµÙˆÛŒØ± Ø¯Ø± Ù‡Ù…Ø§Ù† Ù¾Ù†Ù„ Ø³Ù…Øª Ø±Ø§Ø³Øª Ù…ØªÙ…Ø±Ú©Ø² Ù…ÛŒâ€ŒÙ…Ø§Ù†Ø¯.

### 1.0.647 - Ø³Ø§Ø¯Ù‡â€ŒØ³Ø§Ø²ÛŒ ÙˆÛŒØ±Ø§ÛŒØ´ Ø§Ø±Ø¬Ø§Ø¹Ø§Øª

- Ø¬Ø³ØªØ¬ÙˆÛŒ Ø§Ø±Ø¬Ø§Ø¹Ø§Øª Ø¨Ù‡ Ø§Ø¨ØªØ¯Ø§ÛŒ Ù¾Ù†Ù„ Ø§Ø±Ø¬Ø§Ø¹Ø§Øª Ù…Ù†ØªÙ‚Ù„ Ø´Ø¯ Ùˆ Ù†ØªÛŒØ¬Ù‡â€ŒÙ‡Ø§ÛŒ Ø¬Ø³ØªØ¬Ùˆ Ù…Ù†Ø¨Ø¹ Ø§Ù†ØªØ®Ø§Ø¨/ÙˆÛŒØ±Ø§ÛŒØ´/Ø­Ø°Ù Ø³Ø±ÛŒØ¹ Ø´Ø¯Ù†Ø¯.
- Ø§Ø³Ú©Ø±ÙˆÙ„ Ø®ÙˆØ¯Ú©Ø§Ø± Ù¾Ù†Ù„ Ø¨Ù‡ Ø¨Ø®Ø´ Â«Ø§ØªØµØ§Ù„ Ù…ØªÙ† Ø¨Ù‡ ØªØµÙˆÛŒØ±Â» Ù‡Ù†Ú¯Ø§Ù… Ø§Ù†ØªØ®Ø§Ø¨ Ù…ØªÙ† Ø­Ø°Ù Ø´Ø¯.
- Ø¢Ú©Ø§Ø±Ø¯Ø¦ÙˆÙ†â€ŒÙ‡Ø§ÛŒ Ù¾Ù†Ù„ Ø§Ø±Ø¬Ø§Ø¹Ø§Øª ØªÚ©â€ŒØ­Ø§Ù„ØªÙ‡ Ø´Ø¯Ù†Ø¯ ØªØ§ ÙÙ‚Ø· ÛŒÚ© Ø¨Ø®Ø´ Ø¨Ø§Ø² Ø¨Ù…Ø§Ù†Ø¯.
- Ù„ÛŒÙ†Ú© Ø¯Ø§Ø®Ù„ÛŒ Ø³Ø±ÙØµÙ„â€ŒÙ‡Ø§ Ø¨Ø§ `href="#anchor"` Ø°Ø®ÛŒØ±Ù‡ Ù…ÛŒâ€ŒØ´ÙˆØ¯ ØªØ§ Ø¨Ù‡ URL Ú©Ø§Ù…Ù„ ØªØ¨Ø¯ÛŒÙ„ Ù†Ø´ÙˆØ¯.
- Ø§Ø±Ø¬Ø§Ø¹ ØªØµÙˆÛŒØ±ÛŒ Ø¯Ø± Ú©ØªØ§Ø¨Ø®ÙˆØ§Ù† Ø¯Ø± ØµÙˆØ±Øª Ù†Ø¨ÙˆØ¯Ù† Ø¨Ù„ÙˆÚ© ØªØµÙˆÛŒØ± Ø¯Ø± window ÙØ¹Ù„ÛŒØŒ Ø§Ø² `document.assets` Ø¨Ø±Ø§ÛŒ Ù¾ÛŒØ´â€ŒÙ†Ù…Ø§ÛŒØ´ Ùˆ Ø²ÙˆÙ… ØªØµÙˆÛŒØ± Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù…ÛŒâ€ŒÚ©Ù†Ø¯.

### 1.0.656 - Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ Ù†Ø³Ø®Ù‡ Ù¾Ø³ Ø§Ø² Ø§ØµÙ„Ø§Ø­ Ù¾Ù†Ù„ Ø§Ø±Ø¬Ø§Ø¹Ø§Øª

- auto-sync Ù¾Ø³ Ø§Ø² buildØŒ ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ÛŒ Ù†Ø³Ø®Ù‡ Ø±Ø§ ØªØ§ 1.0.656 Ø¨Ø§Ù„Ø§ Ø¨Ø±Ø¯.
- ØªØºÛŒÛŒØ± Ø±ÙØªØ§Ø±ÛŒ Ø¬Ø¯ÛŒØ¯ÛŒ Ù†Ø³Ø¨Øª Ø¨Ù‡ 1.0.647 Ù†Ø¯Ø§Ø±Ø¯ Ùˆ ÙÙ‚Ø· Ø³Ù†Ø¯ Ø±Ø³Ù…ÛŒ Ø±Ø§ Ø¨Ø§ Ø¹Ø¯Ø¯ ÙˆØ§Ù‚Ø¹ÛŒ Ø¨Ø±Ù†Ø§Ù…Ù‡ Ù‡Ù…Ú¯Ø§Ù… Ù…ÛŒâ€ŒÚ©Ù†Ø¯.

## ØªØµÙ…ÛŒÙ…â€ŒÙ‡Ø§ÛŒ Ù…Ø¹Ù…Ø§Ø±ÛŒ Ú©Ù‡ Ù†Ø¨Ø§ÛŒØ¯ Ù†Ø§Ø¯ÛŒØ¯Ù‡ Ú¯Ø±ÙØªÙ‡ Ø´ÙˆÙ†Ø¯

### ÙÙ‚Ø· ÛŒÚ© Ø§Ø¯ÛŒØªÙˆØ±

Ù‡Ø± Ù‚Ø§Ø¨Ù„ÛŒØª Ø¬Ø¯ÛŒØ¯ Ø¨Ø§ÛŒØ¯ Ø¯Ø± `src/features/editor-v2/EditorV2Page.tsx` Ùˆ Ù…Ø¯Ù„ Ù…Ø´ØªØ±Ú© V2 Ø§Ø¶Ø§ÙÙ‡ Ø´ÙˆØ¯. Ø§ÛŒØ¬Ø§Ø¯ editor Ù…ÙˆØ§Ø²ÛŒ ÛŒØ§ route legacy Ø¬Ø¯ÛŒØ¯ Ù…Ù…Ù†ÙˆØ¹ Ø§Ø³Øª Ù…Ú¯Ø± Ø¨Ø§ ØªØµÙ…ÛŒÙ… Ù…Ø¹Ù…Ø§Ø±ÛŒ Ø«Ø¨Øªâ€ŒØ´Ø¯Ù‡.

### ÙÙ‚Ø· ÛŒÚ© renderer Ù…Ø­ØªÙˆØ§ÛŒÛŒ

Ø§Ú¯Ø± Ù…ØªÙ† Ø¯Ø± reader Ø¯Ø±Ø³Øª Ø§Ø³Øª ÙˆÙ„ÛŒ Ø¯Ø± editor ÛŒØ§ preview Ø®Ø±Ø§Ø¨ Ø§Ø³ØªØŒ Ù…Ø´Ú©Ù„ Ø±Ø§ Ø¨Ø§ patch Ù…Ø­Ù„ÛŒ Ø­Ù„ Ù†Ú©Ù†ÛŒØ¯. Ø§Ø¨ØªØ¯Ø§ `book-content.ts`, `book-document-v2/normalize.ts`, `BookContentBlocks.tsx` Ùˆ schema Ø±Ø§ Ø¨Ø±Ø±Ø³ÛŒ Ú©Ù†ÛŒØ¯.

### TOC Ù…Ø³ØªÙ‚Ù„ Ø§Ø² window Ù„ÙˆØ¯ Ø´Ø¯Ù‡

TOC Ø¨Ø§ÛŒØ¯ Ø§Ø² manifest Ú©Ø§Ù…Ù„ Ø®ÙˆØ§Ù†Ø¯Ù‡ Ø´ÙˆØ¯. window ÙØ¹Ù„ÛŒ editor/reader ÙÙ‚Ø· Ø¨Ø±Ø§ÛŒ Ù…ØªÙ† ØµÙØ­Ù‡ Ø§Ø³ØªØŒ Ù†Ù‡ Ø³Ø§Ø®Øª ÙÙ‡Ø±Ø³Øª Ú©Ø§Ù…Ù„ Ú©ØªØ§Ø¨.

### Ø°Ø®ÛŒØ±Ù‡ ØµÙØ­Ù‡â€ŒØ§ÛŒ

Ø¨Ø±Ø§ÛŒ ØªØºÛŒÛŒØ± ÛŒÚ© ØµÙØ­Ù‡ØŒ Ú©Ù„ Ú©ØªØ§Ø¨ Ù†Ø¨Ø§ÛŒØ¯ Ø§Ø±Ø³Ø§Ù„ Ø´ÙˆØ¯. Ø§Ú¯Ø± ÙˆÛŒÚ˜Ú¯ÛŒ Ø¬Ø¯ÛŒØ¯ÛŒ Ú©Ù„ Ú©ØªØ§Ø¨ Ø±Ø§ Ø¨Ø§Ø²Ù†ÙˆÛŒØ³ÛŒ Ù…ÛŒâ€ŒÚ©Ù†Ø¯ØŒ Ù‚Ø¨Ù„ Ø§Ø² merge Ø¨Ø§ÛŒØ¯ Ø¯Ù„ÛŒÙ„Ø´ Ø¯Ø± Ø§ÛŒÙ† ÙØ§ÛŒÙ„ Ø«Ø¨Øª Ø´ÙˆØ¯.

### Ø§Ù…Ù†ÛŒØª Ù†Ø´Ø±

Ú©ØªØ§Ø¨ draft Ø¯Ø§Ø±Ø§ÛŒÛŒ Ù†Ø§Ø´Ø± Ø§Ø³Øª. Admin Ù…ÛŒâ€ŒØªÙˆØ§Ù†Ø¯ ÙˆØ¶Ø¹ÛŒØª Ø±Ø§ Ø¨Ø¨ÛŒÙ†Ø¯ØŒ Ø§Ù…Ø§ Ù…Ø³ÛŒØ± ÙˆÛŒØ±Ø§ÛŒØ´ draft Ù†Ø§Ø´Ø± Ø¯ÛŒÚ¯Ø± Ù†Ø¨Ø§ÛŒØ¯ Ø§Ø² Ù¾Ù†Ù„ Ù†Ø´Ø± admin Ø¯Ø± Ø¯Ø³ØªØ±Ø³ Ø¨Ø§Ø´Ø¯.
