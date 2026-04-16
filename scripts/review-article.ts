import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

interface ReviewIssue {
  type:
    | "exaggeration"
    | "ai-tone"
    | "unreal"
    | "time-error"
    | "formality"
    | "confidence";
  severity: "high" | "medium" | "low";
  location: string; // 段落或句子
  issue: string;
  suggestion: string;
}

interface ReviewReport {
  title: string;
  overallScore: number; // 0-100
  issues: ReviewIssue[];
  summary: string;
  readabilityScore: number;
  authenticity: string;
}

function emitStep(step: number, label: string): void {
  console.error(`__STEP__review:${step}:${label}`);
}

async function reviewArticle(filePath: string): Promise<ReviewReport> {
  emitStep(1, "读取文章");
  const content = fs.readFileSync(filePath, "utf-8");

  // Extract title and body
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1] : "Unknown";
  const body = content.replace(/^#.*$/m, "").trim();

  const client = new Anthropic();

  console.error("▶ 阶段二：内容审核开始");
  console.error("");

  // 问题 1: 检测夸大表述
  emitStep(2, "检查表述准确性");
  console.error("检查中：夸大表述检测...");
  const exaggerationCheck = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `分析以下技术文章，找出夸大或绝对化的表述。返回JSON格式。

文章：
${body.substring(0, 2000)}

检查项：
1. 是否有"最好、最强、唯一、永远、从不"等绝对化表述
2. 是否有未验证的性能声称（如"性能提升10倍"）
3. 是否有过度自信的结论

返回格式：
{
  "issues": [
    {"text": "具体表述", "reason": "为什么是夸大", "fix": "建议修改为"}
  ],
  "hasMajorIssues": true/false
}`,
      },
    ],
  });

  let exaggerationIssues = [];
  try {
    const exaggerationText =
      exaggerationCheck.content[0].type === "text"
        ? exaggerationCheck.content[0].text
        : "";
    const jsonMatch = exaggerationText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      exaggerationIssues = parsed.issues || [];
    }
  } catch (e) {
    // Skip parse errors
  }

  // 问题 2: AI味检测
  emitStep(3, "检测 AI 腔调");
  console.error("检查中：AI生成痕迹检测...");
  const aiToneCheck = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `分析这段技术文章，找出AI生成的常见特征。返回JSON。

文章片段：
${body.substring(0, 1500)}

AI生成的常见特征：
- 过度使用"让我们、我们来、首先、然后、最后"等机械式连接词
- "综合来看、不难看出、需要注意的是"等模板句
- 列表式结构过多，缺少自然的叙述
- 没有个人观点或主观评价
- 措辞过于正式，缺少口语化表达
- 不必要的重复解释

返回格式：
{
  "aiToneIssues": [
    {"sentence": "具体句子", "problem": "AI特征描述", "humanize": "改为更自然的表达"}
  ],
  "aiScorePercentage": 60
}`,
      },
    ],
  });

  let aiToneIssues = [];
  let aiScore = 0;
  try {
    const aiToneText =
      aiToneCheck.content[0].type === "text" ? aiToneCheck.content[0].text : "";
    const jsonMatch = aiToneText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      aiToneIssues = parsed.aiToneIssues || [];
      aiScore = parsed.aiScorePercentage || 0;
    }
  } catch (e) {
    // Skip parse errors
  }

  // 问题 3: 时间真实性检查
  console.error("检查中：时间真实性核对...");
  const timeMatches = body.match(
    /(\d{4}年\d{1,2}月|\d{4}-\d{2}|最近|上周|上月|今年|去年|前几天|几周前)/g
  );
  const timeIssues = [];

  if (timeMatches) {
    const timeCheck = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `文章中提到的时间表述，根据你的知识截止日期（2025年1月）进行真实性检查。

时间表述：${timeMatches.join(", ")}

判断：
1. 这些时间点是否合理（相对于2025年1月）
2. 如果涉及"最近、上周"等相对时间，在发布时是否仍然准确

返回格式：
{
  "timeIssues": [
    {"timePhrase": "具体表述", "problem": "问题", "suggestion": "改为"}
  ]
}`,
        },
      ],
    });

    try {
      const timeText =
        timeCheck.content[0].type === "text" ? timeCheck.content[0].text : "";
      const jsonMatch = timeText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        timeIssues.push(...(parsed.timeIssues || []));
      }
    } catch (e) {
      // Skip parse errors
    }
  }

  // 问题 4: 综合真实性和人文度评估
  emitStep(4, "生成综合评分");
  console.error("检查中：综合评估...");
  const overallReview = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `作为资深技术博主的编辑，评估这篇文章的"人味度"和真实性。

文章标题：${title}
文章摘要：
${body.substring(0, 1500)}

评估维度：
1. **真实性（0-100）**：数据、例子、结论是否可信
2. **人味度（0-100）**：是否像真人写的（有主观观点、犯过错误的教训、具体细节）
3. **易读性（0-100）**：段落结构、例子质量、解释清晰度

关键改进点（最多5个，按优先级）：
- 如果过于生硬，建议加入个人经历
- 如果数据没引用，建议补充来源
- 如果过度肯定，建议加入"但是"或"陷阱"
- 如果措辞太学术，建议口语化

返回格式：
{
  "authenticityScore": 75,
  "humanTouchScore": 65,
  "readabilityScore": 80,
  "keyImprovements": [
    {"priority": 1, "issue": "...", "action": "..."}
  ],
  "summary": "整体评价..."
}`,
      },
    ],
  });

  let authenticityScore = 70;
  let humanTouchScore = 70;
  let readabilityScore = 80;
  let keyImprovements = [];
  let summary = "";

  try {
    const overallText =
      overallReview.content[0].type === "text"
        ? overallReview.content[0].text
        : "";
    const jsonMatch = overallText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      authenticityScore = parsed.authenticityScore || 70;
      humanTouchScore = parsed.humanTouchScore || 70;
      readabilityScore = parsed.readabilityScore || 80;
      keyImprovements = parsed.keyImprovements || [];
      summary = parsed.summary || "";
    }
  } catch (e) {
    // Skip parse errors
  }

  // 编译所有问题
  const allIssues: ReviewIssue[] = [];

  exaggerationIssues.forEach((issue: any) => {
    allIssues.push({
      type: "exaggeration",
      severity: "high",
      location: issue.text.substring(0, 50),
      issue: issue.reason,
      suggestion: issue.fix,
    });
  });

  aiToneIssues.forEach((issue: any) => {
    allIssues.push({
      type: "ai-tone",
      severity: "medium",
      location: issue.sentence.substring(0, 50),
      issue: issue.problem,
      suggestion: issue.humanize,
    });
  });

  timeIssues.forEach((issue: any) => {
    allIssues.push({
      type: "time-error",
      severity: "high",
      location: issue.timePhrase,
      issue: issue.problem,
      suggestion: issue.suggestion,
    });
  });

  // 计算综合评分
  const overallScore = Math.round(
    (authenticityScore * 0.4 + humanTouchScore * 0.4 + readabilityScore * 0.2)
  );

  emitStep(5, "审核完成");

  return {
    title,
    overallScore,
    issues: allIssues,
    summary,
    readabilityScore,
    authenticity: `真实度 ${authenticityScore}/100，人味度 ${humanTouchScore}/100`,
  };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: review-article.ts <markdown-file>");
    process.exit(1);
  }

  const report = await reviewArticle(filePath);

  console.error("");
  console.error("========== 审核报告 ==========");
  console.error(`标题：${report.title}`);
  console.error(`综合评分：${report.overallScore}/100`);
  console.error(`${report.authenticity}`);
  console.error("");

  if (report.issues.length > 0) {
    console.error("发现问题：");
    report.issues.forEach((issue, idx) => {
      console.error(
        `${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.type}`
      );
      console.error(`   位置：${issue.location}`);
      console.error(`   问题：${issue.issue}`);
      console.error(`   建议：${issue.suggestion}`);
      console.error("");
    });
  } else {
    console.error("✓ 未发现明显问题");
    console.error("");
  }

  console.error("总体评价：");
  console.error(report.summary);
  console.error("==========================================");

  // Output JSON for programmatic use
  console.log(JSON.stringify(report, null, 2));
}

main();
