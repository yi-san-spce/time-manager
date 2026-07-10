import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

/** 把 Markdown 渲染成 HTML 字符串（用于任务详情/报告预览）。同步解析，无异步。 */
export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string
}
