import request from 'supertest';
import app from '../src/app';
import { prismaTest } from './helpers/prisma';
import prisma from '../src/config/prisma';
import { checkDatabase } from '../src/services/health.service';

describe('Sondes de supervision', () => {
  afterAll(async () => {
    await prismaTest.$disconnect();
    await prisma.$disconnect();
  });

  describe('GET /health — vivacité', () => {
    it('répond 200 avec un état up', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('up');
    });

    it('expose un horodatage ISO 8601 et une durée de fonctionnement', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp).toString()).not.toBe(
        'Invalid Date',
      );
      expect(typeof response.body.uptimeSeconds).toBe('number');
      expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it("n'expose aucune information d'infrastructure", async () => {
      const response = await request(app).get('/health');
      const payload = JSON.stringify(response.body).toLowerCase();

      expect(payload).not.toContain('postgres');
      expect(payload).not.toContain('password');
      expect(payload).not.toContain('localhost');
      expect(response.body).not.toHaveProperty('version');
    });

    it("est accessible sans jeton d'authentification", async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
    });

    it('renvoie un identifiant de corrélation', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('réutilise un identifiant de corrélation fourni par le client', async () => {
      const providedId = 'test-correlation-0001';

      const response = await request(app)
        .get('/health')
        .set('x-request-id', providedId);

      expect(response.headers['x-request-id']).toBe(providedId);
    });
  });

  describe('GET /health/ready — aptitude au service', () => {
    it('répond 200 lorsque la base est joignable', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('up');
      expect(response.body.checks.database.status).toBe('up');
    });

    it('mesure et expose le temps de réponse de la base', async () => {
      const response = await request(app).get('/health/ready');
      const { responseTimeMs } = response.body.checks.database;

      expect(typeof responseTimeMs).toBe('number');
      expect(responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(responseTimeMs).toBeLessThan(3000);
    });
  });

  describe('Comportement en cas de panne de la base', () => {
    let queryRawSpy: jest.SpyInstance;

    afterEach(() => {
      queryRawSpy?.mockRestore();
    });

    it('répond 503 avec un état down quand la base est injoignable', async () => {
      queryRawSpy = jest
        .spyOn(prisma, '$queryRaw')
        .mockRejectedValue(new Error('Connection refused'));

      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('down');
      expect(response.body.checks.database.status).toBe('down');
    });

    it('reste disponible sur la sonde de vivacité pendant la panne', async () => {
      queryRawSpy = jest
        .spyOn(prisma, '$queryRaw')
        .mockRejectedValue(new Error('Connection refused'));

      const liveness = await request(app).get('/health');
      const readiness = await request(app).get('/health/ready');

      expect(liveness.status).toBe(200);
      expect(readiness.status).toBe(503);
    });

    it('signale un dépassement de délai comme une indisponibilité', async () => {
      queryRawSpy = jest
        .spyOn(prisma, '$queryRaw')
        .mockImplementation(
          () => new Promise(() => undefined) as never,
        );

      const result = await checkDatabase();

      expect(result.status).toBe('down');
      expect(result.error?.toLowerCase()).toContain('délai');

      const payload = JSON.stringify(result).toLowerCase();
      expect(payload).not.toContain('prisma');
      expect(payload).not.toContain('postgres');
      expect(payload).not.toContain('5432');
    }, 10000);
  });
});