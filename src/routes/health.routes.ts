import { Router, Request, Response } from 'express';
import { checkLiveness, checkReadiness } from '../services/health.service';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json(checkLiveness());
});

router.get('/health/ready', async (_req: Request, res: Response) => {
  const report = await checkReadiness();
  const httpStatus = report.status === 'down' ? 503 : 200;

  res.status(httpStatus).json(report);
});

export default router;