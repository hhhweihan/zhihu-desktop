import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execSync } from "node:child_process";
import { CdpConnection, openPageSession, sleep } from "baoyu-chrome-cdp";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_DIR = __dirname;
const CDP_PORT = 9222;

interface Args {
  markdown?: string;
  submit?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--markdown" && argv[i + 1]) args.markdown = argv[++i];
    else if (arg === "--submit") args.submit = true;
  }
  return args;
}

function log(msg: string) {
  console.error(msg);
}

async function main() {
  const args = parseArgs(process.argv);
  let markdownFile = args.markdown || ".";

  // Step 1: Start Edge
  log("▶ 步骤 1: 启动 Edge 浏览器（CDP 调试模式）");
  try {
    const startup = execSync(
      `npx -y bun "${SCRIPT_DIR}/startup-edge.ts"`,
      { encoding: "utf-8", stdio: "pipe" }
    );
    if (!startup.includes("CDP_READY")) {
      log("✗ Edge 启动失败");
      process.exit(1);
    }
  } catch (err) {
    log(`✗ Edge 启动失败: ${err}`);
    process.exit(1);
  }

  // Step 2: Process markdown file
  log("▶ 步骤 2: 转换 Markdown 为 HTML");
  if (fs.statSync(markdownFile).isDirectory()) {
    const files = fs.readdirSync(markdownFile).filter((f) => f.endsWith(".md"));
    if (files.length === 0) {
      log("✗ 目录中没有找到 .md 文件");
      process.exit(1);
    }
    markdownFile = path.join(markdownFile, files[0]);
  }

  let conversionOutput: {
    title: string;
    bodyHtmlPath: string;
    topics: string[];
  };
  try {
    const output = execSync(
      `npx -y bun "${SCRIPT_DIR}/md-to-zhihu-html.ts" --markdown "${markdownFile}"`,
      { encoding: "utf-8", stdio: "pipe" }
    );
    conversionOutput = JSON.parse(output);
  } catch (err) {
    log(`✗ Markdown 转换失败: ${err}`);
    process.exit(1);
  }

  const { title, bodyHtmlPath, topics } = conversionOutput;
  log(`✓ Markdown 转换完成`);
  log(`✓ 标题: ${title}`);
  log(`✓ 话题: ${topics.join(", ")}`);

  // Step 3: Fill title and content
  log("▶ 步骤 3: 填充标题和正文到知乎编辑器");
  const publishArgs = [`--html`, bodyHtmlPath, `--title`, title];
  if (args.submit) publishArgs.push("--submit");

  try {
    const output = execSync(
      `npx -y bun "${SCRIPT_DIR}/zhihu-publish.ts" ${publishArgs
        .map((a) => `"${a}"`)
        .join(" ")}`,
      { encoding: "utf-8", stdio: "pipe" }
    );
    // Parse last JSON from output (suppress error messages)
    const jsonMatch = output.match(/\{[^{}]*"status"[^{}]*\}/);
    if (jsonMatch) {
      const publishOutput = JSON.parse(jsonMatch[0]);
      if (publishOutput.status === "filled" || publishOutput.status === "published") {
        log(`✓ 填充完成`);
      }
    }
  } catch (err) {
    log(`✗ 填充失败: ${err}`);
    process.exit(1);
  }

  // Step 4: Report success
  log("▶ 步骤 4: 发布完成");
  log("");
  log("========== 发布报告 ==========");
  log(`文件: ${markdownFile}`);
  log(`标题: ${title}`);
  log(`话题: ${topics.join(", ")}`);
  log("");
  log("✓ 文章已填充到知乎编辑器");
  log("");

  if (args.submit) {
    log("✓ 文章已自动发布");
  } else {
    log("⚠ 请在浏览器中检查后手动点击「发布」");
  }

  log("==========================================");

  // Cleanup - only kill browser if auto-submitted, keep it open for manual review
  if (args.submit) {
    try {
      execSync("taskkill /F /IM msedge.exe", { stdio: "ignore" });
    } catch {
      // Ignore
    }
  } else {
    log("");
    log("💡 浏览器已保持打开状态，请完成发布后关闭");
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
