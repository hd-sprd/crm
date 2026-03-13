import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from '@dnd-kit/core'
import { Bars3Icon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const STAGE_COLORS = {
  lead_received: 'bg-gray-100 dark:bg-gray-700',
  lead_qualification: 'bg-blue-50 dark:bg-blue-900/20',
  account_created: 'bg-blue-100 dark:bg-blue-900/30',
  needs_assessment: 'bg-indigo-50 dark:bg-indigo-900/20',
  feasibility_check: 'bg-purple-50 dark:bg-purple-900/20',
  quote_preparation: 'bg-yellow-50 dark:bg-yellow-900/20',
  quote_sent: 'bg-yellow-100 dark:bg-yellow-900/30',
  negotiation: 'bg-orange-50 dark:bg-orange-900/20',
  order_confirmed: 'bg-green-50 dark:bg-green-900/20',
  order_created_erp: 'bg-green-100 dark:bg-green-900/30',
  artwork_approval: 'bg-teal-50 dark:bg-teal-900/20',
  production_planning: 'bg-teal-100 dark:bg-teal-900/30',
  in_production: 'bg-cyan-50 dark:bg-cyan-900/20',
  quality_check: 'bg-sky-50 dark:bg-sky-900/20',
  shipped: 'bg-lime-50 dark:bg-lime-900/20',
  invoice_created: 'bg-emerald-50 dark:bg-emerald-900/20',
  payment_received: 'bg-emerald-100 dark:bg-emerald-900/30',
  deal_closed_won: 'bg-green-200 dark:bg-green-900/50',
  lost: 'bg-red-50 dark:bg-red-900/20',
  on_hold: 'bg-gray-200 dark:bg-gray-600/30',
}

const KANBAN_STAGES = [
  'lead_received', 'lead_qualification', 'needs_assessment',
  'feasibility_check', 'quote_preparation', 'quote_sent',
  'negotiation', 'order_confirmed', 'artwork_approval',
  'in_production', 'shipped', 'invoice_created', 'deal_closed_won',
]

function CardContent({ deal }) {
  return (
    <>
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{deal.title}</p>
      {deal.value_eur && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          EUR {Number(deal.value_eur).toLocaleString()}
        </p>
      )}
      {deal.probability > 0 && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
            <div className="bg-brand-600 h-1 rounded-full" style={{ width: `${deal.probability}%` }} />
          </div>
        </div>
      )}
    </>
  )
}

function DraggableCard({ deal, isActive }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef } = useDraggable({ id: deal.id })

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 transition-opacity',
        isActive ? 'opacity-30' : 'hover:shadow-md',
      )}
    >
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/deals/${deal.id}`)}>
          <CardContent deal={deal} />
        </div>
        <button
          {...attributes} {...listeners}
          className="flex-shrink-0 mt-0.5 p-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none select-none"
          onClick={e => e.stopPropagation()}
          title="Drag to change stage"
        >
          <Bars3Icon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function DroppableColumn({ stage, children, label, count, colorClass }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage })
  return (
    <div className="flex-shrink-0 w-64">
      <div className={clsx('rounded-t-lg px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200', colorClass)}>
        {label}
        <span className="ml-1 text-gray-400">({count})</span>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          'space-y-2 mt-2 min-h-[120px] rounded-b-lg p-1 transition-colors',
          isOver ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-300 dark:ring-blue-600' : '',
        )}
      >
        {children}
      </div>
    </div>
  )
}

export default function Pipeline({ deals = [], onStageChange }) {
  const { t } = useTranslation()
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const byStage = KANBAN_STAGES.reduce((acc, stage) => {
    acc[stage] = deals.filter(d => d.stage === stage)
    return acc
  }, {})

  const activeDeal = activeId ? deals.find(d => d.id === activeId) : null

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over || !active) return
    const deal = deals.find(d => d.id === active.id)
    const newStage = over.id
    if (deal && newStage !== deal.stage) {
      onStageChange?.(deal.id, newStage)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_STAGES.map(stage => (
          <DroppableColumn
            key={stage}
            stage={stage}
            label={t(`deals.stages.${stage}`)}
            count={byStage[stage].length}
            colorClass={STAGE_COLORS[stage]}
          >
            {byStage[stage].map(deal => (
              <DraggableCard key={deal.id} deal={deal} isActive={deal.id === activeId} />
            ))}
          </DroppableColumn>
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDeal && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-blue-400 p-3 w-64 rotate-1 opacity-95">
            <CardContent deal={activeDeal} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
