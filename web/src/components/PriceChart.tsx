/** SVG-график закрытий без клиентского JS — рендерится на сервере. */

type Point = { date: string; close: number };

const W = 800;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 24, left: 8 };

const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

export function PriceChart({ series }: { series: Point[] }) {
  if (series.length < 2) {
    return <p className="text-sm text-muted">Недостаточно данных для графика.</p>;
  }

  const closes = series.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (i / (series.length - 1)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * innerH;

  const line = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.close).toFixed(1)}`).join("");
  const area = `${line}L${x(series.length - 1).toFixed(1)},${H - PAD.bottom}L${PAD.left},${H - PAD.bottom}Z`;

  const up = closes[closes.length - 1] >= closes[0];
  const color = up ? "#34d399" : "#f87171";
  const gradId = up ? "chart-up" : "chart-down";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="График цены закрытия">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <text x={PAD.left} y={H - 6} fill="#8a93a6" fontSize="12">
        {shortDate.format(new Date(`${series[0].date}T00:00:00`))}
      </text>
      <text x={W - PAD.right} y={H - 6} fill="#8a93a6" fontSize="12" textAnchor="end">
        {shortDate.format(new Date(`${series[series.length - 1].date}T00:00:00`))}
      </text>
    </svg>
  );
}
