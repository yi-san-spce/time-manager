import type Database from 'better-sqlite3'

/**
 * 阶段12：AI 对话（Agent 工具调用）。
 * - agent_conversation：一条对话线。scope='global' 为全局助手；scope='task' 绑定某任务（task_id）。
 * - agent_message：对话消息，含工具调用记录（tool_calls JSON / tool_call_id），
 *   用于恢复历史对话与审计 AI 做过的操作。
 * status 字段记录消息层面的确认态（如写类工具的 pending/confirmed/cancelled），供 UI 渲染确认卡片。
 */
export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE agent_conversation (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      task_id TEXT REFERENCES task(id) ON DELETE CASCADE,
      title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX idx_agent_conversation_task ON agent_conversation(task_id);

    CREATE TABLE agent_message (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES agent_conversation(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      tool_calls TEXT,
      tool_call_id TEXT,
      status TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX idx_agent_message_conversation ON agent_message(conversation_id);
  `)
}
