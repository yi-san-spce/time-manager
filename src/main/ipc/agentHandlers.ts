import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/types/ipc'
import { confirmToolCall, getMessages, sendMessage } from '../services/agentService'
import {
  clearConversation,
  createGlobalConversation,
  deleteConversation,
  getOrCreateConversation,
  isGlobalConversation,
  listGlobalConversations,
  renameConversation
} from '../db/repositories/conversationRepo'
import {
  agentSendMessageSchema,
  agentConfirmToolCallSchema,
  agentGetMessagesSchema,
  agentRenameConversationSchema
} from './schemas'

export function registerAgentHandlers(): void {
  ipcMain.handle(IPC.agentSendMessage, (_event, input) => sendMessage(agentSendMessageSchema.parse(input)))

  ipcMain.handle(IPC.agentConfirmToolCall, (_event, input) =>
    confirmToolCall(agentConfirmToolCallSchema.parse(input))
  )

  ipcMain.handle(IPC.agentGetMessages, (_event, input) => {
    const parsed = agentGetMessagesSchema.parse(input)
    return getMessages(parsed.scope, parsed.taskId ?? null, parsed.conversationId ?? null)
  })

  ipcMain.handle(IPC.agentClearConversation, (_event, input) => {
    const parsed = agentGetMessagesSchema.parse(input)
    // global 指定了 conversationId 则清空该条；否则清空最近/新建的默认对话
    const id =
      parsed.scope === 'global' && parsed.conversationId && isGlobalConversation(parsed.conversationId)
        ? parsed.conversationId
        : getOrCreateConversation(parsed.scope, parsed.taskId ?? null)
    clearConversation(id)
  })

  ipcMain.handle(IPC.agentListConversations, () => listGlobalConversations())

  ipcMain.handle(IPC.agentCreateConversation, () => createGlobalConversation())

  ipcMain.handle(IPC.agentDeleteConversation, (_event, input) => {
    const id = z.string().min(1).parse(input)
    // 仅允许删 global 对话，避免误删任务对话
    if (isGlobalConversation(id)) deleteConversation(id)
  })

  ipcMain.handle(IPC.agentRenameConversation, (_event, input) => {
    const parsed = agentRenameConversationSchema.parse(input)
    if (isGlobalConversation(parsed.conversationId)) renameConversation(parsed.conversationId, parsed.title)
  })
}
