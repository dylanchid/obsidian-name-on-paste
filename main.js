"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => NameOnPastePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/canvas-adapter.ts
var import_obsidian = require("obsidian");
var CanvasAdapter = class {
  constructor(app) {
    this.app = app;
  }
  isActive() {
    return this.getActiveCanvas() !== null;
  }
  canInsert() {
    const canvas = this.getActiveCanvas();
    return Boolean(
      canvas && !canvas.readonly && canvas.createFileNode && canvas.getViewportBBox
    );
  }
  containsTarget(target) {
    const view = this.getActiveCanvasView();
    return Boolean(view && target instanceof Node && view.containerEl.contains(target));
  }
  async insert(imageFile, image, noteFile, addNote, dropPlacement) {
    const canvas = this.getActiveCanvas();
    if (!canvas) return { inserted: false, reason: "No Canvas is active." };
    if (canvas.readonly) return { inserted: false, reason: "The active Canvas is read-only." };
    if (!canvas.createFileNode || !canvas.getViewportBBox) {
      return { inserted: false, reason: "This Obsidian version does not expose compatible Canvas controls." };
    }
    const imageSize = fitLongestEdge(image.width, image.height, 400);
    const imagePosition = this.getImagePosition(canvas, imageSize, dropPlacement);
    canvas.createFileNode({ pos: imagePosition, size: imageSize, file: imageFile });
    try {
      if (noteFile && addNote) {
        canvas.createFileNode({
          pos: { x: imagePosition.x + imageSize.width + 40, y: imagePosition.y },
          size: { width: 320, height: 240 },
          file: noteFile
        });
      }
    } finally {
      canvas.requestSave?.();
    }
    return { inserted: true };
  }
  getActiveCanvas() {
    return this.getActiveCanvasView()?.canvas ?? null;
  }
  getActiveCanvasView() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian.ItemView);
    if (!view || view.getViewType() !== "canvas") return null;
    return view;
  }
  getImagePosition(canvas, size, dropPlacement) {
    if (dropPlacement && canvas.posFromClient) {
      const position = canvas.posFromClient({ x: dropPlacement.clientX, y: dropPlacement.clientY });
      return { x: position.x - size.width / 2, y: position.y - size.height / 2 };
    }
    const boxes = [...canvas.selection ?? []].map((element) => element.getBBox?.()).filter((box) => Boolean(box));
    if (boxes.length > 0) {
      const bounds = combineBoxes(boxes);
      return {
        x: bounds.maxX + 40,
        y: (bounds.minY + bounds.maxY - size.height) / 2
      };
    }
    const viewport = canvas.getViewportBBox();
    return {
      x: (viewport.minX + viewport.maxX - size.width) / 2,
      y: (viewport.minY + viewport.maxY - size.height) / 2
    };
  }
};
function fitLongestEdge(width, height, longestEdge) {
  if (width <= 0 || height <= 0) return { width: longestEdge, height: longestEdge };
  const scale = longestEdge / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}
function combineBoxes(boxes) {
  return boxes.reduce(
    (combined, box) => ({
      minX: Math.min(combined.minX, box.minX),
      minY: Math.min(combined.minY, box.minY),
      maxX: Math.max(combined.maxX, box.maxX),
      maxY: Math.max(combined.maxY, box.maxY)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

// src/clipboard.ts
var MIME_PRIORITY = ["image/png", "image/webp", "image/jpeg", "image/gif"];
var EXTENSIONS = {
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/gif": "gif"
};
var IMAGE_FILE_EXTENSIONS = /* @__PURE__ */ new Set(["png", "webp", "jpg", "jpeg", "gif"]);
function sortImageTypes(types) {
  return [...types].filter((type) => type.startsWith("image/")).sort((left, right) => {
    const leftIndex = MIME_PRIORITY.indexOf(left);
    const rightIndex = MIME_PRIORITY.indexOf(right);
    return (leftIndex < 0 ? MIME_PRIORITY.length : leftIndex) - (rightIndex < 0 ? MIME_PRIORITY.length : rightIndex);
  });
}
function findImageBlob(event) {
  const items = event.clipboardData?.items;
  if (!items) return null;
  const candidates = Array.from(items).filter((item) => item.kind === "file" && item.type.startsWith("image/")).sort((left, right) => {
    const leftIndex = MIME_PRIORITY.indexOf(left.type);
    const rightIndex = MIME_PRIORITY.indexOf(right.type);
    return (leftIndex < 0 ? MIME_PRIORITY.length : leftIndex) - (rightIndex < 0 ? MIME_PRIORITY.length : rightIndex);
  });
  return candidates[0]?.getAsFile() ?? null;
}
function hasDroppedImage(event) {
  const transfer = event.dataTransfer;
  if (!transfer) return false;
  if (Array.from(transfer.items).some((item) => item.kind === "file" && item.type.startsWith("image/"))) {
    return true;
  }
  return Array.from(transfer.files).some(isSupportedImageFile);
}
function findDroppedImage(event) {
  const transfer = event.dataTransfer;
  if (!transfer) return null;
  const file = Array.from(transfer.files).find(isSupportedImageFile);
  if (file) return file;
  return Array.from(transfer.items).filter((item) => item.kind === "file").map((item) => item.getAsFile()).find((item) => Boolean(item && isSupportedImageFile(item))) ?? null;
}
function isSupportedImageFile(file) {
  if (file.type.startsWith("image/")) return Boolean(EXTENSIONS[file.type]);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return !file.type && IMAGE_FILE_EXTENSIONS.has(extension);
}
async function readClipboardImage() {
  if (!navigator.clipboard?.read) {
    throw new Error("This system does not provide image clipboard access.");
  }
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = sortImageTypes(item.types)[0];
    if (!type) continue;
    return clipboardImageFromBlob(await item.getType(type));
  }
  return null;
}
async function clipboardImageFromBlob(blob) {
  const supportedExtension = EXTENSIONS[blob.type];
  const normalizedBlob = supportedExtension ? blob : await convertToPng(blob);
  const dimensions = await readDimensions(normalizedBlob);
  return {
    bytes: await normalizedBlob.arrayBuffer(),
    mimeType: normalizedBlob.type,
    extension: EXTENSIONS[normalizedBlob.type] ?? "png",
    width: dimensions.width,
    height: dimensions.height
  };
}
async function readDimensions(blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
async function convertToPng(blob) {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this clipboard image.");
    context.drawImage(bitmap, 0, 0);
    const result = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!result) throw new Error("Could not convert this clipboard image to PNG.");
    return result;
  } finally {
    bitmap.close();
  }
}

// src/file-service.ts
var import_obsidian2 = require("obsidian");

// src/naming.ts
var DEFAULT_NAME_TEMPLATE = "Screenshot \u2014 {{time}}";
var WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
var FORBIDDEN_FILENAME_CHARACTERS = new RegExp('[<>:"/\\\\|?*\\u0000-\\u001f\\[\\]]', "g");
function pad(value) {
  return String(value).padStart(2, "0");
}
function getLocalDateParts(date = /* @__PURE__ */ new Date()) {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}.${pad(date.getMinutes())}`
  };
}
function renderNameTemplate(template, date = /* @__PURE__ */ new Date()) {
  const parts = getLocalDateParts(date);
  return template.replaceAll("{{date}}", parts.date).replaceAll("{{time}}", parts.time);
}
function sanitizeDisplayName(input) {
  let name = input.trim().replace(FORBIDDEN_FILENAME_CHARACTERS, "-").replace(/\s+/g, " ").replace(/-+/g, "-").replace(/[-. ]+$/g, "").trim();
  if (!/[\p{L}\p{N}]/u.test(name)) {
    throw new Error("Enter a name containing at least one letter or number.");
  }
  if (WINDOWS_RESERVED_NAMES.test(name)) {
    name = `_${name}`;
  }
  return name;
}
function normalizeTags(raw) {
  const seen = /* @__PURE__ */ new Set();
  const tags = [];
  for (const value of raw.split(",")) {
    const tag = value.trim().replace(/^#/, "").trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}
function normalizeFolderPath(input) {
  const normalized = input.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Choose a folder inside the vault.");
  }
  if (segments[0]?.toLocaleLowerCase() === ".obsidian") {
    throw new Error("Choose a visible vault folder, not .obsidian.");
  }
  return segments.join("/");
}
function buildBaseName(displayName, datePrefix, date = /* @__PURE__ */ new Date()) {
  const safeName = sanitizeDisplayName(displayName);
  return datePrefix ? `${getLocalDateParts(date).date} ${safeName}` : safeName;
}
function joinVaultPath(folder, filename) {
  return folder ? `${folder}/${filename}` : filename;
}
function resolveUniqueBaseName(desiredBaseName, folder, extension, exists) {
  let suffix = 1;
  let candidate = desiredBaseName;
  while (exists(joinVaultPath(folder, `${candidate}.${extension}`)) || exists(joinVaultPath(folder, `${candidate}.md`))) {
    suffix += 1;
    candidate = `${desiredBaseName} ${suffix}`;
  }
  return candidate;
}

// src/file-service.ts
var ImageFileService = class {
  constructor(app) {
    this.app = app;
  }
  previewPath(name, folderInput, extension, datePrefix, now = /* @__PURE__ */ new Date()) {
    const folder = normalizeFolderPath(folderInput);
    const desired = buildBaseName(name, datePrefix, now);
    const basename = resolveUniqueBaseName(
      desired,
      folder,
      extension,
      (path) => Boolean(this.app.vault.getAbstractFileByPath((0, import_obsidian2.normalizePath)(path)))
    );
    return joinVaultPath(folder, `${basename}.${extension}`);
  }
  async save(request, datePrefix, now = /* @__PURE__ */ new Date()) {
    const folder = normalizeFolderPath(request.folder);
    await this.ensureFolder(folder);
    const desired = buildBaseName(request.name, datePrefix, now);
    const basename = resolveUniqueBaseName(
      desired,
      folder,
      request.image.extension,
      (path) => Boolean(this.app.vault.getAbstractFileByPath((0, import_obsidian2.normalizePath)(path)))
    );
    const imagePath = (0, import_obsidian2.normalizePath)(joinVaultPath(folder, `${basename}.${request.image.extension}`));
    const notePath = (0, import_obsidian2.normalizePath)(joinVaultPath(folder, `${basename}.md`));
    const imageFile = await this.app.vault.createBinary(imagePath, request.image.bytes);
    let noteFile = null;
    try {
      if (request.createCompanionNote) {
        noteFile = await this.app.vault.create(
          notePath,
          this.buildCompanionNote(sanitizeDisplayName(request.name), imageFile.name, request.tags, now)
        );
      }
    } catch (error) {
      try {
        await this.app.vault.delete(imageFile, true);
      } catch (rollbackError) {
        console.error("[name-on-paste] failed to roll back image", imageFile.path, rollbackError);
      }
      throw error;
    }
    return { imageFile, noteFile, displayName: request.name };
  }
  async rename(saved, name, datePrefix, now = /* @__PURE__ */ new Date()) {
    const folder = saved.imageFile.parent?.path ?? "";
    const desired = buildBaseName(name, datePrefix, now);
    const basename = resolveUniqueBaseName(desired, folder, saved.imageFile.extension, (path) => {
      const existing = this.app.vault.getAbstractFileByPath((0, import_obsidian2.normalizePath)(path));
      return Boolean(existing && existing !== saved.imageFile && existing !== saved.noteFile);
    });
    const imagePath = (0, import_obsidian2.normalizePath)(joinVaultPath(folder, `${basename}.${saved.imageFile.extension}`));
    const notePath = (0, import_obsidian2.normalizePath)(joinVaultPath(folder, `${basename}.md`));
    const originalNotePath = saved.noteFile?.path;
    if (saved.noteFile && saved.noteFile.path !== notePath) {
      await this.app.fileManager.renameFile(saved.noteFile, notePath);
    }
    try {
      if (saved.imageFile.path !== imagePath) {
        await this.app.fileManager.renameFile(saved.imageFile, imagePath);
      }
    } catch (error) {
      if (saved.noteFile && originalNotePath && saved.noteFile.path !== originalNotePath) {
        try {
          await this.app.fileManager.renameFile(saved.noteFile, originalNotePath);
        } catch (rollbackError) {
          console.error("[name-on-paste] failed to roll back companion-note rename", rollbackError);
        }
      }
      throw error;
    }
    return { ...saved, displayName: sanitizeDisplayName(name) };
  }
  async ensureFolder(folderPath) {
    if (!folderPath) return;
    const parts = folderPath.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath((0, import_obsidian2.normalizePath)(current));
      if (existing instanceof import_obsidian2.TFolder) continue;
      if (existing) throw new Error(`${current} is a file, not a folder.`);
      await this.app.vault.createFolder((0, import_obsidian2.normalizePath)(current));
    }
  }
  buildCompanionNote(heading, imageName, tags, now) {
    const properties = {
      image: `[[${imageName}]]`,
      created: getLocalDateParts(now).date,
      source: "clipboard"
    };
    if (tags.length > 0) properties.tags = tags;
    const yaml = (0, import_obsidian2.stringifyYaml)(properties).trimEnd();
    return `---
${yaml}
---

# ${heading}

![[${imageName}]]
`;
  }
};

// src/modal.ts
var import_obsidian3 = require("obsidian");
var PasteRenamePrompt = class {
  constructor(app, options) {
    this.app = app;
    this.options = options;
    __publicField(this, "containerEl", null);
    __publicField(this, "dismissTimer", null);
  }
  open() {
    const document2 = this.app.workspace.containerEl.ownerDocument;
    const container = document2.body.createDiv({ cls: "name-on-paste-prompt" });
    container.setAttr("role", "dialog");
    container.setAttr("aria-modal", "false");
    container.setAttr("aria-label", "Name pasted image");
    this.containerEl = container;
    const header = container.createDiv({ cls: "name-on-paste-prompt-header" });
    header.createDiv({ cls: "name-on-paste-prompt-title", text: "Image added" });
    const closeButton = header.createEl("button", {
      cls: "clickable-icon name-on-paste-prompt-close",
      attr: { "aria-label": "Keep generated name" }
    });
    (0, import_obsidian3.setIcon)(closeButton, "x");
    closeButton.addEventListener("click", () => this.close());
    const description = container.createDiv({
      cls: "name-on-paste-prompt-description",
      text: "Give it a useful name, or keep the generated one."
    });
    const form = container.createEl("form", { cls: "name-on-paste-prompt-form" });
    const input = form.createEl("input", {
      type: "text",
      value: this.options.initialName,
      attr: { "aria-label": "Image name", spellcheck: "true" }
    });
    input.addEventListener("focus", () => input.select(), { once: true });
    const renameButton = form.createEl("button", {
      cls: "mod-cta",
      text: "Rename",
      attr: { type: "submit" }
    });
    const path = container.createDiv({ cls: "name-on-paste-prompt-path", text: this.options.path });
    const error = container.createDiv({ cls: "name-on-paste-prompt-error" });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) {
        error.setText("Enter a name, or close this prompt to keep the generated one.");
        return;
      }
      input.disabled = true;
      renameButton.disabled = true;
      error.empty();
      void this.options.onRename(name).then((renamedPath) => {
        description.setText("Renamed");
        path.setText(renamedPath);
        container.addClass("is-complete");
        window.setTimeout(() => this.close(), 1200);
      }).catch((renameError) => {
        input.disabled = false;
        renameButton.disabled = false;
        error.setText(errorMessage(renameError));
        input.focus();
      });
    });
    const keepOpen = () => this.clearDismissTimer();
    container.addEventListener("pointerenter", keepOpen, { once: true });
    container.addEventListener("focusin", keepOpen, { once: true });
    this.dismissTimer = window.setTimeout(() => this.close(), 12e3);
  }
  close() {
    this.clearDismissTimer();
    this.containerEl?.remove();
    this.containerEl = null;
    this.options.onClose?.();
  }
  clearDismissTimer() {
    if (this.dismissTimer === null) return;
    window.clearTimeout(this.dismissTimer);
    this.dismissTimer = null;
  }
};
var PasteImageModal = class extends import_obsidian3.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    __publicField(this, "name", "");
    __publicField(this, "folder", "");
    __publicField(this, "tags", "");
    __publicField(this, "errorEl");
    __publicField(this, "previewEl");
    __publicField(this, "submitButton");
    __publicField(this, "nameComponent");
    __publicField(this, "folderComponent");
    this.name = options.defaultName;
    this.folder = options.initialFolder;
  }
  onOpen() {
    this.modalEl.addClass("name-on-paste-modal");
    this.titleEl.setText("Paste image");
    new import_obsidian3.Setting(this.contentEl).setName("Name").addText((component) => {
      this.nameComponent = component;
      component.setValue(this.name).setPlaceholder("Describe this image").onChange((value) => {
        this.name = value;
        this.refreshPreview();
      });
    });
    new import_obsidian3.Setting(this.contentEl).setName("Folder").addText((component) => {
      this.folderComponent = component;
      component.setValue(this.folder).setPlaceholder("Vault root").onChange((value) => {
        this.folder = value;
        this.refreshPreview();
      });
      const listId = `name-on-paste-folders-${Date.now()}`;
      component.inputEl.setAttr("list", listId);
      const datalist = this.contentEl.createEl("datalist", { attr: { id: listId } });
      for (const folder of this.options.suggestedFolders) {
        datalist.createEl("option", { attr: { value: folder } });
      }
    }).addExtraButton(
      (button) => button.setIcon("folder-open").setTooltip("Browse vault folders").onClick(() => {
        new FolderSuggestModal(this.app, (folder) => {
          this.folder = folder;
          this.folderComponent.setValue(folder);
          this.refreshPreview();
        }).open();
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Tags").setDesc("Optional, separated by commas").addText(
      (component) => component.setPlaceholder("travel, japan").onChange((value) => {
        this.tags = value;
      })
    );
    this.previewEl = this.contentEl.createDiv({ cls: "name-on-paste-path" });
    this.errorEl = this.contentEl.createDiv({ cls: "name-on-paste-error" });
    const buttons = this.contentEl.createDiv({ cls: "name-on-paste-actions" });
    new import_obsidian3.ButtonComponent(buttons).setButtonText("Cancel").onClick(() => this.close());
    this.submitButton = new import_obsidian3.ButtonComponent(buttons).setButtonText("Paste image").setCta().onClick(() => this.submit());
    this.scope.register([], "Enter", () => {
      this.submit();
      return false;
    });
    this.refreshPreview();
    window.setTimeout(() => {
      this.nameComponent.inputEl.focus();
      this.nameComponent.inputEl.select();
    });
  }
  refreshPreview() {
    try {
      const path = this.options.previewPath(this.name, this.folder);
      this.previewEl.setText(path);
      this.errorEl?.empty();
      this.submitButton?.setDisabled(false);
    } catch (error) {
      this.previewEl?.empty();
      this.errorEl?.setText(errorMessage(error));
      this.submitButton?.setDisabled(true);
    }
  }
  submit() {
    try {
      this.options.previewPath(this.name, this.folder);
      this.options.onSubmit({
        name: this.name,
        folder: this.folder,
        tags: normalizeTags(this.tags)
      });
      this.close();
    } catch (error) {
      this.errorEl.setText(errorMessage(error));
    }
  }
};
var FolderSuggestModal = class extends import_obsidian3.FuzzySuggestModal {
  constructor(app, choose) {
    super(app);
    this.choose = choose;
    this.setPlaceholder("Choose a vault folder");
  }
  getItems() {
    return this.app.vault.getAllFolders();
  }
  getItemText(folder) {
    return folder.path || "Vault root";
  }
  onChooseItem(folder) {
    this.choose(folder.path);
  }
};
function errorMessage(error) {
  return error instanceof Error ? error.message : "Could not prepare this image.";
}

// src/settings.ts
var import_obsidian4 = require("obsidian");
var DEFAULT_SETTINGS = {
  defaultImageFolder: "Attachments/Screenshots",
  pasteBehavior: "ask-in-canvas",
  rememberLastFolder: true,
  lastFolder: "",
  recentFolders: [],
  datePrefix: true,
  defaultNameTemplate: DEFAULT_NAME_TEMPLATE,
  createCompanionNote: false,
  createNoteWhenTagsEntered: true,
  addCompanionNoteToCanvas: false,
  nativePasteInterception: false
};
var NameOnPasteSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    this.containerEl.empty();
    new import_obsidian4.Setting(this.containerEl).setName("Default image folder").setDesc("Used by quick paste and as the initial detailed-paste destination.").addText(
      (text) => text.setValue(this.plugin.settings.defaultImageFolder).onChange(async (value) => {
        this.plugin.settings.defaultImageFolder = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(this.containerEl).setName("Paste behavior").setDesc("Controls the optional rename card when paste and drop interception is enabled.").addDropdown(
      (dropdown) => dropdown.addOptions({
        "always-ask": "Always offer rename",
        "ask-in-canvas": "Offer rename in Canvas",
        "paste-immediately": "Paste immediately"
      }).setValue(this.plugin.settings.pasteBehavior).onChange(async (value) => {
        this.plugin.settings.pasteBehavior = value;
        await this.plugin.saveSettings();
      })
    );
    this.addToggle("Remember last folder", "Use the latest destination for the next modal.", "rememberLastFolder");
    this.addToggle("Date prefix", "Prefix filenames with the current YYYY-MM-DD date.", "datePrefix");
    new import_obsidian4.Setting(this.containerEl).setName("Default image name").setDesc("Supports {{date}} and {{time}} placeholders.").addText(
      (text) => text.setValue(this.plugin.settings.defaultNameTemplate).onChange(async (value) => {
        this.plugin.settings.defaultNameTemplate = value || DEFAULT_NAME_TEMPLATE;
        await this.plugin.saveSettings();
      })
    );
    this.addToggle("Create companion note", "Create a Markdown metadata note for every imported image.", "createCompanionNote");
    this.addToggle("Create note when tags are entered", "Make entered tags searchable through a companion note.", "createNoteWhenTagsEntered");
    this.addToggle("Add companion note to Canvas", "Place the companion note beside its image card.", "addCompanionNoteToCanvas");
    new import_obsidian4.Setting(this.containerEl).setName("Native Canvas paste and drop interception").setDesc("Experimental. Opens Name on Paste for pasted images and external image files dropped onto Canvas.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.nativePasteInterception).onChange(async (value) => {
        this.plugin.settings.nativePasteInterception = value;
        await this.plugin.saveSettings();
      })
    );
  }
  addToggle(name, description, key) {
    new import_obsidian4.Setting(this.containerEl).setName(name).setDesc(description).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
        this.plugin.settings[key] = value;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/main.ts
var NameOnPastePlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", DEFAULT_SETTINGS);
    __publicField(this, "fileService");
    __publicField(this, "canvasAdapter");
    __publicField(this, "handlingNativePaste", false);
    __publicField(this, "handlingExternalDrop", false);
    __publicField(this, "renamePrompt", null);
  }
  async onload() {
    await this.loadSettings();
    this.fileService = new ImageFileService(this.app);
    this.canvasAdapter = new CanvasAdapter(this.app);
    this.addSettingTab(new NameOnPasteSettingTab(this.app, this));
    this.addCommand({
      id: "paste-image-with-details",
      name: "Paste image with details",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "v" }],
      callback: () => void this.runClipboardCommand("details")
    });
    this.addCommand({
      id: "paste-image-quickly",
      name: "Paste image quickly",
      callback: () => void this.runClipboardCommand("quick")
    });
    this.addCommand({
      id: "paste-image-as-image-and-note",
      name: "Paste image as image + note",
      callback: () => void this.runClipboardCommand("note")
    });
    const pasteHandler = (event) => this.handleNativePaste(event);
    const dragOverHandler = (event) => this.handleExternalDragOver(event);
    const dropHandler = (event) => this.handleExternalDrop(event);
    document.addEventListener("paste", pasteHandler, true);
    document.addEventListener("dragover", dragOverHandler, true);
    document.addEventListener("drop", dropHandler, true);
    this.register(() => document.removeEventListener("paste", pasteHandler, true));
    this.register(() => document.removeEventListener("dragover", dragOverHandler, true));
    this.register(() => document.removeEventListener("drop", dropHandler, true));
    this.register(() => this.renamePrompt?.close());
  }
  async loadSettings() {
    const stored = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...stored ?? {} };
    this.settings.recentFolders = Array.isArray(this.settings.recentFolders) ? this.settings.recentFolders.slice(0, 5) : [];
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async runClipboardCommand(mode) {
    try {
      const image = await readClipboardImage();
      if (!image) {
        new import_obsidian5.Notice("The clipboard does not contain an image.");
        return;
      }
      await this.startPaste(image, mode);
    } catch (error) {
      this.reportError("Could not read an image from the clipboard", error);
    }
  }
  async startPaste(image, mode, dropPlacement) {
    if (mode === "quick") {
      const details = {
        name: renderNameTemplate(this.settings.defaultNameTemplate),
        folder: this.settings.defaultImageFolder,
        tags: []
      };
      await this.completePaste(image, details, false, dropPlacement);
      return;
    }
    new PasteImageModal(this.app, {
      defaultName: renderNameTemplate(this.settings.defaultNameTemplate),
      initialFolder: this.getInitialFolder(),
      suggestedFolders: this.getSuggestedFolders(),
      previewPath: (name, folder) => this.fileService.previewPath(name, folder, image.extension, this.settings.datePrefix),
      onSubmit: (details) => {
        void this.completePaste(image, details, mode === "note", dropPlacement);
      }
    }).open();
  }
  async completePaste(image, details, forceNote, dropPlacement, announce = true) {
    const createNote = forceNote || this.settings.createCompanionNote || details.tags.length > 0 && this.settings.createNoteWhenTagsEntered;
    let saved;
    try {
      saved = await this.fileService.save(
        { ...details, image, createCompanionNote: createNote },
        this.settings.datePrefix
      );
    } catch (error) {
      this.reportError("Could not save the clipboard image", error);
      return null;
    }
    try {
      await this.rememberFolder(saved.imageFile.parent?.path ?? "");
    } catch (error) {
      console.warn("[name-on-paste] image saved but recent-folder settings were not updated", error);
    }
    try {
      await this.insertSavedFiles(saved, image, forceNote, dropPlacement, announce);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[name-on-paste] insertion failed after save", error);
      new import_obsidian5.Notice(
        `Saved ${saved.imageFile.path}, but could not insert it into the active view: ${message}`,
        9e3
      );
    }
    return saved;
  }
  async insertSavedFiles(saved, image, forceNote, dropPlacement, announce = true) {
    if (this.canvasAdapter.isActive()) {
      const result = await this.canvasAdapter.insert(
        saved.imageFile,
        image,
        saved.noteFile,
        forceNote || this.settings.addCompanionNoteToCanvas,
        dropPlacement
      );
      if (!result.inserted) {
        new import_obsidian5.Notice(`Saved ${saved.imageFile.path}, but could not add it to Canvas: ${result.reason}`, 9e3);
        return;
      }
      if (announce) new import_obsidian5.Notice(`Saved ${saved.imageFile.path}`);
      return;
    }
    const markdown = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
    if (markdown) {
      const link = this.app.fileManager.generateMarkdownLink(saved.imageFile, markdown.file?.path ?? "", void 0, saved.displayName);
      markdown.editor.replaceSelection(`!${link}`);
      if (announce) new import_obsidian5.Notice(`Saved ${saved.imageFile.path}`);
      return;
    }
    if (announce) new import_obsidian5.Notice(`Saved ${saved.imageFile.path}. Open a Canvas or Markdown note to insert it.`, 8e3);
  }
  handleNativePaste(event) {
    if (!this.settings.nativePasteInterception || this.handlingNativePaste || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, [contenteditable='true']")) return;
    const canvasActive = this.canvasAdapter.isActive();
    const markdownActive = Boolean(this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView));
    if (!canvasActive && !markdownActive) return;
    if (canvasActive && !this.canvasAdapter.canInsert()) return;
    if (this.settings.pasteBehavior === "ask-in-canvas" && !canvasActive) return;
    const blob = findImageBlob(event);
    if (!blob) return;
    event.preventDefault();
    event.stopPropagation();
    this.handlingNativePaste = true;
    void clipboardImageFromBlob(blob).then((image) => this.handleInterceptedImage(image)).catch((error) => this.reportError("Could not prepare the pasted image", error)).finally(() => {
      this.handlingNativePaste = false;
    });
  }
  handleExternalDragOver(event) {
    if (!this.canInterceptExternalDrop(event) || !hasDroppedImage(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }
  handleExternalDrop(event) {
    if (!this.canInterceptExternalDrop(event)) return;
    const file = findDroppedImage(event);
    if (!file) return;
    event.preventDefault();
    event.stopPropagation();
    this.handlingExternalDrop = true;
    const dropPlacement = { clientX: event.clientX, clientY: event.clientY };
    void clipboardImageFromBlob(file).then((image) => this.handleInterceptedImage(image, dropPlacement)).catch((error) => this.reportError("Could not prepare the dropped image", error)).finally(() => {
      this.handlingExternalDrop = false;
    });
  }
  canInterceptExternalDrop(event) {
    return Boolean(
      this.settings.nativePasteInterception && !this.handlingExternalDrop && !event.defaultPrevented && this.canvasAdapter.isActive() && this.canvasAdapter.canInsert() && this.canvasAdapter.containsTarget(event.target)
    );
  }
  async handleInterceptedImage(image, dropPlacement) {
    if (this.settings.pasteBehavior === "paste-immediately") {
      await this.startPaste(image, "quick", dropPlacement);
      return;
    }
    const defaultName = renderNameTemplate(this.settings.defaultNameTemplate);
    const details = {
      name: defaultName,
      folder: this.getInitialFolder(),
      tags: []
    };
    const saved = await this.completePaste(image, details, false, dropPlacement, false);
    if (!saved) return;
    this.showRenamePrompt(saved, defaultName);
  }
  showRenamePrompt(saved, initialName) {
    this.renamePrompt?.close();
    const prompt = new PasteRenamePrompt(this.app, {
      initialName,
      path: saved.imageFile.path,
      onRename: async (name) => {
        const renamed = await this.fileService.rename(saved, name, this.settings.datePrefix);
        return renamed.imageFile.path;
      },
      onClose: () => {
        if (this.renamePrompt === prompt) this.renamePrompt = null;
      }
    });
    this.renamePrompt = prompt;
    prompt.open();
  }
  getInitialFolder() {
    if (this.settings.rememberLastFolder && this.settings.lastFolder) return this.settings.lastFolder;
    return this.settings.defaultImageFolder;
  }
  getSuggestedFolders() {
    const suggestions = [
      this.getInitialFolder(),
      this.settings.defaultImageFolder,
      this.getActiveCanvasFolder(),
      ...this.settings.recentFolders
    ];
    return [...new Set(suggestions.filter((folder) => Boolean(folder)))];
  }
  getActiveCanvasFolder() {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile?.extension !== "canvas") return null;
    return activeFile.parent?.path ?? "";
  }
  async rememberFolder(folder) {
    this.settings.lastFolder = folder;
    this.settings.recentFolders = [folder, ...this.settings.recentFolders.filter((item) => item !== folder)].slice(0, 5);
    await this.saveSettings();
  }
  reportError(prefix, error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[name-on-paste] ${prefix}`, error);
    new import_obsidian5.Notice(`${prefix}: ${message}`, 9e3);
  }
};
