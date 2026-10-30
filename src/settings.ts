import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_NAME_TEMPLATE } from "./naming";
import type NameOnPastePlugin from "./main";
import type { NameOnPasteSettings, PasteBehavior } from "./types";

export const DEFAULT_SETTINGS: NameOnPasteSettings = {
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
  nativePasteInterception: false,
};

export class NameOnPasteSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: NameOnPastePlugin) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName("Default image folder")
      .setDesc("Used by quick paste and as the initial detailed-paste destination.")
      .addText((text) =>
        text.setValue(this.plugin.settings.defaultImageFolder).onChange(async (value) => {
          this.plugin.settings.defaultImageFolder = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(this.containerEl)
      .setName("Paste behavior")
      .setDesc("Controls the optional rename card when paste and drop interception is enabled.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            "always-ask": "Always offer rename",
            "ask-in-canvas": "Offer rename in Canvas",
            "paste-immediately": "Paste immediately",
          })
          .setValue(this.plugin.settings.pasteBehavior)
          .onChange(async (value) => {
            this.plugin.settings.pasteBehavior = value as PasteBehavior;
            await this.plugin.saveSettings();
          }),
      );

    this.addToggle("Remember last folder", "Use the latest destination for the next modal.", "rememberLastFolder");
    this.addToggle("Date prefix", "Prefix filenames with the current YYYY-MM-DD date.", "datePrefix");

    new Setting(this.containerEl)
      .setName("Default image name")
      .setDesc("Supports {{date}} and {{time}} placeholders.")
      .addText((text) =>
        text.setValue(this.plugin.settings.defaultNameTemplate).onChange(async (value) => {
          this.plugin.settings.defaultNameTemplate = value || DEFAULT_NAME_TEMPLATE;
          await this.plugin.saveSettings();
        }),
      );

    this.addToggle("Create companion note", "Create a Markdown metadata note for every imported image.", "createCompanionNote");
    this.addToggle("Create note when tags are entered", "Make entered tags searchable through a companion note.", "createNoteWhenTagsEntered");
    this.addToggle("Add companion note to Canvas", "Place the companion note beside its image card.", "addCompanionNoteToCanvas");

    new Setting(this.containerEl)
      .setName("Native Canvas paste and drop interception")
      .setDesc("Experimental. Opens Name on Paste for pasted images and external image files dropped onto Canvas.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.nativePasteInterception).onChange(async (value) => {
          this.plugin.settings.nativePasteInterception = value;
          await this.plugin.saveSettings();
        }),
      );
  }

  private addToggle(
    name: string,
    description: string,
    key: "rememberLastFolder" | "datePrefix" | "createCompanionNote" | "createNoteWhenTagsEntered" | "addCompanionNoteToCanvas",
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
          this.plugin.settings[key] = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}
