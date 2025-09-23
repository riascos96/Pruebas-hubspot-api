import Bottleneck from "bottleneck";
import { requireEnv } from "../utils/ensureEnv.js";
import { log } from "../utils/logger.js";
const BASE = process.env.HUBSPOT_BASE_URL || "https://api.hubapi.com";
const TOKEN = requireEnv("HUBSPOT_TOKEN");
const limiter = new Bottleneck({
    minTime: 120, // ~8 req/s
    reservoir: 100, // 100 cada 10s
    reservoirRefreshAmount: 100,
    reservoirRefreshInterval: 10_000
});
// Timeout de conexión/response por request (sin dependencias externas)
const CONNECT_TIMEOUT_MS = Number(process.env.NET_CONNECT_TIMEOUT_MS || 10_000);
const PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
// Si hay proxy configurado y está disponible la librería 'undici' de usuario,
// configuramos ProxyAgent de forma opcional. Si no está instalada, simplemente se omite.
if (PROXY) {
    try {
        const undici = await Function('return import("undici")')();
        if (undici?.ProxyAgent && undici?.setGlobalDispatcher) {
            undici.setGlobalDispatcher(new undici.ProxyAgent(PROXY));
        }
    }
    catch {
        // sin 'undici' instalada, continuar sin proxy
    }
}
async function doFetch(input, init, retries = 3) {
    return limiter.schedule(async () => {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(new Error("connect/response timeout")), CONNECT_TIMEOUT_MS);
        const signal = init?.signal ? AbortSignal.any?.([init.signal, ac.signal]) ?? ac.signal : ac.signal;
        try {
            const r = await fetch(input, {
                ...init,
                signal,
                headers: {
                    Authorization: `Bearer ${TOKEN}`,
                    "Content-Type": "application/json",
                    ...(init?.headers || {})
                }
            });
            if (r.status === 429 && retries > 0) {
                const ra = Number(r.headers.get("retry-after") || 2);
                const waitMs = Math.max(ra, 2) * 1000;
                log.warn({ waitMs }, "429 rate limit -> retry");
                await new Promise(res => setTimeout(res, waitMs));
                return doFetch(input, init, retries - 1);
            }
            if (!r.ok) {
                const text = await r.text().catch(() => "");
                throw new Error(`HubSpot ${r.status} ${r.statusText} :: ${text}`);
            }
            return r;
        }
        finally {
            clearTimeout(timer);
        }
    });
}
export async function hsGetJson(path, params) {
    const url = new URL(path, BASE);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (Array.isArray(v)) {
                for (const vv of v)
                    url.searchParams.append(k, String(vv));
            }
            else {
                url.searchParams.set(k, String(v));
            }
        }
    }
    const r = await doFetch(url);
    return r.json();
}
export async function hsPostJson(path, body) {
    const url = new URL(path, BASE);
    const r = await doFetch(url, { method: "POST", body: JSON.stringify(body) });
    return r.json();
}
//# sourceMappingURL=hubspot.js.map