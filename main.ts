import { Octokit } from "https://cdn.skypack.dev/octokit?dts";

// Get GitHub token from environment variable
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const GITHUB_REPOSITORY = Deno.env.get("GITHUB_REPOSITORY")

const [owner, repo] = GITHUB_REPOSITORY.split("/")

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Iterate over all issues
const iterator = octokit.paginate.iterator(octokit.rest.issues.listForRepo, {
  owner: owner,
  repo: repo,
  per_page: 100,
  state: "all", // TODO: make it a flag
});

for await (const { data: issues } of iterator) {
  for (const issue of issues) {
    console.log("Issue #%d: %s", issue.number, issue.title);
  }
}

Deno.exit();
