import { Metric } from "../hooks/useDashboardData";

type MetricListProps = {
  items: Metric[];
  max?: number;
  placeholder?: string;
};

export function MetricList({ items, max = 5, placeholder = "Sin datos" }: MetricListProps) {
  if (!items.length) {
    return <div className="state-empty">{placeholder}</div>;
  }

  return (
    <div className="metric-list">
      {items.slice(0, max).map((item) => (
        <div key={item.label} className="metric-row">
          <span>{item.label}</span>
          <span>{item.count.toLocaleString("es-ES")}</span>
        </div>
      ))}
    </div>
  );
}
