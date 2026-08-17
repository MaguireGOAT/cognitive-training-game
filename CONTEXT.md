# Cognitive Training PWA - Current Change Context

Updated: 2026-08-17

## Project

- Offline-ready cognitive-training PWA for elderly users.
- Target surfaces: iPhone landscape, iPad, laptop desktop, and casting to TV.
- Current visual system uses a 1280x800 reference canvas, `--ui-scale`, fixed grids, landscape-only layout, and 44px minimum touch sizes.
- There is already an uncommitted universal-scaling refactor in the working tree. Do not overwrite it.
- `AGENTS.md` is untracked and must stay excluded from commits.
- Do not push without explicit user permission.

## User Decision For This Pass

The user asked to standardise everything after documenting this context. Approved directions:

1. Shopping instruction: first line is exactly `記住清單準備好後按`; second line is `「開始揀選」`.
2. Hamburger button in game screens: keep circular and use the same height as the buttons beside it.
3. Top-bar question/rules text: make it truly centered. User confirms there is enough space on iPhone, so text overflow is not expected.
4. Save button text: use the same text size as the buttons on the top row.
5. Food game question: keep the full `哪一個是 <category>？` text instead of replacing it with only the category.
6. Message boxes: selected option B. Remove the next-question button where it conflicts, and let clicking outside the message box advance the flow. Add protection against accidental rapid double-advance.
7. Speed control: same height as the play button.
8. Shopping order-mode image: use the same available-area image sizing as other games. Standardise every image section in the app.
9. Home subtitle: change `選擇一個遊戲或活動開始` to `選擇一個遊戲`.
10. Shopping memorisation images:
    - Maximise 3 and 4 images the same way as other games.
    - For 5 images, center the two bottom-row images.
    - Standardise all image parts across games.
11. Reality orientation is abbreviated as RO in future notes.

## Latest Decisions (2026-08-16)

- Feedback presentation: selected option A. Correct/wrong answers use one shared inline floating pill; instruction, completion, settings, and other explanatory boxes use the centered message box.
- Current correct/wrong feedback is fragmented across shopping, Go/No Go, N-back, Different, Dual N-back, and palm. The practical split is necessary, but the visual split is not; all games should use the shared floating-pill style.
- Image sizing audit: column/row count, name visibility, and count-specific layout differences are necessary; inconsistent max sizes, per-game height formulas, separate card sizing rules, and shopping order mode using a different available-area formula are not necessary.
- Speed control: user chose preview option A. Buttons are solid round `＋／－` icons with no border, the numeric indicator remains, and seconds are not shown. Applied to N-back, Dual N-back, Go/No Go, and palm.

## Latest Decisions (2026-08-17)

- Image sizing now uses one shared grid-card formula in `css/shared.css`, driven by live `--stage-h`, real column/row counts, gaps, and name track.
- Per-game image-grid caps in Go/No Go, Find Different, Shopping, Food, and Dual N-back were removed or consolidated; the root-level `1200px` cap remains as a general ceiling.
- Final image-sizing pass removed the remaining extra width deductions in Go/No Go and Dual N-back, the `850px` card caps, the Shopping `1500px` panel cap, and the Shopping `10px` extra stage height.
- Single- and two-card layouts reserve `24px * var(--ui-scale)` at the bottom of the shared card formula so card shadows are not clipped by the stage.
- Verified at 1280x800: food, Go/No Go, Find Different, and Shopping images shrink as item count increases; 5/6 item two-row layouts stay centered inside the stage.

## Implementation Notes

### Top bar

- Most game screens share `.top-bar`, but there are page-specific overrides for wrapped state, food question text, palm game, reality edit button, and varying right-side controls.
- `syncTopBarCentering()` only compensates in some states; the question/rules text is not guaranteed to be centered on the viewport.
- Hamburger height override in `.top-bar .right-group` can make the button shorter than its width, so it renders oval instead of circular.

### Bottom controls

- Go/No Go, N-back, Dual N-back, and palm each define bottom controls.
- Speed control and play button heights are not consistently the same.
- Palm has its own scoped overrides loaded after the shared styles.

### Image/card sizing

- All single-card/grid image surfaces now share one `--grid-card` formula: N-back single, Dual N-back grid/card, Go/No Go, Find Different, Shopping list/recall/order, and Food.
- Removed extra `24px` width deductions from Go/No Go and Dual N-back grids.
- Removed per-game `850px` caps from N-back, Dual N-back, and Shopping order mode.
- Removed the Shopping list `1500px` width cap and `10px` extra stage height.
- Kept per-game column/row counts, gaps, name tracks, and the root-level `1200px` cap.

## Standardisation Target

- Introduce shared sizing variables for top bar height, bottom control height, control height, and game-stage available height.
- Keep only necessary per-game differences, such as number of columns/rows, gaps, and maximum card size.
- Use one square image/card model: fit the image inside a square based on available width and height, with `object-fit: contain`.
- Preserve safe-area insets, landscape-only behavior, 44px touch minimums, and dark mode.

## Risks And Cautions

- Standardising more than the 11 listed items touches shared CSS, so existing screens may shift slightly.
- Need to guard against overflow on narrow iPhone screens even though the user confirmed the top-bar text can fit.
- Message-box outside-tap advancement can accidentally skip questions; use a short guard or explicit flow check to prevent double-advance.
- After editing, run light checks: JavaScript syntax checks, `git diff --check`, and `npm run build:sw` when service-worker relevant files change.
- Do not remove or overwrite unrelated user changes.

## Status

- All 11 approved changes are implemented in the working tree.
- Shared standardisation for top bar, bottom controls, and image/card sizing is applied.
- `sw.js` is regenerated after the changes.
- Changes are not committed or pushed; the user should test first.
