"use strict";
import VSCODE = require("vscode");
import * as path from "path";
import * as execa from "execa";
import { init, localize } from "vscode-nls-i18n";

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
  init(context);

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

  async function handler(releaseCount: number | null, uri?: VSCODE.Uri) {
    const config = vs.workspace.getConfiguration("changelog");

    const type = config.get<string>("type") || "";
    const preset = config.get<string>("preset") || "";
    const changelogFileName = uri
      ? path.basename(uri.fsPath)
      : config.get<string>("changelogFileName") || "";
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
    vs.commands.registerCommand("changelog.generate", (uri: VSCODE.Uri) => {
      return handler(null, uri);
    })
  );

  context.subscriptions.push(
    vs.commands.registerCommand(
      "changelog.generateFromLastVersion",
      (uri: VSCODE.Uri) => {
        return handler(1, uri);
      }
    )
  );

  context.subscriptions.push(
    vs.commands.registerCommand(
      "changelog.generateFromLastTwoVersion",
      (uri: VSCODE.Uri) => {
        return handler(2, uri);
      }
    )
  );

  context.subscriptions.push(
    vs.commands.registerCommand(
      "changelog.generateFromLastNVersion",
      async (uri: VSCODE.Uri) => {
        const releaseCount = await vs.window.showInputBox({
          placeHolder: "",
          validateInput(input) {
            if (/^\d+$/.test(input.trim())) {
              return null;
            }
            return localize("validator.interger");
          }
        });
        if (releaseCount === undefined) {
          return;
        }
        return handler(parseInt(releaseCount, 10), uri);
      }
    )
  );

  context.subscriptions.push(
    vs.commands.registerCommand("changelog.generateAll", (uri: VSCODE.Uri) => {
      return handler(0, uri);
    })
  );
}
