import { MarkdownView, Notice, Plugin } from "obsidian";
import { CanvasAdapter } from "./canvas-adapter";
import {
  clipboardImageFromBlob,
  findDroppedImage,
  findImageBlob,
  hasDroppedImage,
  readClipboardImage,
} from "./clipboard";
import { ImageFileService } from "./file-service";
import { renderNameTemplate } from "./naming";
import { PasteImageModal, PasteRenamePrompt } from "./modal";
import { DEFAULT_SETTINGS, NameOnPasteSettingTab } from "./settings";
import type {
  CanvasDropPlacement,
  ClipboardImage,
  NameOnPasteSettings,
  PasteDetails,
  SaveResult,
} from "./types";

export default class NameOnPastePlugin extends Plugin {
  settings: NameOnPasteSettings = DEFAULT_SETTINGS;
  private fileService!: ImageFileService;
  private canvasAdapter!: CanvasAdapter;
  private handlingNativePaste = false;
  private handlingExternalDrop = false;
  private renamePrompt: PasteRenamePrompt | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.fileService = new ImageFileService(this.app);
    this.canvasAdapter = new CanvasAdapter(this.app);
    this.addSettingTab(new NameOnPasteSettingTab(this.app, this));

    this.addCommand({
      id: "paste-image-with-details",
      name: "Paste image with details",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "v" }],
      callback: () => void this.runClipboardCommand("details"),
    });
    this.addCommand({
      id: "paste-image-quickly",
      name: "Paste image quickly",
      callback: () => void this.runClipboardCommand("quick"),
    });
    this.addCommand({
      id: "paste-image-as-image-and-note",
      name: "Paste image as image + note",
      callback: () => void this.runClipboardCommand("note"),
    });

    const pasteHandler = (event: ClipboardEvent): void => this.handleNativePaste(event);
    const dragOverHandler = (event: DragEvent): void => this.handleExternalDragOver(event);
    const dropHandler = (event: DragEvent): void => this.handleExternalDrop(event);
    document.addEventListener("paste", pasteHandler, true);
    document.addEventListener("dragover", dragOverHandler, true);
    document.addEventListener("drop", dropHandler, true);
    this.register(() => document.removeEventListener("paste", pasteHandler, true));
    this.register(() => document.removeEventListener("dragover", dragOverHandler, true));
    this.register(() => document.removeEventListener("drop", dropHandler, true));
    this.register(() => this.renamePrompt?.close());
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<NameOnPasteSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
    this.settings.recentFolders = Array.isArray(this.settings.recentFolders)
      ? this.settings.recentFolders.slice(0, 5)
      : [];
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async runClipboardCommand(mode: "details" | "quick" | "note"): Promise<void> {
    try {
      const image = await readClipboardImage();
      if (!image) {
        new Notice("The clipboard does not contain an image.");
        return;
      }
      await this.startPaste(image, mode);
    } catch (error) {
      this.reportError("Could not read an image from the clipboard", error);
    }
  }

  private async startPaste(
    image: ClipboardImage,
    mode: "details" | "quick" | "note",
    dropPlacement?: CanvasDropPlacement,
  ): Promise<void> {
    if (mode === "quick") {
      const details: PasteDetails = {
        name: renderNameTemplate(this.settings.defaultNameTemplate),
        folder: this.settings.defaultImageFolder,
        tags: [],
      };
      await this.completePaste(image, details, false, dropPlacement);
      return;
    }

    new PasteImageModal(this.app, {
      defaultName: renderNameTemplate(this.settings.defaultNameTemplate),
      initialFolder: this.getInitialFolder(),
      suggestedFolders: this.getSuggestedFolders(),
      previewPath: (name, folder) =>
        this.fileService.previewPath(name, folder, image.extension, this.settings.datePrefix),
      onSubmit: (details) => {
        void this.completePaste(image, details, mode === "note", dropPlacement);
      },
    }).open();
  }

  private async completePaste(
    image: ClipboardImage,
    details: PasteDetails,
    forceNote: boolean,
    dropPlacement?: CanvasDropPlacement,
    announce = true,
  ): Promise<SaveResult | null> {
    const createNote =
      forceNote ||
      this.settings.createCompanionNote ||
      (details.tags.length > 0 && this.settings.createNoteWhenTagsEntered);

    let saved: SaveResult;
    try {
      saved = await this.fileService.save(
        { ...details, image, createCompanionNote: createNote },
        this.settings.datePrefix,
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
      new Notice(
        `Saved ${saved.imageFile.path}, but could not insert it into the active view: ${message}`,
        9000,
      );
    }
    return saved;
  }

  private async insertSavedFiles(
    saved: SaveResult,
    image: ClipboardImage,
    forceNote: boolean,
    dropPlacement?: CanvasDropPlacement,
    announce = true,
  ): Promise<void> {
    if (this.canvasAdapter.isActive()) {
      const result = await this.canvasAdapter.insert(
        saved.imageFile,
        image,
        saved.noteFile,
        forceNote || this.settings.addCompanionNoteToCanvas,
        dropPlacement,
      );
      if (!result.inserted) {
        new Notice(`Saved ${saved.imageFile.path}, but could not add it to Canvas: ${result.reason}`, 9000);
        return;
      }
      if (announce) new Notice(`Saved ${saved.imageFile.path}`);
      return;
    }

    const markdown = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (markdown) {
      const link = this.app.fileManager.generateMarkdownLink(saved.imageFile, markdown.file?.path ?? "", undefined, saved.displayName);
      markdown.editor.replaceSelection(`!${link}`);
      if (announce) new Notice(`Saved ${saved.imageFile.path}`);
      return;
    }

    if (announce) new Notice(`Saved ${saved.imageFile.path}. Open a Canvas or Markdown note to insert it.`, 8000);
  }

  private handleNativePaste(event: ClipboardEvent): void {
    if (!this.settings.nativePasteInterception || this.handlingNativePaste || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, [contenteditable='true']")) return;

    const canvasActive = this.canvasAdapter.isActive();
    const markdownActive = Boolean(this.app.workspace.getActiveViewOfType(MarkdownView));
    if (!canvasActive && !markdownActive) return;
    if (canvasActive && !this.canvasAdapter.canInsert()) return;
    if (this.settings.pasteBehavior === "ask-in-canvas" && !canvasActive) return;

    const blob = findImageBlob(event);
    if (!blob) return;
    event.preventDefault();
    event.stopPropagation();
    this.handlingNativePaste = true;

    void clipboardImageFromBlob(blob)
      .then((image) => this.handleInterceptedImage(image))
      .catch((error: unknown) => this.reportError("Could not prepare the pasted image", error))
      .finally(() => {
        this.handlingNativePaste = false;
      });
  }

  private handleExternalDragOver(event: DragEvent): void {
    if (!this.canInterceptExternalDrop(event) || !hasDroppedImage(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }

  private handleExternalDrop(event: DragEvent): void {
    if (!this.canInterceptExternalDrop(event)) return;
    const file = findDroppedImage(event);
    if (!file) return;

    event.preventDefault();
    event.stopPropagation();
    this.handlingExternalDrop = true;
    const dropPlacement = { clientX: event.clientX, clientY: event.clientY };

    void clipboardImageFromBlob(file)
      .then((image) => this.handleInterceptedImage(image, dropPlacement))
      .catch((error: unknown) => this.reportError("Could not prepare the dropped image", error))
      .finally(() => {
        this.handlingExternalDrop = false;
      });
  }

  private canInterceptExternalDrop(event: DragEvent): boolean {
    return Boolean(
      this.settings.nativePasteInterception &&
        !this.handlingExternalDrop &&
        !event.defaultPrevented &&
        this.canvasAdapter.isActive() &&
        this.canvasAdapter.canInsert() &&
        this.canvasAdapter.containsTarget(event.target),
    );
  }

  private async handleInterceptedImage(
    image: ClipboardImage,
    dropPlacement?: CanvasDropPlacement,
  ): Promise<void> {
    if (this.settings.pasteBehavior === "paste-immediately") {
      await this.startPaste(image, "quick", dropPlacement);
      return;
    }

    const defaultName = renderNameTemplate(this.settings.defaultNameTemplate);
    const details: PasteDetails = {
      name: defaultName,
      folder: this.getInitialFolder(),
      tags: [],
    };
    const saved = await this.completePaste(image, details, false, dropPlacement, false);
    if (!saved) return;
    this.showRenamePrompt(saved, defaultName);
  }

  private showRenamePrompt(saved: SaveResult, initialName: string): void {
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
      },
    });
    this.renamePrompt = prompt;
    prompt.open();
  }

  private getInitialFolder(): string {
    if (this.settings.rememberLastFolder && this.settings.lastFolder) return this.settings.lastFolder;
    return this.settings.defaultImageFolder;
  }

  private getSuggestedFolders(): string[] {
    const suggestions = [
      this.getInitialFolder(),
      this.settings.defaultImageFolder,
      this.getActiveCanvasFolder(),
      ...this.settings.recentFolders,
    ];
    return [...new Set(suggestions.filter((folder): folder is string => Boolean(folder)))];
  }

  private getActiveCanvasFolder(): string | null {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile?.extension !== "canvas") return null;
    return activeFile.parent?.path ?? "";
  }

  private async rememberFolder(folder: string): Promise<void> {
    this.settings.lastFolder = folder;
    this.settings.recentFolders = [folder, ...this.settings.recentFolders.filter((item) => item !== folder)].slice(0, 5);
    await this.saveSettings();
  }

  private reportError(prefix: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[name-on-paste] ${prefix}`, error);
    new Notice(`${prefix}: ${message}`, 9000);
  }
}
