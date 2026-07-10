import { Route, Routes } from 'react-router-dom'
import { CalendarPage } from './features/calendar/CalendarPage'
import { TrackingPage } from './features/tracking/TrackingPage'
import { TasksPage } from './features/tasks/TasksPage'
import { StatsPage } from './features/stats/StatsPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { AssistantPage } from './features/assistant/AssistantPage'
import { AISettingsPage } from './features/settings/AISettingsPage'

export function AppRoutes(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<CalendarPage />} />
      <Route path="/tracking" element={<TrackingPage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/stats" element={<StatsPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/assistant" element={<AssistantPage />} />
      <Route path="/settings" element={<AISettingsPage />} />
    </Routes>
  )
}
