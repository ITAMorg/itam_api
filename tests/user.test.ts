import request from 'supertest';
import app from '../src/app';
import { prismaTest } from './helpers/prisma';
import { cleanDatabase } from './helpers/cleanup';
import {
  createTestUser,
  createTestLocation,
  resetFactoryCounters,
} from './helpers/factories';

/**
 * Tests d'intégration des routes /api/users.
 *
 * Focus principaux :
 *  - Permissions strictes ADMIN sur l'administration des comptes
 *  - Validation des données entrantes (champs requis, rôle valide)
 *  - Non-exposition du mot de passe dans les réponses (OWASP A04)
 *  - Désactivation d'un compte : préservation de l'enregistrement,
 *    interdiction des connexions ultérieures
 */
describe('Users API', () => {
  beforeEach(async () => {
    await cleanDatabase();
    resetFactoryCounters();
  });

  afterAll(async () => {
    await prismaTest.$disconnect();
  });

  async function loginAs(email: string, password: string): Promise<string> {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    return response.body.accessToken;
  }

  /** Crée un ADMIN et retourne son token. Setup récurrent de ce fichier. */
  async function adminToken(): Promise<string> {
    await createTestUser({
      email: 'admin@test.local',
      password: 'AdminPass123',
      role: 'ADMIN',
    });
    return loginAs('admin@test.local', 'AdminPass123');
  }

  // ─── Authentification et permissions ───────────────────────────────────────

  describe('Authentification et permissions', () => {
    it('refuse l\'accès à GET /api/users sans token (401)', async () => {
      const response = await request(app).get('/api/users');

      expect(response.status).toBe(401);
    });

    it('un TECHNICIAN ne peut PAS lister tous les utilisateurs (403)', async () => {
      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it('un USER ne peut PAS lister tous les utilisateurs (403)', async () => {
      await createTestUser({
        email: 'user@test.local',
        password: 'UserPass123',
        role: 'USER',
      });
      const token = await loginAs('user@test.local', 'UserPass123');

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });
  });

  // ─── GET /api/users ────────────────────────────────────────────────────────

  describe('GET /api/users - Liste complète', () => {
    it('un ADMIN obtient la liste de tous les comptes (200)', async () => {
      const token = await adminToken();
      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      await createTestUser({
        email: 'user@test.local',
        password: 'UserPass123',
        role: 'USER',
      });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('la réponse n\'expose jamais le mot de passe, même haché (OWASP A04)', async () => {
      const token = await adminToken();

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      for (const user of response.body) {
        expect(user).not.toHaveProperty('password');
      }
    });
  });

  // ─── GET /api/users/role/:role ─────────────────────────────────────────────

  describe('GET /api/users/role/:role - Filtrage par rôle', () => {
    it('retourne uniquement les comptes du rôle demandé (200)', async () => {
      const token = await adminToken();
      await createTestUser({
        email: 'tech1@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      await createTestUser({
        email: 'tech2@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      await createTestUser({
        email: 'user@test.local',
        password: 'UserPass123',
        role: 'USER',
      });

      const response = await request(app)
        .get('/api/users/role/TECHNICIAN')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.every((u: { role: string }) => u.role === 'TECHNICIAN')).toBe(true);
    });

    it('un TECHNICIAN peut consulter la liste des techniciens (200)', async () => {
      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      const response = await request(app)
        .get('/api/users/role/TECHNICIAN')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('refuse un rôle inexistant (400)', async () => {
      const token = await adminToken();

      const response = await request(app)
        .get('/api/users/role/SUPERVISEUR')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('retourne une liste vide si aucun compte ne porte le rôle', async () => {
      const token = await adminToken();

      const response = await request(app)
        .get('/api/users/role/TECHNICIAN')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });
  });

  // ─── POST /api/users ───────────────────────────────────────────────────────

  describe('POST /api/users - Création de compte', () => {
    it('un ADMIN crée un compte utilisable (201)', async () => {
      const token = await adminToken();

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'nouveau@test.local',
          password: 'NouveauPass123',
          firstName: 'Claire',
          lastName: 'Martin',
          role: 'TECHNICIAN',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        email: 'nouveau@test.local',
        firstName: 'Claire',
        lastName: 'Martin',
        role: 'TECHNICIAN',
        isActive: true,
      });

      // Le compte créé permet effectivement la connexion
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nouveau@test.local', password: 'NouveauPass123' });

      expect(loginResponse.status).toBe(200);
    });

    it('le mot de passe est haché en base et absent de la réponse (OWASP A02, A04)', async () => {
      const token = await adminToken();

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'hache@test.local',
          password: 'MotDePasseClair123',
          firstName: 'Paul',
          lastName: 'Durand',
          role: 'USER',
        });

      expect(response.body).not.toHaveProperty('password');

      const stored = await prismaTest.user.findUnique({
        where: { email: 'hache@test.local' },
      });
      expect(stored).not.toBeNull();
      expect(stored!.password).not.toBe('MotDePasseClair123');
    });

    it('refuse la création si un champ requis est absent (400)', async () => {
      const token = await adminToken();

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'incomplet@test.local',
          password: 'Pass123',
          role: 'USER',
        });

      expect(response.status).toBe(400);
    });

    it('refuse la création avec un rôle invalide (400)', async () => {
      const token = await adminToken();

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'roleinvalide@test.local',
          password: 'Pass123',
          firstName: 'Test',
          lastName: 'Test',
          role: 'SUPERVISEUR',
        });

      expect(response.status).toBe(400);
    });

    it('refuse la création d\'un compte avec un email déjà utilisé (500)', async () => {
      const token = await adminToken();
      await createTestUser({
        email: 'existant@test.local',
        password: 'Pass123',
        role: 'USER',
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'existant@test.local',
          password: 'AutrePass123',
          firstName: 'Doublon',
          lastName: 'Test',
          role: 'USER',
        });

      expect(response.status).toBe(500);
    });

    it('un TECHNICIAN ne peut PAS créer de compte (403)', async () => {
      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'tentative@test.local',
          password: 'Pass123',
          firstName: 'Test',
          lastName: 'Test',
          role: 'ADMIN',
        });

      expect(response.status).toBe(403);
    });
  });

  // ─── PUT /api/users/:id ────────────────────────────────────────────────────

  describe('PUT /api/users/:id - Modification', () => {
    it('un ADMIN modifie le rôle d\'un compte (200)', async () => {
      const token = await adminToken();
      const cible = await createTestUser({
        email: 'promu@test.local',
        password: 'Pass123',
        role: 'USER',
      });

      const response = await request(app)
        .put(`/api/users/${cible.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'TECHNICIAN' });

      expect(response.status).toBe(200);
      expect(response.body.role).toBe('TECHNICIAN');
    });

    it('un ADMIN modifie l\'identité d\'un compte (200)', async () => {
      const token = await adminToken();
      const cible = await createTestUser({
        email: 'renomme@test.local',
        password: 'Pass123',
        role: 'USER',
      });

      const response = await request(app)
        .put(`/api/users/${cible.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Sofia', lastName: 'Ben Ali' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        firstName: 'Sofia',
        lastName: 'Ben Ali',
      });
    });

    it('refuse un rôle invalide (400)', async () => {
      const token = await adminToken();
      const cible = await createTestUser({
        email: 'cible@test.local',
        password: 'Pass123',
        role: 'USER',
      });

      const response = await request(app)
        .put(`/api/users/${cible.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'SUPERVISEUR' });

      expect(response.status).toBe(400);
    });

    it('la désactivation préserve l\'enregistrement et interdit la connexion', async () => {
      const token = await adminToken();
      const cible = await createTestUser({
        email: 'desactive@test.local',
        password: 'Pass123',
        role: 'USER',
      });

      const response = await request(app)
        .put(`/api/users/${cible.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(false);

      // L'enregistrement subsiste : l'historique reste rattachable
      const stored = await prismaTest.user.findUnique({ where: { id: cible.id } });
      expect(stored).not.toBeNull();

      // Mais la connexion est refusée
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'desactive@test.local', password: 'Pass123' });

      expect(loginResponse.status).toBe(401);
    });

    it('la désactivation invalide les sessions déjà ouvertes', async () => {
      const token = await adminToken();
      const cible = await createTestUser({
        email: 'connecte@test.local',
        password: 'Pass123',
        role: 'USER',
      });

      // La cible ouvre une session avant sa désactivation
      const session = await request(app)
        .post('/api/auth/login')
        .send({ email: 'connecte@test.local', password: 'Pass123' });
      const refreshToken = session.body.refreshToken;

      await request(app)
        .put(`/api/users/${cible.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      // Le jeton de rafraîchissement ne permet plus de prolonger la session
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).not.toBe(200);
    });

    it('un TECHNICIAN ne peut PAS modifier un compte (403)', async () => {
      const cible = await createTestUser({
        email: 'cible@test.local',
        password: 'Pass123',
        role: 'USER',
      });
      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      const response = await request(app)
        .put(`/api/users/${cible.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'ADMIN' });

      expect(response.status).toBe(403);
    });
  });

  // ─── DELETE /api/users/:id ─────────────────────────────────────────────────

  describe('DELETE /api/users/:id - Suppression', () => {
    it('un ADMIN supprime un compte sans historique (204)', async () => {
      const token = await adminToken();
      const cible = await createTestUser({
        email: 'asupprimer@test.local',
        password: 'Pass123',
        role: 'USER',
      });

      const response = await request(app)
        .delete(`/api/users/${cible.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);

      const stored = await prismaTest.user.findUnique({ where: { id: cible.id } });
      expect(stored).toBeNull();
    });

    it('un TECHNICIAN ne peut PAS supprimer de compte (403)', async () => {
      const cible = await createTestUser({
        email: 'cible@test.local',
        password: 'Pass123',
        role: 'USER',
      });
      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      const response = await request(app)
        .delete(`/api/users/${cible.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);

      const stored = await prismaTest.user.findUnique({ where: { id: cible.id } });
      expect(stored).not.toBeNull();
    });
  });

  // ─── Rattachement à un site ────────────────────────────────────────────────

  describe('Rattachement à un site', () => {
    it('un compte créé via l\'API n\'est rattaché à aucun site', async () => {
      // Constat documenté : l'endpoint de création ne permet pas de renseigner
      // le site de rattachement. L'affectation relève actuellement d'une
      // intervention hors interface d'administration.
      const token = await adminToken();
      await createTestLocation({ name: 'Paris' });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'sanssite@test.local',
          password: 'Pass123',
          firstName: 'Test',
          lastName: 'Test',
          role: 'USER',
        });

      expect(response.status).toBe(201);

      const stored = await prismaTest.user.findUnique({
        where: { email: 'sanssite@test.local' },
      });
      expect(stored!.locationId).toBeNull();
    });
  });
});