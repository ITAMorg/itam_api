import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { recordRequest, buildRouteKey } from '../services/metrics.service';

const SLOW_REQUEST_THRESHOLD_MS =
  Number(process.env.SLOW_REQUEST_MS) || 1000;

export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    const routePattern = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : undefined;

    const routeKey = buildRouteKey(req.method, routePattern, req.path);

    recordRequest(routeKey, res.statusCode, durationMs);

    if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn(
        {
          reqId: req.id,
          route: routeKey,
          durationMs: Math.round(durationMs),
          thresholdMs: SLOW_REQUEST_THRESHOLD_MS,
          statusCode: res.statusCode,
        },
        'Requête lente',
      );
    }
  });

  next();
};