# Contributing

Use a disposable Obsidian vault for development and test with ordinary Canvas and Markdown files. Before opening a pull request, run:

```bash
npm ci
npm run check
```

Changes to Canvas integration must retain runtime capability checks and must not write directly to an open `.canvas` file. Changes to native paste must preserve the rule that Obsidian's paste is prevented only after both a supported image and compatible destination are confirmed.
