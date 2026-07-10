import type Database from 'better-sqlite3'

/**
 * 需求11：保存 assistant 消息的"思考摘要"，刷新/重开对话后仍可展开查看。
 * 思考文本来自 Claude 适配层的 stream + display:"summarized"（Sonnet 5 默认 omitted，必须显式开启）。
 * 可空：只读工具轮/OpenAI 供应商/思考被省略时为 NULL。
 */
export function up(db: Database.Database): void {
  db.exec('ALTER TABLE agent_message ADD COLUMN thinking TEXT;')
}
