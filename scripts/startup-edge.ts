import { spawn } from "node:child_process";
import { sleep } from "baoyu-chrome-cdp";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const CDP_PORT = 9222;
const MAX_RETRY = 30;

console.error(`▶ 启动 Edge 浏览器（CDP 调试模式）`);

// Step 1: Kill existing Edge processes
try {
  const taskkill = spawn("taskkill", ["/F", "/IM", "msedge.exe"], {
    stdio: "ignore",
  });
  await new Promise((resolve) => taskkill.on("close", resolve));
} catch {
  // Ignore errors
}

await sleep(2000);

// Step 2: Start Edge with CDP debugging port
const edgeProcess = spawn(EDGE_PATH, [`--remote-debugging-port=${CDP_PORT}`], {
  detached: true,
  stdio: "ignore",
});

edgeProcess.unref();
console.error(`✓ Edge 进程已启动`);

// Step 3: Wait for CDP port to be ready
await sleep(3000);
console.error(`▶ 等待 CDP 端口 ${CDP_PORT} 就绪（最多 ${MAX_RETRY}s）...`);

let ready = false;
for (let i = 0; i < MAX_RETRY; i++) {
  try {
    const response = await fetch(`http://localhost:${CDP_PORT}/json/version`);
    if (response.ok) {
      console.error(`✓ CDP 连接成功`);
      ready = true;
      break;
    }
  } catch {
    // Continue retrying
  }
  await sleep(1000);
}

if (!ready) {
  console.error(`✗ CDP 端口无响应`);
  process.exit(1);
}

// Continue with rest of pipeline
console.log("CDP_READY");
