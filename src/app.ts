import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
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
app.use(morgan('dev'));
app.use(express.json());


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/suppliers', supplierRouter);
app.use('/api/asset-types', assetTypeRouter);
app.use('/api/stats', statsRouter);

export default app;