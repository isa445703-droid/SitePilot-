import { formatDate, formatNumber, type Locale } from "@/lib/i18n/config";
import type { AnalyticsPoint } from "@/lib/analytics";

/**
 * Dependency-free SVG trend chart (no charting library): bar-per-day with an
 * accessible summary table for screen readers.
 */
export function TrendChart({
  series,
  locale,
  label,
  ariaSummary,
}: {
  series: AnalyticsPoint[];
  locale: Locale;
  label: string;
  ariaSummary: string;
}) {
  if (series.length === 0) return null;

  const width = 720;
  const height = 180;
  const padding = { top: 10, right: 4, bottom: 22, left: 4 };
  const max = Math.max(1, ...series.map((point) => point.pageViews));
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const slot = innerWidth / series.length;
  const barWidth = Math.max(1, slot * 0.62);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full sm:h-56"
        role="img"
        aria-label={`${label}: ${ariaSummary}`}
        preserveAspectRatio="none"
      >
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + innerHeight * (1 - ratio)}
            y2={padding.top + innerHeight * (1 - ratio)}
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeDasharray="3 5"
          />
        ))}
        {series.map((point, index) => {
          const barHeight = (point.pageViews / max) * innerHeight;
          const x = padding.left + index * slot + (slot - barWidth) / 2;
          const y = padding.top + innerHeight - barHeight;
          return (
            <rect
              key={point.date}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(1, barHeight)}
              rx={Math.min(3, barWidth / 2)}
              fill="currentColor"
              opacity={index === series.length - 1 ? 1 : 0.55}
            >
              <title>{`${point.date}: ${formatNumber(point.pageViews, locale)}`}</title>
            </rect>
          );
        })}
        <text
          x={padding.left}
          y={height - 6}
          fontSize="11"
          fill="currentColor"
          opacity={0.6}
        >
          {formatDate(series[0].date, locale, { dateStyle: "short" })}
        </text>
        <text
          x={width - padding.right}
          y={height - 6}
          fontSize="11"
          textAnchor="end"
          fill="currentColor"
          opacity={0.6}
        >
          {formatDate(series[series.length - 1].date, locale, { dateStyle: "short" })}
        </text>
      </svg>
      <figcaption className="sr-only">{ariaSummary}</figcaption>
    </figure>
  );
}
