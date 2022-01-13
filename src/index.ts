import * as core from "@actions/core";
import fs from "fs-extra";
import * as gitUtils from "./gitUtils";
import { runPublish, runVersion } from "./run";
import readChangesetState from "./readChangesetState";

const getOptionalInput = (name: string) => core.getInput(name) || undefined;

(async () => {
  let githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    core.setFailed("Please add the GITHUB_TOKEN to the changesets action");
    return;
  }

  let setupGitUser = core.getBooleanInput("setupGitUser");

  if (setupGitUser) {
    console.log("setting git user");
    await gitUtils.setupUser();
  }

  console.log(core);
  console.log("setting GitHub credentials");
  await fs.writeFile(
    `${process.env.HOME}/.netrc`,
    `machine github.com\nlogin github-actions[bot]\npassword ${githubToken}`
  );

  let { changesets } = await readChangesetState();

  let hasChangesets = changesets.length !== 0;

  core.setOutput("published", "false");
  core.setOutput("publishedPackages", "[]");
  core.setOutput("hasChangesets", String(hasChangesets));

  switch (true) {
    case !hasChangesets:
      console.log("No changesets found");
      return;
    case !hasChangesets && hasPublishScript: {
      console.log(
        "No changesets found, attempting to publish any unpublished packages to npm"
      );

      const result = await runPublish({
        script: publishScript,
        githubToken,
      });

      if (result.published) {
        core.setOutput("published", "true");
        core.setOutput(
          "publishedPackages",
          JSON.stringify(result.publishedPackages)
        );
      }
      return;
    }
    case hasChangesets:
      await runVersion({
        script: getOptionalInput("version"),
        githubToken,
        prTitle: getOptionalInput("title"),
        commitMessage: getOptionalInput("commit"),
      });
      return;
  }
})().catch((err) => {
  console.error(err);
  core.setFailed(err.message);
});
