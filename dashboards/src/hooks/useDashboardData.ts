import { useEffect, useState } from "react";

type Metric = { label: string; count: number };

type DashboardResponse = {
  summary: {
    contacts: number;
    companies: number;
    activities: number;
    deals: number;
    contactOwners: number;
  };
  kpis: {
    conversionRate: number | null;
    averageContactsPerOwner: number | null;
    activitiesPerContact: number | null;
  };
  contactsByStatus: Metric[];
  contactsByOwner: Metric[];
  contactsMonthly: Metric[];
  companiesByOwner: Metric[];
  activitiesByType: Metric[];
  contactsByOwnerStatus: Array<{ owner: string; status: string; count: number }>;
  activitiesMonthly: Metric[];
};

type DashboardState = {
  loading: boolean;
  error: string | null;
  data: DashboardResponse | null;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000";

export function useDashboardData(): DashboardState {
  const [state, setState] = useState<DashboardState>({ loading: true, error: null, data: null });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setState({ loading: true, error: null, data: null });
      try {
        const res = await fetch(`${API_BASE}/api/dashboard`, { signal: controller.signal });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const payload = await res.json();
        const normalized: DashboardResponse = {
          summary: {
            contacts: Number(payload?.summary?.contacts ?? 0) || 0,
            companies: Number(payload?.summary?.companies ?? 0) || 0,
            activities: Number(payload?.summary?.activities ?? 0) || 0,
            deals: Number(payload?.summary?.deals ?? 0) || 0,
            contactOwners: Number(payload?.summary?.contactOwners ?? payload?.summary?.contact_owners ?? 0) || 0
          },
          kpis: {
            conversionRate: typeof payload?.kpis?.conversionRate === "number" ? payload.kpis.conversionRate : null,
            averageContactsPerOwner:
              typeof payload?.kpis?.averageContactsPerOwner === "number" ? payload.kpis.averageContactsPerOwner : null,
            activitiesPerContact:
              typeof payload?.kpis?.activitiesPerContact === "number" ? payload.kpis.activitiesPerContact : null
          },
          contactsByStatus: Array.isArray(payload?.contactsByStatus) ? payload.contactsByStatus : [],
          contactsByOwner: Array.isArray(payload?.contactsByOwner) ? payload.contactsByOwner : [],
          contactsMonthly: Array.isArray(payload?.contactsMonthly) ? payload.contactsMonthly : [],
          companiesByOwner: Array.isArray(payload?.companiesByOwner) ? payload.companiesByOwner : [],
          activitiesByType: Array.isArray(payload?.activitiesByType) ? payload.activitiesByType : [],
          contactsByOwnerStatus: Array.isArray(payload?.contactsByOwnerStatus) ? payload.contactsByOwnerStatus : [],
          activitiesMonthly: Array.isArray(payload?.activitiesMonthly) ? payload.activitiesMonthly : []
        };
        setState({ loading: false, error: null, data: normalized });
      } catch (error) {
        if ((error as DOMException).name === "AbortError") return;
        setState({ loading: false, error: (error as Error).message || "Error cargando dashboard", data: null });
      }
    }

    load();

    return () => controller.abort();
  }, []);

  return state;
}

export type { DashboardResponse, Metric };
