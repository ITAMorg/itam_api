
import request from 'supertest';
import app from '../src/app';
import { prismaTest } from './helpers/prisma';
import { cleanDatabase } from './helpers/cleanup';
import { createTestUser,resetFactoryCounters, } from './helpers/factories';

/**
 * Tests d'intégration de l'authentification.
 *
 * Ces tests exercent les routes réelles de l'API (via Supertest) sur une BDD
 * PostgreSQL dédiée (itam_test). Chaque test démarre avec une base vide.
 *
 * Couverture :
 *  - POST /api/auth/register (création de compte)
 *  - POST /api/auth/login    (authentification + génération JWT)
 *  - POST /api/auth/refresh  (renouvellement du token d'accès)
 *  - POST /api/auth/logout   (révocation du refresh token)
 */
describe('Auth API', () => {

    beforeEach(async () => {
    await cleanDatabase();
    resetFactoryCounters();
    });

  // Fermeture propre de la connexion Prisma en fin de suite
  // (évite les "Jest did not exit" et les fuites de connexions)
  afterAll(async () => {
    await prismaTest.$disconnect();
  });

  // ─── POST /api/auth/register ───────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('crée un nouvel utilisateur et retourne 201 avec les données (sans password)', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@test.local',
          password: 'SecurePass123!',
          firstName: 'Jean',
          lastName: 'Dupont',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        email: 'newuser@test.local',
        firstName: 'Jean',
        lastName: 'Dupont',
        role: 'USER', // valeur par défaut du schema.prisma
        isActive: true,
      });
      // Vérification critique : le password ne doit JAMAIS être renvoyé
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('persiste bien le user en base avec un password hashé (pas en clair)', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'persisted@test.local',
          password: 'PlainPassword123',
          firstName: 'Alice',
          lastName: 'Martin',
        });

      const userInDb = await prismaTest.user.findUnique({
        where: { email: 'persisted@test.local' },
      });

      expect(userInDb).not.toBeNull();
      // Le password stocké est différent du password envoyé = hashé
      expect(userInDb!.password).not.toBe('PlainPassword123');
      // Un hash bcrypt commence toujours par $2 (algorithme) suivi de a/b/y
      expect(userInDb!.password).toMatch(/^\$2[aby]\$/);
    });

    it('refuse la création si l\'email existe déjà (400)', async () => {
      // Premier user créé via factory
      await createTestUser({ email: 'duplicate@test.local' });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@test.local',
          password: 'SomePass123',
          firstName: 'Autre',
          lastName: 'Personne',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/déjà utilisée/i);
    });
  });

  // ─── POST /api/auth/login ──────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('retourne accessToken, refreshToken et user avec des credentials valides', async () => {
      const user = await createTestUser({
        email: 'login-ok@test.local',
        password: 'MyPassword123',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-ok@test.local',
          password: 'MyPassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        id: user.id,
        email: 'login-ok@test.local',
      });
      // Le password ne doit jamais être renvoyé dans la réponse de login
      expect(response.body.user).not.toHaveProperty('password');
      // Les tokens JWT sont composés de 3 parties séparées par des points
      expect(response.body.accessToken.split('.')).toHaveLength(3);
      expect(response.body.refreshToken.split('.')).toHaveLength(3);
    });

    it('persiste le refresh token en base après un login réussi', async () => {
      const user = await createTestUser({
        email: 'persist-token@test.local',
        password: 'MyPassword123',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'persist-token@test.local',
          password: 'MyPassword123',
        });

      const tokenInDb = await prismaTest.refreshToken.findUnique({
        where: { token: response.body.refreshToken },
      });

      expect(tokenInDb).not.toBeNull();
      expect(tokenInDb!.userId).toBe(user.id);
      // Le token doit expirer dans le futur (par défaut 7 jours)
      expect(tokenInDb!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('refuse un login avec un mauvais mot de passe (401)', async () => {
      await createTestUser({
        email: 'wrong-pass@test.local',
        password: 'CorrectPassword',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong-pass@test.local',
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/identifiants invalides/i);
    });

    it('refuse un login sur un email inexistant (401)', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.local',
          password: 'AnyPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/identifiants invalides/i);
    });

    it('ne permet pas de distinguer un email inexistant d\'un mot de passe erroné', async () => {
      await createTestUser({
        email: 'existe@test.local',
        password: 'BonMotDePasse123',
      });

      const mauvaisMotDePasse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'existe@test.local', password: 'MauvaisMotDePasse' });

      const emailInexistant = await request(app)
        .post('/api/auth/login')
        .send({ email: 'inconnu@test.local', password: 'BonMotDePasse123' });

      expect(mauvaisMotDePasse.status).toBe(emailInexistant.status);
      expect(mauvaisMotDePasse.body).toEqual(emailInexistant.body);
    });
  });

  // ─── POST /api/auth/refresh ────────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('retourne un nouveau accessToken quand le refresh token est valide', async () => {
      // On login d'abord pour obtenir un refresh token valide en base
      await createTestUser({
        email: 'refresh-ok@test.local',
        password: 'MyPassword123',
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'refresh-ok@test.local',
          password: 'MyPassword123',
        });

      const { refreshToken } = loginResponse.body;

      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body).toHaveProperty('accessToken');
      expect(refreshResponse.body.accessToken.split('.')).toHaveLength(3);
    });

    it('refuse un refresh avec un token inexistant en base (401)', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'token-inexistant-en-base' });

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/jeton de rafraîchissement invalide/i);
    });
  });

  // ─── POST /api/auth/logout ─────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('supprime le refresh token de la base et retourne 200', async () => {
      await createTestUser({
        email: 'logout@test.local',
        password: 'MyPassword123',
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logout@test.local',
          password: 'MyPassword123',
        });

      const { refreshToken } = loginResponse.body;

      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body).toHaveProperty('message', 'Logged out');

      // Vérification : le token n'existe plus en base
      const tokenInDb = await prismaTest.refreshToken.findUnique({
        where: { token: refreshToken },
      });
      expect(tokenInDb).toBeNull();
    });

    it('rend le refresh token inutilisable après logout (401 au refresh suivant)', async () => {
      // Scénario complet : login → logout → tentative de refresh doit échouer
      await createTestUser({
        email: 'logout-then-refresh@test.local',
        password: 'MyPassword123',
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logout-then-refresh@test.local',
          password: 'MyPassword123',
        });

      const { refreshToken } = loginResponse.body;

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });

      // Tentative de refresh avec le token révoqué
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(401);
    });
  });

  it('un compte désactivé ne peut pas se connecter (OWASP A07)', async () => {
      await createTestUser({
        email: 'inactif@test.local',
        password: 'Pass123',
        role: 'USER',
        isActive: false,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'inactif@test.local', password: 'Pass123' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Identifiants invalides.');
    });
});