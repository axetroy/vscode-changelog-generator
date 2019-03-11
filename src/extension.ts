"use strict";
import VSCODE = require("vscode");
import * as path from "path";
import * as execa from "execa";

enum Type {
  newDocument = "new document",
  overwriteChangelog = "overwrite CHANGELOG.md",
  appendToChangelog = "append to CHANGELOG.md"
}

interface IConfig {
  type: string;
  preset: string;
  releaseCount: number;
  outputUnreleased: boolean;
  changelogFileName: string;
}

export function activate(context: VSCODE.ExtensionContext) {
  const vs: typeof VSCODE = require("vscode");

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
        placeHolder: "select a workspace to generate changelog"
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

    const type = config.type;
    const isOverwriteChangelog = type === Type.overwriteChangelog;
    const isAppend = type === Type.appendToChangelog;

    const args = [
      cli,
      "--preset",
      config.preset,
      "--release-count",
      config.releaseCount + "",
      isAppend ? "--append" : "",
      ...(isOverwriteChangelog || isAppend
        ? ["--outfile", config.changelogFileName]
        : []),
      config.outputUnreleased ? "--output-unreleased" : ""
    ];

    const { stdout: changelog } = await execa(process.execPath, args, {
      cwd: workspacePath
    });

    switch (type) {
      case Type.newDocument:
        const document = await vs.workspace.openTextDocument({
          language: "markdown",
          content: changelog
        });
        vs.window.showTextDocument(document);
        break;
      case Type.overwriteChangelog:
        break;
      case Type.appendToChangelog:
        break;
      default:
        break;
    }
  }

  async function handler(releaseCount: number | null) {
    const config = vs.workspace.getConfiguration("changelog");

    const type = config.get<string>("type") || "";
    const preset = config.get<string>("preset") || "";
    const changelogFileName = config.get<string>("changelogFileName") || "";
    const outputUnreleased = config.get<boolean>("outputUnreleased") || false;

    if (releaseCount === null) {
      releaseCount = config.get<number>("release-count") || 0;
    }

    await generate({
      type,
      preset,
      releaseCount,
      changelogFileName,
      outputUnreleased
    });
  }

  context.subscriptions.push(
    vs.commands.registerCommand("changelog.generate", () => {
      return handler(null);
    })
  );

  context.subscriptions.push(
    vs.commands.registerCommand("changelog.generateFromLastVersion", () => {
      return handler(1);
    })
  );

  context.subscriptions.push(
    vs.commands.registerCommand("changelog.generateFromLastTwoVersion", () => {
      return handler(2);
    })
  );

  context.subscriptions.push(
    vs.commands.registerCommand(
      "changelog.generateFromLastNVersion",
      async () => {
        const releaseCount = await vs.window.showInputBox({
          placeHolder: "",
          validateInput(input) {
            if (/^\d+$/.test(input.trim())) {
              return null;
            }
            return "Please enter an interger number.";
          }
        });
        if (releaseCount === undefined) {
          return;
        }
        return handler(parseInt(releaseCount, 10));
      }
    )
  );

  context.subscriptions.push(
    vs.commands.registerCommand("changelog.generateAll", () => {
      return handler(0);
    })
  );
}

// this method is called when your extension is deactivated
export function deactivate(context: VSCODE.ExtensionContext) {
  //
}
