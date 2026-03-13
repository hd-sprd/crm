import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { reportsApi } from '../api/reports'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const PIE_COLORS = ['#e63329','#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4']

export default function Reports() {
  const { t } = useTranslation()
  const [pipeline, setPipeline] = useState({})
  const [leadsData, setLeadsData] = useState({})
  const [performance, setPerformance] = useState([])
  const [channels, setChannels] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      reportsApi.pipeline(),
      reportsApi.leads(),
      reportsApi.performance(),
      reportsApi.channels(),
    ]).then(([p, l, perf, ch]) => {
      setPipeline(p.pipeline || {})
      setLeadsData(l.leads_by_status || {})
      setPerformance(perf.performance || [])
      setChannels(ch.leads_by_channel || {})
    }).finally(() => setLoading(false))
  }, [])

  const pipelineData = Object.entries(pipeline).map(([stage, data]) => ({
    name: t(`deals.stages.${stage}`, { defaultValue: stage }),
    count: data.count,
    value: data.total_value_eur,
  }))

  const channelData = Object.entries(channels).map(([ch, count]) => ({
    name: t(`leads.sources.${ch}`, { defaultValue: ch }),
    value: count,
  }))

  const leadStatusData = Object.entries(leadsData).map(([status, count]) => ({
    name: t(`leads.statuses.${status}`, { defaultValue: status }),
    count,
  }))

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">{t('common.loading')}</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('reports.title')}</h1>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pipeline bar chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('reports.pipeline')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={pipelineData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
              <Tooltip formatter={(v) => [v, 'Deals']} />
              <Bar dataKey="count" fill="#e63329" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Acquisition channels */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('reports.channels')}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {channelData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Leads by status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('reports.leads')}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={leadStatusData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sales performance table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{t('reports.performance')}</h2>
          {performance.length === 0 ? (
            <p className="text-sm text-gray-400">{t('common.noResults')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="pb-2 font-medium">User ID</th>
                  <th className="pb-2 font-medium">{t('reports.wonDeals')}</th>
                  <th className="pb-2 font-medium">{t('reports.lostDeals')}</th>
                  <th className="pb-2 font-medium">{t('reports.totalValue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {performance.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 text-gray-700 dark:text-gray-300">#{row.user_id}</td>
                    <td className="py-2 text-green-600 font-medium">{row.won}</td>
                    <td className="py-2 text-red-500">{row.lost}</td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">EUR {Number(row.won_value_eur).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
