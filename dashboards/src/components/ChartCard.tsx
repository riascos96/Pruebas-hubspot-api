import { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function ChartCard({ title, description, footer, children }: ChartCardProps) {
  return (
    <section className="chart-card">
      <header>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="chart-wrapper">{children}</div>
      {footer ? <div className="metric-list">{footer}</div> : null}
    </section>
  );
}
