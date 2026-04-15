/// <reference types="vite/client" />

interface AIConfig {
  provider: 'anthropic' | 'letai' | 'custom'
  model: string
  baseUrl: string
}

interface Window {
  electronAPI: {
    saveApiKey: (key: string) => Promise<void>
    loadApiKey: () => Promise<string | null>
    clearApiKey: () => Promise<void>
    saveConfig: (config: AIConfig) => Promise<void>
    loadConfig: () => Promise<AIConfig>
    checkEdge: () => Promise<boolean>
    launchEdge: () => Promise<{ success: boolean; error?: string }>
    generateArticle: (topic: string) => Promise<{ mdPath: string; title: string }>
    cancelGenerate: () => Promise<void>
    reviewArticle: (mdPath: string) => Promise<ReviewReport>
    publishArticle: (mdPath: string, autoSubmit: boolean) => Promise<{ status: string }>
    readFile: (filePath: string) => Promise<string>
    onGenerateChunk: (cb: (chunk: string) => void) => () => void
    onScriptLog: (cb: (msg: string) => void) => () => void
  }
}

interface ReviewReport {
  title: string
  overallScore: number
  issues: ReviewIssue[]
  summary: string
  readabilityScore: number
  authenticity: string
}

interface ReviewIssue {
  type: string
  severity: 'high' | 'medium' | 'low'
  location: string
  issue: string
  suggestion: string
}

interface ArticleHistory {
  id: string
  title: string
  mdPath: string
  createdAt: number
  score?: number
}
