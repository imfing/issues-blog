# Run deno script to fetch issues into Markdown files
# Make sure `GITHUB_TOKEN` and `GITHUB_REPOSITORY` are set
fetch:
	deno run --allow-net --allow-env --allow-read --allow-write scripts/main.ts

# Run hugo development server
dev: fetch
	hugo server -D

# Build the site, using the markdown files from the `fetch` target
build: fetch
	hugo --gc --minify

# Clean up generated files
clean:
	rm -rf public/
	find content/posts -type f -name "*.md" ! -name "_index.md" -delete
