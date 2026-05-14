'use client'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line, Pie } from 'react-chartjs-2'
import type { ChartVisual } from '@/types/lesson'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
)

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981']

const AXIS_OPTIONS = {
  responsive: true,
  plugins: { legend: { labels: { color: '#94a3b8' } } },
  scales: {
    x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
    y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
  },
} as const

const PIE_OPTIONS = {
  responsive: true,
  plugins: { legend: { labels: { color: '#94a3b8' } } },
} as const

export function ChartBlock({ visual }: { visual: ChartVisual }) {
  if (!visual.data?.labels || !visual.data?.datasets) {
    return (
      <div className="rounded-lg border border-violet-800/40 bg-violet-950/20 px-4 py-3 text-xs" style={{ color: 'var(--fg-4)' }}>
        Chart data unavailable — {visual.title}
      </div>
    )
  }

  const chartData = {
    labels: visual.data.labels,
    datasets: visual.data.datasets.map((ds, i) => ({
      ...ds,
      backgroundColor: COLORS[i % COLORS.length],
    })),
  }

  return (
    <div className="rounded-lg border border-violet-800/40 bg-violet-950/20 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-violet-950/40 border-b border-violet-800/40">
        <span className="text-sm">📈</span>
        <span className="text-xs font-semibold text-violet-300 uppercase tracking-widest">
          Chart — {visual.title}
        </span>
        <span className="text-xs text-muted-foreground ml-auto capitalize">{visual.chartType}</span>
      </div>
      <div className="p-6 max-h-72">
        {visual.chartType === 'bar' && <Bar data={chartData} options={AXIS_OPTIONS} />}
        {visual.chartType === 'line' && <Line data={chartData} options={AXIS_OPTIONS} />}
        {visual.chartType === 'pie' && <Pie data={chartData} options={PIE_OPTIONS} />}
      </div>
    </div>
  )
}
