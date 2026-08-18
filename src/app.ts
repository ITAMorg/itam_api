import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { httpLogger } from './config/logger';
import { metricsMiddleware } from './middleware/metrics.middleware';
import {
  notFoundHandler,
  errorHandler,
} from './middleware/error.middleware';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import assetRoutes from './routes/asset.routes';
import ticketRoutes from './routes/ticket.routes';
import userRoutes from './routes/user.routes';
import locationRoutes from './routes/location.routes';
import supplierRouter from './routes/supplier.routes';
import assetTypeRouter from './routes/asset_type.routes';
import statsRouter from './routes/stats.routes';

const app = express();

app.use(helmet());
app.use(cors());

// Journalisation structurée des requêtes HTTP
app.use(httpLogger);

// Mesure de latence et alimentation des compteurs
app.use(metricsMiddleware);

app.use(express.json());

// Sondes de supervision
app.use(healthRoutes);

// Routes applicatives
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/suppliers', supplierRouter);
app.use('/api/asset-types', assetTypeRouter);
app.use('/api/stats', statsRouter);

// Traitement des erreurs
app.use(notFoundHandler);
app.use(errorHandler);

export default app;