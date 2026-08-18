import { Router, Request, Response } from 'express';
import { checkLiveness, checkReadiness } from '../services/health.service';
import { getMetrics } from '../services/metrics.service';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json(checkLiveness());
});

router.get('/health/ready', async (_req: Request, res: Response) => {
  const report = await checkReadiness();
  const httpStatus = report.status === 'down' ? 503 : 200;

  res.status(httpStatus).json(report);
});

router.get('/metrics', (_req: Request, res: Response) => {
  res.status(200).json(getMetrics());
});

export default router;