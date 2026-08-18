import request from 'supertest';
import app from '../src/app';
import { prismaTest } from './helpers/prisma';
import prisma from '../src/config/prisma';
import {
  resetMetrics,
  recordRequest,
  buildRouteKey,
  getMetrics,
} from '../src/services/metrics.service';

describe('Collecte de métriques', () => {
  beforeEach(() => {
    resetMetrics();
  });

  afterAll(async () => {
    await prismaTest.$disconnect();
    await prisma.$disconnect();
  });

  describe('GET /metrics — exposition', () => {
    it('répond 200 avec la structure attendue', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptimeSeconds');
      expect(response.body.requests).toHaveProperty('total');
      expect(response.body.requests).toHaveProperty('byStatusClass');
      expect(response.body.requests).toHaveProperty('errorRate');
      expect(response.body).toHaveProperty('latencyMs');
      expect(Array.isArray(response.body.routes)).toBe(true);
    });

    it("expose l'empreinte mémoire du processus", async () => {
      const response = await request(app).get('/metrics');

      expect(typeof response.body.process.memoryHeapUsedMb).toBe('number');
      expect(response.body.process.memoryHeapUsedMb).toBeGreaterThan(0);
      expect(response.body.process.memoryRssMb).toBeGreaterThan(0);
    });

    it("n'expose aucune information sensible", async () => {
      const response = await request(app).get('/metrics');
      const payload = JSON.stringify(response.body).toLowerCase();

      expect(payload).not.toContain('password');
      expect(payload).not.toContain('secret');
      expect(payload).not.toContain('token');
    });
  });

  describe('Exclusion des routes de supervision', () => {
    it('ne comptabilise pas les appels aux sondes', async () => {
      await request(app).get('/health');
      await request(app).get('/health/ready');
      await request(app).get('/metrics');

      const response = await request(app).get('/metrics');

      expect(response.body.requests.total).toBe(0);
      expect(response.body.routes).toHaveLength(0);
    });

    it('comptabilise les requêtes applicatives', async () => {
      await request(app).get('/api/assets');

      const response = await request(app).get('/metrics');

      expect(response.body.requests.total).toBe(1);
    });
  });

  describe('Comptage par classe de statut', () => {
    it("classe une requête non authentifiée en 4xx", async () => {
      await request(app).get('/api/assets');

      const response = await request(app).get('/metrics');

      expect(response.body.requests.byStatusClass['4xx']).toBe(1);
      expect(response.body.requests.byStatusClass['5xx']).toBe(0);
    });

    it('calcule un taux d’erreur nul en l’absence de 5xx', async () => {
      await request(app).get('/api/assets');
      await request(app).get('/api/tickets');

      const response = await request(app).get('/metrics');

      expect(response.body.requests.errorRate).toBe(0);
    });
  });

  describe('Normalisation des routes paramétrées', () => {
    it('regroupe les identifiants sous un motif unique', () => {
      const key = buildRouteKey('GET', '/api/assets/:id', '/api/assets/427');

      recordRequest(key, 200, 12);
      recordRequest(key, 200, 15);
      recordRequest(key, 200, 9);

      const metrics = getMetrics();
      const route = metrics.routes.find(
        (r) => r.route === 'GET /api/assets/:id',
      );

      expect(metrics.routes).toHaveLength(1);
      expect(route?.count).toBe(3);
    });

    it("retombe sur le chemin réel quand aucune route ne correspond", () => {
      const key = buildRouteKey('GET', undefined, '/api/inexistant');

      expect(key).toBe('GET /api/inexistant');
    });
  });

  describe('Calcul des latences et du taux d’erreur', () => {
    it('calcule les percentiles p50 et p95', () => {
      const key = buildRouteKey('GET', '/api/assets', '/api/assets');

      for (let i = 1; i <= 100; i += 1) {
        recordRequest(key, 200, i);
      }

      const route = getMetrics().routes[0];

      expect(route.latencyMs.p50).toBe(50);
      expect(route.latencyMs.p95).toBe(95);
      expect(route.latencyMs.max).toBe(100);
    });

    it('calcule le taux d’erreur par route', () => {
      const key = buildRouteKey('POST', '/api/assets', '/api/assets');

      for (let i = 0; i < 8; i += 1) recordRequest(key, 201, 10);
      recordRequest(key, 500, 10);
      recordRequest(key, 500, 10);

      const route = getMetrics().routes[0];

      expect(route.count).toBe(10);
      expect(route.errors).toBe(2);
      expect(route.errorRate).toBe(0.2);
    });

    it("ne compte pas les erreurs client dans le taux d'erreur serveur", () => {
      const key = buildRouteKey('GET', '/api/assets/:id', '/api/assets/1');

      recordRequest(key, 404, 5);
      recordRequest(key, 200, 5);

      const route = getMetrics().routes[0];

      expect(route.errors).toBe(0);
      expect(route.errorRate).toBe(0);
    });

    it('trie les routes par volume décroissant', () => {
      const rare = buildRouteKey('GET', '/api/suppliers', '/api/suppliers');
      const frequent = buildRouteKey('GET', '/api/assets', '/api/assets');

      recordRequest(rare, 200, 10);
      for (let i = 0; i < 5; i += 1) recordRequest(frequent, 200, 10);

      const routes = getMetrics().routes;

      expect(routes[0].route).toBe('GET /api/assets');
      expect(routes[0].count).toBe(5);
    });
  });
});