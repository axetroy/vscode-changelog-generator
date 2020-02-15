import VSCODE = require("vscode");
import * as path from "path";
import * as execa from "execa";
import { init, localize } from "vscode-nls-i18n";

enum Preset {
  Angular = "angular",
  Atom = "atom",
  CodeMirror = "codemirror",
  Ember = "ember",
  Eslint = "eslint",
  Express = "express",
  JQuery = "jquery",
  JsCs = "jscs",
  JsHint = "jshint"
}

type IConfig = {
  preset: Preset;
  releaseCount: number;
  outputUnreleased: boolean;
};

export function activate(context: VSCODE.ExtensionContext) {
  const vs: typeof VSCODE = require("vscode");
  init(context.extensionPath);

  async function prickWorkspace(): Promise<VSCODE.WorkspaceFolder | undefined> {
    const workspaces = vs.workspace.workspaceFolders;
    if (!workspaces) {
      return;
    }
    if (workspaces.length === 1) {
      return workspaces[0];
    }
    if (workspaces.length > 1) {
      return vs.window.showWorkspaceFolderPick({
        placeHolder: localize("placeholder.select.workspace")
      });
    }

    return;
  }

  async function generate(config: IConfig) {
    const workspaceFolder = await prickWorkspace();

    if (!workspaceFolder) {
      return;
    }

    const workspacePath = workspaceFolder.uri.fsPath;

    const cli = path.join(
      context.extensionPath,
      "node_modules",
      "conventional-changelog-cli",
      "cli.js"
    );

    const args = [
      cli,
      "--preset",
      config.preset,
      "--release-count",
      config.releaseCount + "",
      config.outputUnreleased ? "--output-unreleased" : ""
    ];

    const changelog = await vs.window.withProgress(
      {
        location: vs.ProgressLocation.Notification,
        title: localize("info.generating")
      },
      async () => {
        const { stdout } = await execa(process.execPath, args, {
          cwd: workspacePath
        });

        return stdout;
      }
    );

    const document = await vs.workspace.openTextDocument({
      language: "markdown",
      content: changelog
    });

    vs.window.showTextDocument(document);
  }

  context.subscriptions.push(
    vs.commands.registerCommand("changelog.generate", async () => {
      let currentStep = 1;
      const totalSteps = 3;

      const preset: Preset = await new Promise(resolve => {
        const quickPick = vs.window.createQuickPick();
        quickPick.title = localize("info.select_preset");
        quickPick.step = currentStep;
        quickPick.totalSteps = totalSteps;

        quickPick.items = [
          Preset.Angular,
          Preset.Atom,
          Preset.CodeMirror,
          Preset.Ember,
          Preset.Eslint,
          Preset.Express,
          Preset.JQuery,
          Preset.JsCs,
          Preset.JsHint
        ].map(v => {
          return {
            label: v
          };
        });

        quickPick.onDidChangeSelection(selection => {
          currentStep = quickPick.step = (quickPick.step as number) + 1;
          quickPick.hide();

          resolve(selection[0].label as Preset);
        });

        quickPick.onDidHide(() => quickPick.dispose());

        quickPick.show();
      });

      const outputUnreleased: boolean = await new Promise(resolve => {
        const quickPick = vs.window.createQuickPick();
        quickPick.title = localize("info.output_unreleased");
        quickPick.step = currentStep;
        quickPick.totalSteps = totalSteps;

        quickPick.items = ["Yes", "No"].map(v => {
          return {
            label: v
          };
        });

        quickPick.onDidChangeSelection(selection => {
          currentStep = quickPick.step = (quickPick.step as number) + 1;
          quickPick.hide();

          resolve(selection[0].label === "Yes" ? true : false);
        });

        quickPick.onDidHide(() => quickPick.dispose());

        quickPick.show();
      });

      const releaseCount: number = await new Promise(resolve => {
        const input = vs.window.createInputBox();
        input.title = localize("info.release_count");
        input.step = currentStep;
        input.totalSteps = totalSteps;
        input.value = "0";
        input.show();
        input.prompt = localize("info.release_count_meta");

        input.onDidChangeValue(() => {
          input.validationMessage = undefined;
        });

        input.onDidAccept(() => {
          const val = +input.value;

          if (isNaN(val)) {
            input.validationMessage = localize("validator.interger");
            return;
          }

          input.hide();
          resolve(+input.value);
        });

        input.onDidHide(() => input.dispose());
      });

      await generate({
        preset,
        releaseCount,
        outputUnreleased
      });
    })
  );
}
