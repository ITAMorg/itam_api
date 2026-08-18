const LATENCY_WINDOW_SIZE = 500;
const EXCLUDED_PATHS = ['/health', '/health/ready', '/metrics'];

interface RouteMetrics {
  count: number;
  errors: number;
  latencies: number[];
}

interface MetricsState {
  startedAt: number;
  totalRequests: number;
  statusClasses: Record<string, number>;
  routes: Map<string, RouteMetrics>;
}

const state: MetricsState = {
  startedAt: Date.now(),
  totalRequests: 0,
  statusClasses: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  routes: new Map(),
};

export const buildRouteKey = (
  method: string,
  routePattern: string | undefined,
  fallbackPath: string,
): string => `${method} ${routePattern ?? fallbackPath}`;

export const recordRequest = (
  routeKey: string,
  statusCode: number,
  durationMs: number,
): void => {
  if (EXCLUDED_PATHS.some((p) => routeKey.endsWith(p))) return;

  state.totalRequests += 1;

  const statusClass = `${Math.floor(statusCode / 100)}xx`;
  if (statusClass in state.statusClasses) {
    state.statusClasses[statusClass] += 1;
  }

  let route = state.routes.get(routeKey);
  if (!route) {
    route = { count: 0, errors: 0, latencies: [] };
    state.routes.set(routeKey, route);
  }

  route.count += 1;
  if (statusCode >= 500) route.errors += 1;

  route.latencies.push(durationMs);
  if (route.latencies.length > LATENCY_WINDOW_SIZE) {
    route.latencies.shift();
  }
};

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

export interface RouteReport {
  route: string;
  count: number;
  errors: number;
  errorRate: number;
  latencyMs: { p50: number; p95: number; max: number };
}

export interface MetricsReport {
  timestamp: string;
  uptimeSeconds: number;
  requests: {
    total: number;
    byStatusClass: Record<string, number>;
    errorRate: number;
  };
  latencyMs: { p50: number; p95: number };
  routes: RouteReport[];
  process: {
    memoryHeapUsedMb: number;
    memoryRssMb: number;
  };
}

export const getMetrics = (): MetricsReport => {
  const allLatencies: number[] = [];
  const routes: RouteReport[] = [];

  for (const [route, m] of state.routes.entries()) {
    allLatencies.push(...m.latencies);

    routes.push({
      route,
      count: m.count,
      errors: m.errors,
      errorRate: m.count > 0 ? Number((m.errors / m.count).toFixed(4)) : 0,
      latencyMs: {
        p50: percentile(m.latencies, 50),
        p95: percentile(m.latencies, 95),
        max: m.latencies.length > 0 ? Math.max(...m.latencies) : 0,
      },
    });
  }

  routes.sort((a, b) => b.count - a.count);

  const serverErrors = state.statusClasses['5xx'];
  const memory = process.memoryUsage();
  const toMb = (bytes: number): number =>
    Number((bytes / 1024 / 1024).toFixed(1));

  return {
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
    requests: {
      total: state.totalRequests,
      byStatusClass: { ...state.statusClasses },
      errorRate:
        state.totalRequests > 0
          ? Number((serverErrors / state.totalRequests).toFixed(4))
          : 0,
    },
    latencyMs: {
      p50: percentile(allLatencies, 50),
      p95: percentile(allLatencies, 95),
    },
    routes,
    process: {
      memoryHeapUsedMb: toMb(memory.heapUsed),
      memoryRssMb: toMb(memory.rss),
    },
  };
};

export const resetMetrics = (): void => {
  state.startedAt = Date.now();
  state.totalRequests = 0;
  state.statusClasses = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  state.routes.clear();
};