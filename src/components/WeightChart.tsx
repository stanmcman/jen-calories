import { useEffect, useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  type Plugin,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { WeightLog } from '../db'
import { parseISO } from '../lib/dates'

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Filler)

const DAY = 86_400_000

/** Read the current theme's colors, and re-read when Light/Dark changes. */
function useThemeColors() {
  const read = () => {
    const cs = getComputedStyle(document.documentElement)
    const v = (n: string) => cs.getPropertyValue(n).trim()
    return { line: v('--chart-line'), ink: v('--ink'), muted: v('--muted'), grid: v('--line'), surface: v('--surface-solid'), good: v('--good') }
  }
  const [c, setC] = useState(read)
  useEffect(() => {
    const update = () => setC(read())
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', update)
    return () => {
      mo.disconnect()
      mq.removeEventListener('change', update)
    }
  }, [])
  return c
}

export type Range = '1m' | '3m' | '6m' | 'all'
const RANGE_DAYS: Record<Range, number> = { '1m': 30, '3m': 91, '6m': 182, all: Infinity }

type Ref = { value: number; label: string; color: string; dash: number[] }

/** Horizontal reference lines (start, goal) with labels on the right, plus a hover crosshair. */
const overlays: Plugin<'line'> = {
  id: 'overlays',
  afterDatasetsDraw(chart, _args, opts) {
    const { ctx, chartArea: a, scales } = chart
    const refs = (opts as { refs: Ref[]; crosshair: string; font: string }).refs
    ctx.save()
    for (const r of refs) {
      const y = scales.y.getPixelForValue(r.value)
      if (y < a.top - 1 || y > a.bottom + 1) continue
      ctx.strokeStyle = r.color
      ctx.lineWidth = 1.5
      ctx.setLineDash(r.dash)
      ctx.beginPath()
      ctx.moveTo(a.left, y)
      ctx.lineTo(a.right, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.font = `600 12px ${(opts as { font: string }).font}`
      ctx.fillStyle = r.color
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(r.label, a.right - 2, y - 3)
    }
    const active = chart.tooltip?.getActiveElements?.() ?? []
    if (active.length) {
      const x = active[0].element.x
      ctx.strokeStyle = (opts as { crosshair: string }).crosshair
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, a.top)
      ctx.lineTo(x, a.bottom)
      ctx.stroke()
    }
    ctx.restore()
  },
}

export default function WeightChart({
  logs,
  range,
  startLb,
  goalLb,
}: {
  logs: WeightLog[]
  range: Range
  startLb?: number
  goalLb?: number
}) {
  const c = useThemeColors()

  const points = useMemo(() => {
    const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date))
    const last = sorted.length ? parseISO(sorted[sorted.length - 1].date).getTime() : Date.now()
    const cutoff = last - RANGE_DAYS[range] * DAY
    return sorted
      .map((l) => ({ x: parseISO(l.date).getTime(), y: l.weightLb }))
      .filter((p) => range === 'all' || p.x >= cutoff)
  }, [logs, range])

  if (points.length === 0) return null

  const refs: Ref[] = []
  if (startLb !== undefined) refs.push({ value: startLb, label: `Start ${startLb}`, color: c.muted, dash: [2, 4] })
  if (goalLb !== undefined) refs.push({ value: goalLb, label: `Goal ${goalLb}`, color: c.good, dash: [6, 5] })

  const ys = [...points.map((p) => p.y), ...refs.map((r) => r.value)]
  const yMin = Math.floor((Math.min(...ys) - 1) / 5) * 5
  const yMax = Math.ceil((Math.max(...ys) + 1) / 5) * 5
  const xMin = points[0].x
  const xMax = Math.max(points[points.length - 1].x, xMin + 6 * DAY)
  const span = (xMax - xMin) / DAY
  const font = getComputedStyle(document.body).fontFamily

  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString(undefined, span > 300 ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' })

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    layout: { padding: { top: 18, right: 4 } },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    scales: {
      x: {
        type: 'linear',
        min: xMin,
        max: xMax,
        grid: { display: false },
        border: { color: c.grid },
        ticks: { color: c.muted, font: { family: font, size: 12, weight: 600 }, maxTicksLimit: 4, callback: (v) => fmtDate(Number(v)), maxRotation: 0 },
      },
      y: {
        min: yMin,
        max: yMax,
        grid: { color: c.grid },
        border: { display: false },
        ticks: { color: c.muted, font: { family: font, size: 12, weight: 600 }, stepSize: yMax - yMin > 30 ? 10 : 5, precision: 0 },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: c.ink,
        titleColor: c.surface,
        bodyColor: c.surface,
        titleFont: { family: font, weight: 600, size: 13 },
        bodyFont: { family: font, weight: 800, size: 16 },
        padding: 10,
        cornerRadius: 10,
        displayColors: false,
        callbacks: {
          title: (items) => new Date(items[0].parsed.x ?? 0).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
          label: (item) => `${item.parsed.y} lb`,
        },
      },
      // @ts-expect-error custom plugin options
      overlays: { refs, crosshair: c.muted, font },
    },
  }

  return (
    <div style={{ position: 'relative', height: 240 }}>
      <Line
        data={{
          datasets: [
            {
              data: points,
              borderColor: c.line,
              borderWidth: 2,
              tension: 0.3,
              pointRadius: points.length > 14 ? 0 : 4,
              pointHoverRadius: 6,
              pointBackgroundColor: c.line,
              pointBorderColor: c.surface,
              pointBorderWidth: 2,
              pointHitRadius: 20,
              fill: { target: 'start' },
              backgroundColor: (ctx) => {
                const { chart } = ctx
                const area = chart.chartArea
                if (!area) return 'transparent'
                const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
                g.addColorStop(0, c.line + '33')
                g.addColorStop(1, c.line + '00')
                return g
              },
            },
          ],
        }}
        options={options}
        plugins={[overlays]}
      />
    </div>
  )
}
