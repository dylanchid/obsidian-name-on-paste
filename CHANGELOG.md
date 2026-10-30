# Changelog

## 0.5.0 — 2026-09-01

- Replace the blocking modal for intercepted paste/drop with a compact bottom-right rename card.
- Save and insert intercepted images immediately so dismissing or ignoring the card keeps the image and generated name.
- Automatically dismiss an untouched card after 12 seconds; interacting with it keeps it open.
- Add safe post-insertion renaming for image files and optional companion notes.
- Keep the full naming, folder, and tags modal for explicit detailed-paste commands.

## 0.4.0 — 2026-09-01

- Route external raster-image drops on Canvas through the detailed naming modal.
- Support dragging macOS's floating screenshot thumbnail directly into Canvas.
- Preserve the Canvas drop point while the naming modal is open.
- Leave internal vault-file drags and unsupported external files to Obsidian.

## 0.3.0 — 2026-09-01

- Add detailed, quick, and image-plus-note paste commands.
- Add safe naming, collision handling, folder creation, and live path preview.
- Add optional tagged companion notes and Markdown insertion.
- Add guarded Canvas image and note placement with aspect-ratio preservation.
- Add experimental native paste interception behind an off-by-default setting.
- Add automated tests, continuous integration, and Community plugin release metadata.
