import {
  App,
  ButtonComponent,
  FuzzySuggestModal,
  Modal,
  Setting,
  TFolder,
  TextComponent,
  setIcon,
} from "obsidian";
import { normalizeTags } from "./naming";
import type { PasteDetails } from "./types";

interface PasteModalOptions {
  defaultName: string;
  initialFolder: string;
  suggestedFolders: string[];
  previewPath: (name: string, folder: string) => string;
  onSubmit: (details: PasteDetails) => void;
}

interface RenamePromptOptions {
  initialName: string;
  path: string;
  onRename: (name: string) => Promise<string>;
  onClose?: () => void;
}

export class PasteRenamePrompt {
  private containerEl: HTMLElement | null = null;
  private dismissTimer: number | null = null;

  constructor(private readonly app: App, private readonly options: RenamePromptOptions) {}

  open(): void {
    const document = this.app.workspace.containerEl.ownerDocument;
    const container = document.body.createDiv({ cls: "name-on-paste-prompt" });
    container.setAttr("role", "dialog");
    container.setAttr("aria-modal", "false");
    container.setAttr("aria-label", "Name pasted image");
    this.containerEl = container;

    const header = container.createDiv({ cls: "name-on-paste-prompt-header" });
    header.createDiv({ cls: "name-on-paste-prompt-title", text: "Image added" });
    const closeButton = header.createEl("button", {
      cls: "clickable-icon name-on-paste-prompt-close",
      attr: { "aria-label": "Keep generated name" },
    });
    setIcon(closeButton, "x");
    closeButton.addEventListener("click", () => this.close());

    const description = container.createDiv({
      cls: "name-on-paste-prompt-description",
      text: "Give it a useful name, or keep the generated one.",
    });

    const form = container.createEl("form", { cls: "name-on-paste-prompt-form" });
    const input = form.createEl("input", {
      type: "text",
      value: this.options.initialName,
      attr: { "aria-label": "Image name", spellcheck: "true" },
    });
    input.addEventListener("focus", () => input.select(), { once: true });
    const renameButton = form.createEl("button", {
      cls: "mod-cta",
      text: "Rename",
      attr: { type: "submit" },
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
      void this.options.onRename(name)
        .then((renamedPath) => {
          description.setText("Renamed");
          path.setText(renamedPath);
          container.addClass("is-complete");
          window.setTimeout(() => this.close(), 1200);
        })
        .catch((renameError: unknown) => {
          input.disabled = false;
          renameButton.disabled = false;
          error.setText(errorMessage(renameError));
          input.focus();
        });
    });

    const keepOpen = (): void => this.clearDismissTimer();
    container.addEventListener("pointerenter", keepOpen, { once: true });
    container.addEventListener("focusin", keepOpen, { once: true });
    this.dismissTimer = window.setTimeout(() => this.close(), 12000);
  }

  close(): void {
    this.clearDismissTimer();
    this.containerEl?.remove();
    this.containerEl = null;
    this.options.onClose?.();
  }

  private clearDismissTimer(): void {
    if (this.dismissTimer === null) return;
    window.clearTimeout(this.dismissTimer);
    this.dismissTimer = null;
  }
}

export class PasteImageModal extends Modal {
  private name = "";
  private folder = "";
  private tags = "";
  private errorEl!: HTMLElement;
  private previewEl!: HTMLElement;
  private submitButton!: ButtonComponent;
  private nameComponent!: TextComponent;
  private folderComponent!: TextComponent;

  constructor(app: App, private readonly options: PasteModalOptions) {
    super(app);
    this.name = options.defaultName;
    this.folder = options.initialFolder;
  }

  onOpen(): void {
    this.modalEl.addClass("name-on-paste-modal");
    this.titleEl.setText("Paste image");

    new Setting(this.contentEl)
      .setName("Name")
      .addText((component) => {
        this.nameComponent = component;
        component
          .setValue(this.name)
          .setPlaceholder("Describe this image")
          .onChange((value) => {
            this.name = value;
            this.refreshPreview();
          });
      });

    new Setting(this.contentEl)
      .setName("Folder")
      .addText((component) => {
        this.folderComponent = component;
        component
          .setValue(this.folder)
          .setPlaceholder("Vault root")
          .onChange((value) => {
            this.folder = value;
            this.refreshPreview();
          });
        const listId = `name-on-paste-folders-${Date.now()}`;
        component.inputEl.setAttr("list", listId);
        const datalist = this.contentEl.createEl("datalist", { attr: { id: listId } });
        for (const folder of this.options.suggestedFolders) {
          datalist.createEl("option", { attr: { value: folder } });
        }
      })
      .addExtraButton((button) =>
        button.setIcon("folder-open").setTooltip("Browse vault folders").onClick(() => {
          new FolderSuggestModal(this.app, (folder) => {
            this.folder = folder;
            this.folderComponent.setValue(folder);
            this.refreshPreview();
          }).open();
        }),
      );

    new Setting(this.contentEl)
      .setName("Tags")
      .setDesc("Optional, separated by commas")
      .addText((component) =>
        component.setPlaceholder("travel, japan").onChange((value) => {
          this.tags = value;
        }),
      );

    this.previewEl = this.contentEl.createDiv({ cls: "name-on-paste-path" });
    this.errorEl = this.contentEl.createDiv({ cls: "name-on-paste-error" });

    const buttons = this.contentEl.createDiv({ cls: "name-on-paste-actions" });
    new ButtonComponent(buttons).setButtonText("Cancel").onClick(() => this.close());
    this.submitButton = new ButtonComponent(buttons)
      .setButtonText("Paste image")
      .setCta()
      .onClick(() => this.submit());

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

  private refreshPreview(): void {
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

  private submit(): void {
    try {
      this.options.previewPath(this.name, this.folder);
      this.options.onSubmit({
        name: this.name,
        folder: this.folder,
        tags: normalizeTags(this.tags),
      });
      this.close();
    } catch (error) {
      this.errorEl.setText(errorMessage(error));
    }
  }
}

class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private readonly choose: (path: string) => void) {
    super(app);
    this.setPlaceholder("Choose a vault folder");
  }

  getItems(): TFolder[] {
    return this.app.vault.getAllFolders();
  }

  getItemText(folder: TFolder): string {
    return folder.path || "Vault root";
  }

  onChooseItem(folder: TFolder): void {
    this.choose(folder.path);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not prepare this image.";
}
