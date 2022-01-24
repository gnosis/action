import * as core from "@actions/core";
import * as github from "@actions/github";
import fs from "fs-extra";
import * as gitUtils from "./gitUtils";
import { createGithubReleases, runVersion } from "./run";
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

  console.log("setting GitHub credentials");
  await fs.writeFile(
    `${process.env.HOME}/.netrc`,
    `machine github.com\nlogin github-actions[bot]\npassword ${githubToken}`,
  );

  let { changesets } = await readChangesetState();

  let hasChangesets = changesets.length !== 0;

  core.setOutput("published", "false");
  core.setOutput("publishedPackages", "[]");
  core.setOutput("hasChangesets", String(hasChangesets));

  // If the action is manually dispatched, then it's time to publish releases to github
  let manuallyDispatched = github.context.eventName === "workflow_dispatch";
  switch (true) {
    default:
      console.log("The action doesn't know what to do.. No changesets found");
      return;
    case !hasChangesets && manuallyDispatched: {
      console.log("No changesets found, attempting to publish any unpublished releases to GitHub");

      const result = await createGithubReleases({
        githubToken,
      });

      if (result.published) {
        core.setOutput("published", "true");
        core.setOutput("publishedPackages", JSON.stringify(result.publishedPackages));
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
