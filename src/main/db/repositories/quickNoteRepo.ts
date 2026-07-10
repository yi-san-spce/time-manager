import { getSetting, setSetting } from './settingsRepo'

/** 随心记（需求6）：单条自由文本，存 app_settings，重启仍在。 */
const QUICK_NOTE_KEY = 'floatingWidgetQuickNote'

export function getQuickNote(): string {
  return getSetting(QUICK_NOTE_KEY) ?? ''
}

export function setQuickNote(text: string): void {
  setSetting(QUICK_NOTE_KEY, text)
}
