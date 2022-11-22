import { Octokit } from "https://cdn.skypack.dev/octokit?dts";
import { RestEndpointMethodTypes } from "https://cdn.skypack.dev/@octokit/plugin-rest-endpoint-methods?dts";
import { format } from "https://deno.land/std@0.165.0/datetime/mod.ts";
import { stringify } from "https://deno.land/std@0.165.0/encoding/yaml.ts";
import { join as pathJoin } from "https://deno.land/std@0.162.0/path/mod.ts";
import { sanitize } from "https://deno.land/x/sanitize_filename@1.2.1/sanitize.ts";

async function writeFile(path: string, text: string): Promise<void> {
  return await Deno.writeTextFile(path, text);
}

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

const formatDate = (d: string) => format(new Date(d), "yyyy-MM-dd");

// Get GitHub token from environment variable
const GITHUB_TOKEN: string = Deno.env.get("GITHUB_TOKEN")!;
const GITHUB_REPOSITORY: string = Deno.env.get("GITHUB_REPOSITORY")!;

const [owner, repo] = GITHUB_REPOSITORY.split("/");

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Iterate over all issues
const iterator = octokit.paginate.iterator(
  octokit.rest.issues.listForRepo,
  {
    owner: owner,
    repo: repo,
    per_page: 100,
    state: "all", // TODO: make it a flag
  } as IssuesListForRepoParameters,
);

for await (const { data: issues } of iterator) {
  for (const issue of issues as IssuesListForRepoResponseDataType) {
    console.log("Issue #%d: %s", issue.number, issue.title);

    // Get comments for the issue
    const resp: IssuesListCommentsResponse = await octokit.rest.issues
      .listComments({
        owner: owner,
        repo: repo,
        issue_number: issue.number,
      } as IssuesListCommentsParameters);

    // Construct frontmatter
    const title = issue.title;
    const createDate = formatDate(issue.created_at);
    const updateDate = formatDate(issue.updated_at);
    const labels = issue.labels.map((l) => {
      if (typeof l === "object" && "name" in l) {
        return l.name!;
      }
      return l;
    }) || [];

    const frontmatter = stringify({
      "title": title,
      "date": createDate,
      "lastMod": updateDate,
      "tags": labels,
    });

    const frontmatterContent = `---\n${frontmatter}\n---`;
    const issueContent = issue.body!.trim();
    const commentsContent =
      (resp.data.map((comment: IssuesListCommentsResponseDataType[number]) =>
        comment.body
      ) || [])
        .join("\n\n").trim();

    const content = [frontmatterContent, issueContent, commentsContent]
      .join("\n\n");

    // Write to file
    const filename = sanitize(title);
    const outpath = pathJoin("content/posts", `${filename}.md`);

    await writeFile(outpath, content);
    console.log(`Write to file: ${outpath}`);
  }
}

Deno.exit();
