import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from '@dnd-kit/core'
import { Bars3Icon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

// Map stage color names to Tailwind bg classes
const COLOR_MAP = {
  gray:   'bg-gray-100 dark:bg-gray-700',
  slate:  'bg-slate-100 dark:bg-slate-700/50',
  red:    'bg-red-50 dark:bg-red-900/20',
  orange: 'bg-orange-50 dark:bg-orange-900/20',
  amber:  'bg-amber-50 dark:bg-amber-900/20',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/20',
  lime:   'bg-lime-50 dark:bg-lime-900/20',
  green:  'bg-green-50 dark:bg-green-900/20',
  teal:   'bg-teal-50 dark:bg-teal-900/20',
  cyan:   'bg-cyan-50 dark:bg-cyan-900/20',
  sky:    'bg-sky-50 dark:bg-sky-900/20',
  blue:   'bg-blue-50 dark:bg-blue-900/20',
  indigo: 'bg-indigo-50 dark:bg-indigo-900/20',
  violet: 'bg-violet-50 dark:bg-violet-900/20',
  purple: 'bg-purple-50 dark:bg-purple-900/20',
  pink:   'bg-pink-50 dark:bg-pink-900/20',
}

function CardContent({ deal }) {
  return (
    <>
      <p className="text-xs font-medium text-gray-900 dark:text-white truncate leading-tight">{deal.title}</p>
      {deal.value_eur && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
          {deal.currency || 'EUR'} {Number(deal.value_eur).toLocaleString()}
        </p>
      )}
      {deal.probability > 0 && (
        <div className="mt-1.5">
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
        'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-2 transition-opacity w-40 flex-shrink-0',
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
          <Bars3Icon className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

function DroppableColumn({ stageKey, children, label, count, colorClass }) {
  const { isOver, setNodeRef } = useDroppable({ id: stageKey })
  return (
    <div className="flex items-start gap-2">
      <div className={clsx(
        'w-44 flex-shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-200 leading-tight',
        colorClass,
      )}>
        <span className="block truncate">{label}</span>
        <span className="text-gray-400 font-normal">{count} deal{count !== 1 ? 's' : ''}</span>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 flex flex-wrap gap-2 min-h-[52px] rounded-lg p-1.5 transition-colors',
          isOver ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-300 dark:ring-blue-600' : 'bg-gray-50/50 dark:bg-gray-700/20',
        )}
      >
        {children}
      </div>
    </div>
  )
}

// stages: array of WorkflowStage objects {key, label_en, label_de, color, is_won, is_lost, stage_order, ...}
export default function Pipeline({ deals = [], stages = [], onStageChange }) {
  const { i18n } = useTranslation()
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Show regular stages always; show won/lost stages only when deals are present in them (e.g. active stage filter)
  const displayStages = stages.filter(s =>
    s.is_active !== false && (!s.is_won && !s.is_lost || deals.some(d => d.stage === s.key))
  )

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

  const getLabel = (stage) => i18n.language === 'de' ? stage.label_de : stage.label_en
  const getColor = (stage) => COLOR_MAP[stage.color] || COLOR_MAP.gray

  if (displayStages.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">No stages configured for this workflow.</p>
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="space-y-1.5">
        {displayStages.map(stage => (
          <DroppableColumn
            key={stage.key}
            stageKey={stage.key}
            label={getLabel(stage)}
            count={deals.filter(d => d.stage === stage.key).length}
            colorClass={getColor(stage)}
          >
            {deals.filter(d => d.stage === stage.key).map(deal => (
              <DraggableCard key={deal.id} deal={deal} isActive={deal.id === activeId} />
            ))}
          </DroppableColumn>
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDeal && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-blue-400 p-2 w-40 rotate-1 opacity-95">
            <CardContent deal={activeDeal} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
