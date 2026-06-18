# Editor Toolbar Redesign Plan

## Goal

Build a stable, extensible editor toolbar that lets publishers create and edit rich web books without writing code. The toolbar must expose text, structure, media, interactive content, review, and AI-assisted authoring tools in a clean UI that works on desktop and mobile.

## Core Principles

- Tools are grouped by user intent, not by implementation detail.
- Every tool must be discoverable through an icon, tooltip, and when needed a menu or modal.
- Toolbar menus must never be clipped by toolbar overflow.
- Text direction controls are separate from text alignment controls.
- Rich content rendering rules must continue to use `src/lib/book-content.ts` as the reference layer.
- Interactive blocks must be editable in-place or through a structured modal, not through raw prompt dialogs in the final design.
- Adding a future tool should not require rewriting the toolbar layout.

## Toolbar Groups

### History

- Undo
- Redo
- Save status remains in the editor header, not inside the editing toolbar.

### Structure

- Heading menu: Normal, H1, H2, H3, H4, H5, H6
- Create heading from selected text
- Add selected heading to TOC
- Page break
- Printed page marker display must follow `book-content.ts`

### Text Formatting

- Bold
- Italic
- Underline
- Strike
- Superscript
- Subscript
- Link
- Font family
- Font size
- Text color

### Typography Presets

The typography menu must show categories and visual previews:

- Book structure: lead text, summary, aside
- Educational: note, definition, example, warning/exercise in later phase
- Literary/reference: quote, poetry, dialogue in later phase
- Reset: normal paragraph

Each preset should have:

- icon
- label
- visual preview
- semantic value applied to the paragraph/heading

### Direction And Alignment

- Direction:
  - RTL paragraph direction
  - LTR paragraph direction
- Alignment:
  - align right
  - align center
  - align left
  - justify

Direction icons must be visually different from alignment icons.

### Lists

- Bullet list
- Numbered list
- Increase indent
- Decrease indent
- Later: list style picker

### Media

- Insert image from local file
- Pick image from extracted book images
- Replace failed imported image
- Set image width presets
- Align image left/center/right/full width
- Edit caption
- Mark image role:
  - inline image
  - book figure
  - page background
  - interactive block image
- Gallery builder
- Image quality warning

### Tables

- Insert table
- Add row
- Add column
- Delete row
- Delete column
- Delete table
- Later: table style presets and header row toggles

### Interactive Blocks

The interactive menu must provide structured creation and editing:

- Flashcards
- Simple quiz
- Timeline
- Steps/process
- Scrollytelling
- Gallery
- Hotspot image

Each interactive block needs:

- insert action
- edit selected block
- media picker support
- preview in editor
- inline edit affordance

### AI Assist

Later phase:

- Convert selection to quiz
- Convert selection to flashcards
- Summarize selection
- Create timeline from process text
- Generate glossary terms
- Suggest headings
- Suggest image captions

AI actions must use the existing secure gateway and credit rules.

### Review

Later phase:

- Missing image captions
- Failed images
- Broken links
- Missing TOC anchors
- Footnotes/citations check
- ZWS/ZWNJ warnings
- Printed page numbering check

## Technical Architecture

### Phase 1: Stable Toolbar UI

- Fix menu clipping.
- Group tools into visually distinct toolbar groups.
- Replace raw H buttons with a stable H1-H6 menu.
- Replace raw typography select with a grouped visual menu.
- Use compact icon-only buttons with tooltips.
- Create clear RTL/LTR icons that are not alignment icons.

### Phase 2: Tool Registry

Create `src/lib/editor-tools.ts` with:

- tool id
- group
- label
- icon
- action
- active state
- disabled state
- menu component or modal trigger

The toolbar should eventually render from this registry.

### Phase 3: Media Panel

- Build a real media picker modal/panel.
- List extracted book images with captions and printed page numbers.
- Show failed images with replacement actions.
- Allow insert, replace, caption edit, and role selection.

### Phase 4: Interactive Builder

- Replace prompt-based editing with structured forms.
- Each interactive block gets a modal editor.
- Image selection should use the media panel.
- Blocks are editable after insertion.

### Phase 5: AI Assist Integration

- Add AI actions to convert selected content into structured blocks.
- Show credit estimate before running.
- Store outputs and usage.

### Phase 6: Mobile Toolbar

- Convert toolbar groups into a bottom sheet or tabbed command palette.
- Keep editor content visible.
- Avoid horizontal overflow-heavy controls on mobile.

## Acceptance Criteria

- H menu opens reliably and applies H1-H6.
- Typography menu opens reliably and applies semantic styles.
- Direction buttons apply `dir=rtl` or `dir=ltr` and are visually distinct from alignment.
- Toolbar menus are not clipped.
- Toolbar remains usable on desktop and mobile.
- No content rendering rule is duplicated outside `book-content.ts` when it belongs there.
- Build passes after every phase.

