import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import clsx from 'clsx'
import { tasksApi } from '../api/tasks'
import toast from 'react-hot-toast'

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export default function TaskList({ tasks = [], onUpdate }) {
  const { t } = useTranslation()

  const markComplete = async (task) => {
    try {
      await tasksApi.update(task.id, { status: 'completed' })
      toast.success('Task completed!')
      onUpdate?.()
    } catch {
      toast.error('Error updating task')
    }
  }

  if (!tasks.length) {
    return <p className="text-sm text-gray-400 py-4">{t('common.noResults')}</p>
  }

  return (
    <ul className="space-y-2">
      {tasks.map(task => {
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status === 'open'
        return (
          <li
            key={task.id}
            className={clsx(
              'flex items-start gap-3 p-3 rounded-lg border',
              isOverdue
                ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            )}
          >
            <input
              type="checkbox"
              checked={task.status === 'completed'}
              onChange={() => task.status === 'open' && markComplete(task)}
              className="mt-0.5 w-4 h-4 text-brand-600 rounded"
            />
            <div className="flex-1 min-w-0">
              <p className={clsx('text-sm font-medium', task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white')}>
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={clsx('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium', PRIORITY_COLORS[task.priority])}>
                  {t(`tasks.priorities.${task.priority}`)}
                </span>
                {task.due_date && (
                  <span className={clsx('text-xs', isOverdue ? 'text-red-600 font-medium' : 'text-gray-400')}>
                    {isOverdue ? `⚠ ${t('tasks.overdue')} · ` : ''}
                    {format(new Date(task.due_date), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
