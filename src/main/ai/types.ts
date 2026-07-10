import type {
  AnalyzeInput,
  AnalyzeResult,
  ChatInput,
  ChatResult,
  SummarizeInput,
  TestConnectionResult
} from '@shared/types/ai'

export interface AIProvider {
  testConnection(): Promise<TestConnectionResult>
  analyze(input: AnalyzeInput): Promise<AnalyzeResult>
  summarize(input: SummarizeInput): Promise<string>
  chat(input: ChatInput): Promise<ChatResult>
}
