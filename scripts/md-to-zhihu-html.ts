import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { marked } from "marked";

function parseArgs(argv: string[]): { markdown?: string; title?: string } {
  const args: { markdown?: string; title?: string } = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--markdown" && argv[i + 1]) {
      args.markdown = argv[++i];
    } else if (argv[i] === "--title" && argv[i + 1]) {
      args.title = argv[++i];
    }
  }
  return args;
}

function extractTitle(content: string): string | null {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : null;
}

function extractTopics(content: string): string[] {
  const match = content.match(/<!--\s*话题[：:]\s*(.+?)\s*-->/);
  if (!match) return [];
  return match[1].split(/[,，]/).map((t) => t.trim()).filter(Boolean);
}

function wrapHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.8; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
  h1, h2, h3 { font-weight: 600; margin-top: 1.5em; }
  h1 { font-size: 1.6em; }
  h2 { font-size: 1.3em; }
  h3 { font-size: 1.1em; }
  p { margin: 1em 0; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding: 0.5em 1em; color: #666; }
  ul, ol { padding-left: 2em; }
  a { color: #0066ff; text-decoration: none; }
  img { max-width: 100%; }
  strong { font-weight: 600; }
  hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.markdown) {
    console.error("Usage: md-to-zhihu-html.ts --markdown <file.md> [--title <title>]");
    process.exit(1);
  }

  const mdPath = path.resolve(args.markdown);
  if (!fs.existsSync(mdPath)) {
    console.error(`File not found: ${mdPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(mdPath, "utf-8");

  // Extract title: CLI arg > first H1 > filename
  const title = args.title ?? extractTitle(content) ?? path.basename(mdPath, ".md");

  // Extract topics from HTML comment
  const topics = extractTopics(content);

  // Remove the H1 from body (title is separate in Zhihu editor)
  const bodyMd = content.replace(/^# .+$/m, "").trim();

  // Remove topics comment from body
  const cleanBodyMd = bodyMd.replace(/<!--\s*话题[：:].+?-->/g, "").trim();

  // Convert to HTML
  const bodyHtml = await marked(cleanBodyMd);

  // Write HTML to temp file
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zhihu-"));
  const htmlPath = path.join(tmpDir, "article.html");
  fs.writeFileSync(htmlPath, wrapHtml(bodyHtml), "utf-8");

  // Also write body-only HTML (for pasting into editor)
  const bodyHtmlPath = path.join(tmpDir, "body.html");
  fs.writeFileSync(bodyHtmlPath, bodyHtml, "utf-8");

  // Output JSON result
  const result = { title, htmlPath, bodyHtmlPath, topics };
  console.log(JSON.stringify(result));
}

main();
