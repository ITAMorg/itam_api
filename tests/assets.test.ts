import request from 'supertest';
import app from '../src/app';
import { prismaTest } from './helpers/prisma';
import { cleanDatabase } from './helpers/cleanup';
import {
  createTestUser,
  createTestLocation,
  createTestAssetType,
  createTestAsset,
  resetFactoryCounters,
} from './helpers/factories';

/**
 * Tests d'intégration des routes /api/assets.
 *
 * Focus principaux :
 *  - CRUD assets avec permissions par rôle (RBAC)
 *  - Filtrage automatique par location pour les utilisateurs USER
 *    (démonstration explicite de OWASP A01 - Broken Access Control)
 *  - Vérification que les tokens JWT sont bien exigés sur toutes les routes
 */
describe('Assets API', () => {

beforeEach(async () => {
  await cleanDatabase();
  resetFactoryCounters();
});

  afterAll(async () => {
    await prismaTest.$disconnect();
  });

  /**
   * Helper : login un user et retourne son accessToken.
   * Évite de dupliquer 5 lignes de setup dans chaque test.
   */
  async function loginAs(email: string, password: string): Promise<string> {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    return response.body.accessToken;
  }

  // ─── Authentification requise ──────────────────────────────────────────────

  describe('Authentification', () => {
    it('refuse l\'accès à GET /api/assets sans token (401)', async () => {
      const response = await request(app).get('/api/assets');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Unauthorized');
    });

    it('refuse l\'accès à GET /api/assets avec un token invalide (401)', async () => {
      const response = await request(app)
        .get('/api/assets')
        .set('Authorization', 'Bearer un-token-completement-bidon');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid or expired token');
    });
  });

  // ─── GET /api/assets : filtrage RBAC ───────────────────────────────────────

  describe('GET /api/assets - Filtrage RBAC par location', () => {
    it('un ADMIN voit tous les assets, toutes locations confondues', async () => {
      const parisLoc = await createTestLocation({ name: 'Paris' });
      const lyonLoc = await createTestLocation({ name: 'Lyon' });
      const type = await createTestAssetType();

      await createTestAsset({ typeId: type.id, locationId: parisLoc.id });
      await createTestAsset({ typeId: type.id, locationId: lyonLoc.id });
      await createTestAsset({ typeId: type.id, locationId: null }); // stock

      await createTestUser({
        email: 'admin@test.local',
        password: 'AdminPass123',
        role: 'ADMIN',
      });
      const token = await loginAs('admin@test.local', 'AdminPass123');

      const response = await request(app)
        .get('/api/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('un USER ne voit QUE les assets de sa propre location (OWASP A01)', async () => {
      const parisLoc = await createTestLocation({ name: 'Paris' });
      const lyonLoc = await createTestLocation({ name: 'Lyon' });
      const type = await createTestAssetType();

      const parisAsset = await createTestAsset({
        typeId: type.id,
        locationId: parisLoc.id,
        name: 'Laptop Paris',
      });
      await createTestAsset({
        typeId: type.id,
        locationId: lyonLoc.id,
        name: 'Laptop Lyon',
      });

      // User rattaché à Paris uniquement
      await createTestUser({
        email: 'user-paris@test.local',
        password: 'UserPass123',
        role: 'USER',
        locationId: parisLoc.id,
      });
      const token = await loginAs('user-paris@test.local', 'UserPass123');

      const response = await request(app)
        .get('/api/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(parisAsset.id);
      expect(response.body[0].name).toBe('Laptop Paris');
    });

    it('un USER ne peut PAS contourner le filtrage en forgeant ?locationId= (OWASP A01)', async () => {
      // Test crucial pour le jury : même en essayant d'exploiter la query string,
      // le USER reste confiné à sa location par le serveur
      const parisLoc = await createTestLocation({ name: 'Paris' });
      const lyonLoc = await createTestLocation({ name: 'Lyon' });
      const type = await createTestAssetType();

      await createTestAsset({
        typeId: type.id,
        locationId: lyonLoc.id,
        name: 'Asset confidentiel Lyon',
      });

      await createTestUser({
        email: 'attacker@test.local',
        password: 'UserPass123',
        role: 'USER',
        locationId: parisLoc.id,
      });
      const token = await loginAs('attacker@test.local', 'UserPass123');

      // Tentative : le USER force explicitement locationId=lyon dans l'URL
      const response = await request(app)
        .get(`/api/assets?locationId=${lyonLoc.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      // Le paramètre est IGNORÉ : le USER voit uniquement Paris (vide ici)
      expect(response.body).toHaveLength(0);
    });

    it('un USER sans location assignée ne voit aucun asset', async () => {
      const parisLoc = await createTestLocation({ name: 'Paris' });
      const type = await createTestAssetType();

      await createTestAsset({ typeId: type.id, locationId: parisLoc.id });

      await createTestUser({
        email: 'user-orphan@test.local',
        password: 'UserPass123',
        role: 'USER',
        locationId: null, // pas de location
      });
      const token = await loginAs('user-orphan@test.local', 'UserPass123');

      const response = await request(app)
        .get('/api/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });
  });

  // ─── POST /api/assets : permissions ────────────────────────────────────────

  describe('POST /api/assets - Création', () => {
    it('un ADMIN peut créer un asset (201)', async () => {
      const type = await createTestAssetType();
      await createTestUser({
        email: 'admin@test.local',
        password: 'AdminPass123',
        role: 'ADMIN',
      });
      const token = await loginAs('admin@test.local', 'AdminPass123');

      const response = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Nouveau laptop',
          serialNumber: 'SN-TEST-001',
          typeId: type.id,
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'Nouveau laptop',
        serialNumber: 'SN-TEST-001',
        status: 'IN_STOCK', // valeur par défaut
      });
      expect(response.body.id).toBeDefined();
    });

    it('un TECHNICIAN peut créer un asset (201)', async () => {
      const type = await createTestAssetType();
      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      const response = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Laptop technicien',
          typeId: type.id,
        });

      expect(response.status).toBe(201);
    });

    it('un USER standard ne peut PAS créer un asset (403)', async () => {
      const type = await createTestAssetType();
      await createTestUser({
        email: 'user@test.local',
        password: 'UserPass123',
        role: 'USER',
      });
      const token = await loginAs('user@test.local', 'UserPass123');

      const response = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Tentative interdite',
          typeId: type.id,
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', 'Forbidden');
    });

    it('la création trace un événement dans l\'historique (AssetLifecycle)', async () => {
      const type = await createTestAssetType();
      await createTestUser({
        email: 'admin@test.local',
        password: 'AdminPass123',
        role: 'ADMIN',
      });
      const token = await loginAs('admin@test.local', 'AdminPass123');

      const response = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Asset tracé',
          typeId: type.id,
        });

      const lifecycle = await prismaTest.assetLifecycle.findMany({
        where: { assetId: response.body.id },
      });

      expect(lifecycle).toHaveLength(1);
      expect(lifecycle[0].event).toBe('CREATED');
    });
  });

  // ─── DELETE /api/assets/:id : permissions strictes ADMIN ───────────────────

  describe('DELETE /api/assets/:id - Suppression', () => {
    it('un ADMIN peut supprimer un asset (204)', async () => {
      const type = await createTestAssetType();
      const asset = await createTestAsset({ typeId: type.id });
      await createTestUser({
        email: 'admin@test.local',
        password: 'AdminPass123',
        role: 'ADMIN',
      });
      const token = await loginAs('admin@test.local', 'AdminPass123');

      const response = await request(app)
        .delete(`/api/assets/${asset.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);

      // Vérif en base
      const deletedAsset = await prismaTest.asset.findUnique({
        where: { id: asset.id },
      });
      expect(deletedAsset).toBeNull();
    });

    it('un TECHNICIAN ne peut PAS supprimer un asset (403)', async () => {
      const type = await createTestAssetType();
      const asset = await createTestAsset({ typeId: type.id });
      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      const response = await request(app)
        .delete(`/api/assets/${asset.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);

      // L'asset existe toujours en base
      const stillThere = await prismaTest.asset.findUnique({
        where: { id: asset.id },
      });
      expect(stillThere).not.toBeNull();
    });

    it('retourne 404 si on tente de supprimer un asset inexistant', async () => {
      await createTestUser({
        email: 'admin@test.local',
        password: 'AdminPass123',
        role: 'ADMIN',
      });
      const token = await loginAs('admin@test.local', 'AdminPass123');

      const response = await request(app)
        .delete('/api/assets/99999')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });
});