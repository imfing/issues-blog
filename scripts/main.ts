import { Octokit } from "https://esm.sh/octokit@4.1.0?dts";
import { RestEndpointMethodTypes } from "https://esm.sh/@octokit/plugin-rest-endpoint-methods@13.3.0?dts";
import { format } from "jsr:@std/datetime";
import { stringify as yamlStringify } from "jsr:@std/yaml";
import { join as pathJoin } from "jsr:@std/path";
import { sanitize } from "https://deno.land/x/sanitize_filename@1.2.1/sanitize.ts";
import { parse as tomlParse } from "jsr:@std/toml";

const OUTPUT_DIR = "content/posts";
const CONFIG_FILE = "scripts/config.toml";

// Types
type IssuesListCommentsParameters =
  RestEndpointMethodTypes["issues"]["listComments"]["parameters"];
type IssuesListCommentsResponse =
  RestEndpointMethodTypes["issues"]["listComments"]["response"];
type IssuesListCommentsResponseDataType = IssuesListCommentsResponse["data"];

type IssuesListForRepoParameters =
  RestEndpointMethodTypes["issues"]["listForRepo"]["parameters"];
type IssuesListForRepoResponse =
  RestEndpointMethodTypes["issues"]["listForRepo"]["response"];
type IssuesListForRepoResponseDataType = IssuesListForRepoResponse["data"];

// Write file function
async function writeFile(path: string, text: string): Promise<void> {
  return await Deno.writeTextFile(path, text);
}

// Format date
const formatDate = (d: string) => format(new Date(d), "yyyy-MM-dd");

// Read config file in toml format, return {} if error occurs
async function readConfigFile(path: string): Promise<Record<string, unknown>> {
  try {
    const text = await Deno.readTextFile(path);
    const config = tomlParse(text);
    return Promise.resolve(config);
  } catch (error) {
    console.error(error);
    return Promise.resolve({});
  }
}

// Get GitHub token from environment variable
const GITHUB_TOKEN: string = Deno.env.get("GITHUB_TOKEN")!;
const GITHUB_REPOSITORY: string = Deno.env.get("GITHUB_REPOSITORY")!;

const [owner, repo] = GITHUB_REPOSITORY.split("/");

// Read config toml file
const config = await readConfigFile(CONFIG_FILE);

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
  baseUrl: String(config.baseUrl),
});

// Iterate over all issues
const iterator = octokit.paginate.iterator(
  octokit.rest.issues.listForRepo,
  {
    owner: owner,
    repo: repo,
    per_page: 100,
    state: config.state || "all",
  } as IssuesListForRepoParameters,
);

for await (const { data: issues } of iterator) {
  for (const issue of issues as IssuesListForRepoResponseDataType) {
    // Skip pull requests, as GitHub's REST API considers every pull request an issue
    if (issue.pull_request) {
      continue;
    }

    console.log("Issue #%d: %s", issue.number, issue.title);

    // Construct frontmatter
    const title = issue.title;
    const createDate = formatDate(issue.created_at);
    const updateDate = formatDate(issue.updated_at);
    const labels = issue.labels.map((l) => {
      if (typeof l === "object" && "name" in l) {
        return l.name!;
      }
      return l;
    }) as Array<string> || [];

    // Skip if some label is present in the excludedLabels
    const shouldSkip = labels.some(
      (l) => (config.excludedLabels as Array<string>).includes(l),
    );
    if (shouldSkip) {
      console.log("Skip...");
      continue;
    }

    const frontmatter = Object({
      "title": title,
      "date": createDate,
      "lastMod": updateDate,
      "tags": labels,
    });

    // Add `editURL` in frontmatter if enabled
    if (config.enableEditUrl) {
      frontmatter["editURL"] = issue.html_url;
    }

    const frontmatterContent = `---\n${yamlStringify(frontmatter)}\n---`;
    const issueContent = issue.body!.trim();

    // Get comments for the issue
    const resp: IssuesListCommentsResponse = await octokit.rest.issues
      .listComments({
        owner: owner,
        repo: repo,
        issue_number: issue.number,
      } as IssuesListCommentsParameters);

    const commentsContent =
      (resp.data.map((comment: IssuesListCommentsResponseDataType[number]) =>
        comment.body!
      ) || [])
        .join("\n\n").trim();

    // Construct YAML content
    const content = [frontmatterContent, issueContent, commentsContent]
      .join("\n\n").trim();

    // Write markdown file to OUTPUT_DIR
    const filename = sanitize(title);
    const outpath = pathJoin(OUTPUT_DIR, `${filename}.md`);

    await writeFile(outpath, content);
    console.log(`Write to file: ${outpath}`);
  }
}

Deno.exit();
