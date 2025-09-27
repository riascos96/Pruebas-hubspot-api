import { Bar, Chart as ChartComponent, Doughnut, Line, Pie } from "react-chartjs-2";
import type { ChartData } from "chart.js";
import { ChartCard } from "./components/ChartCard";
import { MetricList } from "./components/MetricList";
import { useDashboardData } from "./hooks/useDashboardData";
import "./chartSetup";

const palette = [
  "#2563eb",
  "#f97316",
  "#10b981",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#facc15",
  "#6366f1",
  "#ec4899",
  "#22d3ee"
];

function pickColor(index: number) {
  return palette[index % palette.length];
}

export default function App() {
  const { data, loading, error } = useDashboardData();

  if (loading) {
    return (
      <div className="app">
        <div className="state-message">
          <h2>Cargando dashboard…</h2>
          <p>Consultando métricas en PostgreSQL.</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="app">
        <div className="state-message">
          <h2>Hubo un problema</h2>
          <p>{error ?? "No fue posible cargar la información."}</p>
        </div>
      </div>
    );
  }

  const statusChart = {
    labels: data.contactsByStatus.map((metric) => metric.label),
    datasets: [
      {
        label: "Contactos",
        data: data.contactsByStatus.map((metric) => metric.count),
        backgroundColor: data.contactsByStatus.map((_, index) => pickColor(index)),
        borderWidth: 1
      }
    ]
  };

  const ownerStatusOwners = Array.from(new Set(data.contactsByOwnerStatus.map((metric) => metric.owner)));
  const ownerStatusLabels = Array.from(new Set(data.contactsByOwnerStatus.map((metric) => metric.status)));
  const ownerStatusChart = {
    labels: ownerStatusOwners,
    datasets: ownerStatusLabels.map((status, index) => ({
      label: status,
      data: ownerStatusOwners.map((owner) => {
        const match = data.contactsByOwnerStatus.find((item) => item.owner === owner && item.status === status);
        return match ? match.count : 0;
      }),
      backgroundColor: pickColor(index + 3)
    }))
  };

  const ownerBarChart = {
    labels: data.contactsByOwner.map((metric) => metric.label),
    datasets: [
      {
        label: "Contactos",
        data: data.contactsByOwner.map((metric) => metric.count),
        backgroundColor: data.contactsByOwner.map((_, index) => pickColor(index)),
        borderRadius: 6
      }
    ]
  };

  const contactsTimeline = {
    labels: data.contactsMonthly.map((metric) => metric.label),
    datasets: [
      {
        label: "Contactos creados",
        data: data.contactsMonthly.map((metric) => metric.count),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.25)",
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: "#2563eb"
      }
    ]
  };

  const timelineLabels = Array.from(
    new Set([...data.contactsMonthly, ...data.activitiesMonthly].map((metric) => metric.label))
  ).sort();
  const contactsMonthlyMap = new Map(data.contactsMonthly.map((metric) => [metric.label, metric.count]));
  const activitiesMonthlyMap = new Map(data.activitiesMonthly.map((metric) => [metric.label, metric.count]));
  const timelineComparison: ChartData<"bar" | "line", number[], string> = {
    labels: timelineLabels,
    datasets: [
      {
        type: "line" as const,
        label: "Contactos creados",
        data: timelineLabels.map((label) => contactsMonthlyMap.get(label) ?? 0),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.1)",
        tension: 0.35,
        fill: false,
        yAxisID: "y"
      },
      {
        type: "bar" as const,
        label: "Actividades registradas",
        data: timelineLabels.map((label) => activitiesMonthlyMap.get(label) ?? 0),
        backgroundColor: "#f97316",
        borderRadius: 6,
        yAxisID: "y1"
      }
    ]
  };

  const companiesOwnerChart = {
    labels: data.companiesByOwner.map((metric) => metric.label),
    datasets: [
      {
        label: "Compañías",
        data: data.companiesByOwner.map((metric) => metric.count),
        backgroundColor: data.companiesByOwner.map((_, index) => pickColor(index + 2)),
        borderRadius: 6
      }
    ]
  };

  const activitiesPie = {
    labels: data.activitiesByType.map((metric) => metric.label),
    datasets: [
      {
        label: "Actividades",
        data: data.activitiesByType.map((metric) => metric.count),
        backgroundColor: data.activitiesByType.map((_, index) => pickColor(index)),
        borderWidth: 1
      }
    ]
  };

  const summaryItems = [
    { label: "Contactos", value: data.summary.contacts.toLocaleString("es-ES") },
    { label: "Compañías", value: data.summary.companies.toLocaleString("es-ES") },
    { label: "Actividades", value: data.summary.activities.toLocaleString("es-ES") },
    { label: "Deals en raw", value: data.summary.deals.toLocaleString("es-ES") },
    { label: "Owners activos", value: data.summary.contactOwners.toLocaleString("es-ES") },
    {
      label: "Tasa de conversión",
      value: data.kpis.conversionRate !== null ? `${(data.kpis.conversionRate * 100).toFixed(1)}%` : "—"
    },
    {
      label: "Contactos por owner",
      value: data.kpis.averageContactsPerOwner !== null ? data.kpis.averageContactsPerOwner.toFixed(1) : "—"
    },
    {
      label: "Actividades por contacto",
      value: data.kpis.activitiesPerContact !== null ? data.kpis.activitiesPerContact.toFixed(1) : "—"
    }
  ];

  return (
    <div className="app">
      <div className="page-header">
        <h1>Dashboard HubSpot con Postgres</h1>
        <p>
          Visualización de indicadores clave a partir de las tablas normalizadas en PostgreSQL.
        </p>
      </div>

      <div className="summary-grid">
        {summaryItems.map((item) => (
          <article key={item.label} className="summary-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="grid">
        <ChartCard title="Contactos por estado" description="Distribución de contactos según lead status">
          {data.contactsByStatus.length ? (
            <Doughnut data={statusChart} options={{ responsive: true, plugins: { legend: { position: "bottom" } } }} />
          ) : (
            <div className="state-empty">No hay datos suficientes</div>
          )}
        </ChartCard>

        <ChartCard
          title="Top owners de contactos"
          description="Diez propietarios con más contactos activos"
          footer={<MetricList items={data.contactsByOwner} max={10} />}
        >
          {data.contactsByOwner.length ? (
            <Bar
              data={ownerBarChart}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: "#475569" } },
                  y: { ticks: { color: "#475569" }, beginAtZero: true }
                }
              }}
            />
          ) : (
            <div className="state-empty">No hay datos suficientes</div>
          )}
        </ChartCard>

        <ChartCard
          title="Mix de estados por owner"
          description="Distribución de lead status en los cinco principales owners"
        >
          {ownerStatusOwners.length > 0 && ownerStatusLabels.length > 0 ? (
            <Bar
              data={ownerStatusChart}
              options={{
                responsive: true,
                plugins: { legend: { position: "bottom" } },
                scales: {
                  x: { stacked: true, ticks: { color: "#475569" } },
                  y: { stacked: true, ticks: { color: "#475569" }, beginAtZero: true }
                }
              }}
            />
          ) : (
            <div className="state-empty">No hay datos suficientes</div>
          )}
        </ChartCard>

        <ChartCard
          title="Nuevos contactos por mes"
          description="Últimos 12 meses según fecha de creación"
        >
          {data.contactsMonthly.length ? (
            <Line
              data={contactsTimeline}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: "#475569" } },
                  y: { ticks: { color: "#475569" }, beginAtZero: true }
                }
              }}
            />
          ) : (
            <div className="state-empty">No hay datos suficientes</div>
          )}
        </ChartCard>

        <ChartCard
          title="Contactos vs actividades"
          description="Comparativo mensual de creación de contactos frente a actividades registradas"
        >
          {timelineLabels.length > 0 ? (
            <ChartComponent
              type="bar"
              data={timelineComparison}
              options={{
                responsive: true,
                interaction: { mode: "index", intersect: false },
                plugins: { legend: { position: "bottom" } },
                scales: {
                  x: { ticks: { color: "#475569" } },
                  y: {
                    position: "left",
                    title: { display: true, text: "Contactos", color: "#475569" },
                    ticks: { color: "#475569" },
                    beginAtZero: true
                  },
                  y1: {
                    position: "right",
                    title: { display: true, text: "Actividades", color: "#475569" },
                    ticks: { color: "#475569" },
                    beginAtZero: true,
                    grid: { drawOnChartArea: false }
                  }
                }
              }}
            />
          ) : (
            <div className="state-empty">No hay datos suficientes</div>
          )}
        </ChartCard>

        <ChartCard
          title="Compañías por owner"
          description="Top 10 propietarios con más compañías"
          footer={<MetricList items={data.companiesByOwner} max={10} />}
        >
          {data.companiesByOwner.length ? (
            <Bar
              data={companiesOwnerChart}
              options={{
                indexAxis: "y" as const,
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: "#475569" }, beginAtZero: true },
                  y: { ticks: { color: "#475569" } }
                }
              }}
            />
          ) : (
            <div className="state-empty">No hay datos suficientes</div>
          )}
        </ChartCard>

        <ChartCard title="Actividades por tipo" description="Conteo según objeto de actividad">
          {data.activitiesByType.length ? (
            <Pie data={activitiesPie} options={{ responsive: true, plugins: { legend: { position: "bottom" } } }} />
          ) : (
            <div className="state-empty">No hay datos suficientes</div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
