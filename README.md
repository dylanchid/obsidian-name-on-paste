# Name on Paste

Name on Paste gives clipboard images a meaningful filename, a deliberate vault location, and optional metadata before placing them in Obsidian Canvas or Markdown.

> [!WARNING]
> Native paste and external image-drop interception are experimental and disabled by default. The command-based workflows are the stable foundation.

## Features

- Name an image and choose its folder before any file is written.
- Paste quickly with a generated, date-sortable filename.
- Create an optional same-named Markdown companion note with tags and an image embed.
- Add images beside the current Canvas selection or at the viewport center.
- Drag an external raster image—including macOS's floating screenshot thumbnail—onto Canvas and place it at the drop point.
- Keep working after an intercepted paste or drop: the image appears immediately and a compact bottom-right card offers an optional rename before dismissing itself.
- Insert an image embed at the cursor when a Markdown note is active.
- Preserve PNG, JPEG, WebP, and GIF clipboard data and avoid silent overwrites.
- Keep every saved artifact usable when the plugin is disabled or removed.

When the clipboard contains several representations or images, the plugin uses the first clipboard item with a supported raster image, preferring PNG, WebP, JPEG, then GIF representations.

## Commands

| Command | Default hotkey | Behavior |
| --- | --- | --- |
| Paste image with details | `Cmd/Ctrl+Shift+V` | Opens the full naming, folder, and tags modal, then saves and inserts the image. |
| Paste image quickly | Unassigned | Saves immediately with the configured defaults. |
| Paste image as image + note | Unassigned | Creates the image and companion note, then adds both to Canvas when active. |

Hotkeys can be changed in Obsidian's **Hotkeys** settings.

## Settings

- **Default image folder:** destination for quick paste and the default detailed-paste folder.
- **Paste behavior:** show the ambient rename prompt everywhere, only in Canvas, or paste immediately when experimental interception is enabled.
- **Remember last folder:** starts the next details modal in the latest destination.
- **Date prefix:** adds `YYYY-MM-DD` to the front of saved filenames.
- **Default image name:** supports `{{date}}` and `{{time}}` placeholders.
- **Companion-note options:** control automatic notes, tag-triggered notes, and Canvas placement.
- **Native Canvas paste and drop interception:** enables the experimental enhancement for pasted images and external image files dropped onto Canvas.

## Development

Use a disposable development vault rather than a primary vault.

```bash
npm ci
npm run dev
```

Copy or symlink `main.js`, `manifest.json`, and `styles.css` into:

```text
<development-vault>/.obsidian/plugins/name-on-paste/
```

Run all automated checks with:

```bash
npm run check
```

The Canvas adapter intentionally isolates the undocumented live Canvas interface. Unsupported or read-only Canvas views are never intercepted by native paste or external drops, and a command that saves successfully but cannot insert reports the retained file path. Internal vault-file drags remain under Obsidian's control.

## Privacy

Name on Paste performs all work locally. It sends no clipboard contents, image data, filenames, settings, or usage analytics over the network.

## Compatibility

- Obsidian 1.7.2 or newer
- macOS, Windows, and Linux desktop applications
- Mobile is not supported in the current release

## License

[MIT](LICENSE)
