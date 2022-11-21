import { Octokit } from "https://cdn.skypack.dev/octokit?dts";

// Get GitHub token from environment variable
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
if (!GITHUB_TOKEN) {
  console.error("GITHUB_TOKEN is not set...");
  Deno.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const { data: { login } } = await octokit.rest.users.getAuthenticated();

console.log("Hello, %s", login);

Deno.exit();
