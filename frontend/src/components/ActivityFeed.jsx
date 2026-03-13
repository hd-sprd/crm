import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import clsx from 'clsx'
import {
  EnvelopeIcon, PhoneIcon, VideoCameraIcon, PencilSquareIcon,
  ClipboardDocumentListIcon, ChatBubbleLeftIcon, UserCircleIcon,
} from '@heroicons/react/24/outline'

const TYPE_ICONS = {
  email: EnvelopeIcon,
  call: PhoneIcon,
  meeting: VideoCameraIcon,
  note: PencilSquareIcon,
  task: ClipboardDocumentListIcon,
  whatsapp: ChatBubbleLeftIcon,
}

const TYPE_COLORS = {
  email: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  call: 'text-green-500 bg-green-50 dark:bg-green-900/20',
  meeting: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
  note: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  task: 'text-gray-500 bg-gray-50 dark:bg-gray-700',
  whatsapp: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
}

export default function ActivityFeed({ activities = [], onSelect, className }) {
  const { t } = useTranslation()

  if (!activities.length) {
    return <p className="text-sm text-gray-400 py-4">{t('common.noResults')}</p>
  }

  return (
    <div className={clsx('space-y-1', className)}>
      {activities.map(activity => {
        const Icon = TYPE_ICONS[activity.type] || PencilSquareIcon
        const colorClass = TYPE_COLORS[activity.type] || TYPE_COLORS.note
        return (
          <button
            key={activity.id}
            onClick={() => onSelect?.(activity)}
            className="w-full text-left flex gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group"
          >
            <div className={clsx('flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center', colorClass)}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate leading-snug">
                  {activity.subject}
                </p>
                <span className={clsx('flex-shrink-0 text-xs mt-0.5 tabular-nums', activity.is_overdue ? 'text-red-500' : 'text-gray-400')}>
                  {activity.created_at && format(new Date(activity.created_at), 'dd.MM. HH:mm')}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400 capitalize">
                  {t(`activities.types.${activity.type}`, activity.type)}
                </span>
                {activity.assigned_user_name && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                      <UserCircleIcon className="w-3 h-3 inline" />
                      {activity.assigned_user_name}
                    </span>
                  </>
                )}
              </div>
              {activity.body && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{activity.body}</p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
