import request from 'supertest';
import app from '../src/app';
import { prismaTest } from './helpers/prisma';
import { cleanDatabase } from './helpers/cleanup';
import {
  createTestUser,
  createTestLocation,
  createTestAssetType,
  createTestAsset,
  createTestTicket,
  resetFactoryCounters,
} from './helpers/factories';

/**
 * Tests d'intégration des routes /api/stats.
 *
 * Focus principaux :
 *  - Exactitude des agrégats servant au pilotage (US10)
 *  - Restriction d'accès aux rôles ADMIN et TECHNICIAN
 *  - Comportement sur jeu de données vide (absence de division par zéro,
 *    de valeur nulle ou de tableau non initialisé)
 */
describe('Stats API', () => {
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

  async function adminToken(): Promise<string> {
    await createTestUser({
      email: 'admin@test.local',
      password: 'AdminPass123',
      role: 'ADMIN',
    });
    return loginAs('admin@test.local', 'AdminPass123');
  }

  /** Positionne la date de résolution, non gérée par la factory. */
  async function markResolved(ticketId: number, resolvedAt: Date): Promise<void> {
    await prismaTest.ticket.update({
      where: { id: ticketId },
      data: { status: 'RESOLVED', resolvedAt },
    });
  }

  // ─── Permissions ───────────────────────────────────────────────────────────

  describe('Permissions d\'accès aux statistiques', () => {
    it('refuse l\'accès sans token (401)', async () => {
      const response = await request(app).get('/api/stats/dashboard');

      expect(response.status).toBe(401);
    });

    it('un USER ne peut PAS consulter les statistiques (403)', async () => {
      await createTestUser({
        email: 'user@test.local',
        password: 'UserPass123',
        role: 'USER',
      });
      const token = await loginAs('user@test.local', 'UserPass123');

      const response = await request(app)
        .get('/api/stats/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it('un TECHNICIAN peut consulter les statistiques (200)', async () => {
      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      const response = await request(app)
        .get('/api/stats/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('les quatre routes de statistiques sont protégées de la même façon', async () => {
      await createTestUser({
        email: 'user@test.local',
        password: 'UserPass123',
        role: 'USER',
      });
      const token = await loginAs('user@test.local', 'UserPass123');

      for (const route of ['dashboard', 'assets', 'tickets', 'technicians']) {
        const response = await request(app)
          .get(`/api/stats/${route}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
      }
    });
  });

  // ─── GET /api/stats/dashboard ──────────────────────────────────────────────

  describe('GET /api/stats/dashboard - Indicateurs de synthèse', () => {
    it('retourne des compteurs à zéro sur une base vide', async () => {
      const token = await adminToken();

      const response = await request(app)
        .get('/api/stats/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        totalAssets: 0,
        brokenAssets: 0,
        openTickets: 0,
        highOpenTickets: 0,
      });
    });

    it('compte l\'ensemble du parc et les équipements hors service', async () => {
      const token = await adminToken();
      const type = await createTestAssetType();

      await createTestAsset({ typeId: type.id, status: 'IN_SERVICE' });
      await createTestAsset({ typeId: type.id, status: 'IN_SERVICE' });
      await createTestAsset({ typeId: type.id, status: 'BROKEN' });
      await createTestAsset({ typeId: type.id, status: 'IN_STOCK' });

      const response = await request(app)
        .get('/api/stats/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.totalAssets).toBe(4);
      expect(response.body.brokenAssets).toBe(1);
    });

    it('compte les tickets en cours de traitement, résolus exclus', async () => {
      const token = await adminToken();
      const demandeur = await createTestUser();

      await createTestTicket({ requesterId: demandeur.id, status: 'OPEN' });
      await createTestTicket({ requesterId: demandeur.id, status: 'IN_PROGRESS' });
      await createTestTicket({ requesterId: demandeur.id, status: 'RESOLVED' });
      await createTestTicket({ requesterId: demandeur.id, status: 'CLOSED' });

      const response = await request(app)
        .get('/api/stats/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.openTickets).toBe(2);
    });

    it('isole les tickets de priorité haute encore ouverts', async () => {
      const token = await adminToken();
      const demandeur = await createTestUser();

      await createTestTicket({ requesterId: demandeur.id, status: 'OPEN', priority: 'HIGH' });
      await createTestTicket({ requesterId: demandeur.id, status: 'IN_PROGRESS', priority: 'HIGH' });
      await createTestTicket({ requesterId: demandeur.id, status: 'OPEN', priority: 'LOW' });
      // Priorité haute mais déjà résolu : ne doit pas être compté
      await createTestTicket({ requesterId: demandeur.id, status: 'RESOLVED', priority: 'HIGH' });

      const response = await request(app)
        .get('/api/stats/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.highOpenTickets).toBe(2);
    });
  });

  // ─── GET /api/stats/assets ─────────────────────────────────────────────────

  describe('GET /api/stats/assets - Répartition du parc', () => {
    it('retourne des répartitions vides sur une base vide', async () => {
      const token = await adminToken();

      const response = await request(app)
        .get('/api/stats/assets')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.byStatus).toEqual([]);
      expect(response.body.byType).toEqual([]);
    });

    it('groupe les équipements par statut', async () => {
      const token = await adminToken();
      const type = await createTestAssetType();

      await createTestAsset({ typeId: type.id, status: 'IN_SERVICE' });
      await createTestAsset({ typeId: type.id, status: 'IN_SERVICE' });
      await createTestAsset({ typeId: type.id, status: 'BROKEN' });

      const response = await request(app)
        .get('/api/stats/assets')
        .set('Authorization', `Bearer ${token}`);

      const enService = response.body.byStatus.find(
        (s: { status: string }) => s.status === 'IN_SERVICE'
      );
      const horsService = response.body.byStatus.find(
        (s: { status: string }) => s.status === 'BROKEN'
      );

      expect(enService.count).toBe(2);
      expect(horsService.count).toBe(1);
    });

    it('groupe les équipements par type et résout le nom du type', async () => {
      const token = await adminToken();
      const ecrans = await createTestAssetType({ name: 'Écran' });
      const portables = await createTestAssetType({ name: 'Ordinateur portable' });

      await createTestAsset({ typeId: ecrans.id });
      await createTestAsset({ typeId: ecrans.id });
      await createTestAsset({ typeId: portables.id });

      const response = await request(app)
        .get('/api/stats/assets')
        .set('Authorization', `Bearer ${token}`);

      const groupeEcrans = response.body.byType.find(
        (t: { typeId: number }) => t.typeId === ecrans.id
      );

      expect(groupeEcrans).toMatchObject({
        typeName: 'Écran',
        count: 2,
      });
      expect(response.body.byType).toHaveLength(2);
    });
  });

  // ─── GET /api/stats/tickets ────────────────────────────────────────────────

  describe('GET /api/stats/tickets - Activité de support', () => {
    it('retourne des valeurs neutres sur une base vide', async () => {
      const token = await adminToken();

      const response = await request(app)
        .get('/api/stats/tickets')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.openThisMonth).toBe(0);
      expect(response.body.resolvedThisMonth).toBe(0);
      expect(response.body.unassigned).toBe(0);
      expect(response.body.byPriority).toEqual([]);
      expect(response.body.highOpenTickets).toEqual([]);
    });

    it('compte les tickets ouverts sur le mois courant', async () => {
      const token = await adminToken();
      const demandeur = await createTestUser();

      await createTestTicket({ requesterId: demandeur.id, status: 'OPEN' });
      await createTestTicket({ requesterId: demandeur.id, status: 'IN_PROGRESS' });
      await createTestTicket({ requesterId: demandeur.id, status: 'CLOSED' });

      const response = await request(app)
        .get('/api/stats/tickets')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.openThisMonth).toBe(2);
    });

    it('compte les tickets résolus sur le mois courant', async () => {
      const token = await adminToken();
      const demandeur = await createTestUser();

      const premier = await createTestTicket({ requesterId: demandeur.id });
      const second = await createTestTicket({ requesterId: demandeur.id });
      await markResolved(premier.id, new Date());
      await markResolved(second.id, new Date());

      // Résolu le mois précédent : hors périmètre
      const ancien = await createTestTicket({ requesterId: demandeur.id });
      const moisPrecedent = new Date();
      moisPrecedent.setMonth(moisPrecedent.getMonth() - 1);
      await markResolved(ancien.id, moisPrecedent);

      const response = await request(app)
        .get('/api/stats/tickets')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.resolvedThisMonth).toBe(2);
    });

    it('compte les tickets en attente d\'affectation', async () => {
      const token = await adminToken();
      const demandeur = await createTestUser();
      const technicien = await createTestUser({ role: 'TECHNICIAN' });

      await createTestTicket({ requesterId: demandeur.id, status: 'OPEN' });
      await createTestTicket({ requesterId: demandeur.id, status: 'OPEN' });
      await createTestTicket({
        requesterId: demandeur.id,
        status: 'OPEN',
        assigneeId: technicien.id,
      });

      const response = await request(app)
        .get('/api/stats/tickets')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.unassigned).toBe(2);
    });

    it('groupe les tickets du mois par priorité', async () => {
      const token = await adminToken();
      const demandeur = await createTestUser();

      await createTestTicket({ requesterId: demandeur.id, priority: 'HIGH' });
      await createTestTicket({ requesterId: demandeur.id, priority: 'HIGH' });
      await createTestTicket({ requesterId: demandeur.id, priority: 'LOW' });

      const response = await request(app)
        .get('/api/stats/tickets')
        .set('Authorization', `Bearer ${token}`);

      const hautes = response.body.byPriority.find(
        (p: { priority: string }) => p.priority === 'HIGH'
      );

      expect(hautes.count).toBe(2);
      expect(response.body.byPriority).toHaveLength(2);
    });

    it('détaille les tickets prioritaires ouverts avec leur contexte', async () => {
      const token = await adminToken();
      const demandeur = await createTestUser();
      const technicien = await createTestUser({
        role: 'TECHNICIAN',
        firstName: 'Paul',
        lastName: 'Durand',
      });
      const type = await createTestAssetType();
      const equipement = await createTestAsset({
        typeId: type.id,
        name: 'Écran Dell P2419H',
      });

      await createTestTicket({
        requesterId: demandeur.id,
        assigneeId: technicien.id,
        assetId: equipement.id,
        priority: 'HIGH',
        status: 'OPEN',
        title: 'Écran hors service',
      });

      const response = await request(app)
        .get('/api/stats/tickets')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.highOpenTickets).toHaveLength(1);
      const ticket = response.body.highOpenTickets[0];
      expect(ticket).toMatchObject({
        title: 'Écran hors service',
        priority: 'HIGH',
        status: 'OPEN',
      });
      expect(ticket.assignee).toMatchObject({ firstName: 'Paul', lastName: 'Durand' });
      expect(ticket.asset).toMatchObject({ name: 'Écran Dell P2419H' });
    });

    it('n\'expose pas de données personnelles superflues dans le détail', async () => {
      const token = await adminToken();
      const demandeur = await createTestUser();
      const technicien = await createTestUser({ role: 'TECHNICIAN' });

      await createTestTicket({
        requesterId: demandeur.id,
        assigneeId: technicien.id,
        priority: 'HIGH',
        status: 'OPEN',
      });

      const response = await request(app)
        .get('/api/stats/tickets')
        .set('Authorization', `Bearer ${token}`);

      const assignee = response.body.highOpenTickets[0].assignee;
      expect(assignee).not.toHaveProperty('password');
      expect(assignee).not.toHaveProperty('email');
    });
  });

  // ─── GET /api/stats/technicians ────────────────────────────────────────────

  describe('GET /api/stats/technicians - Charge par technicien', () => {
    it('retourne une liste vide en l\'absence de technicien', async () => {
      const token = await adminToken();

      const response = await request(app)
        .get('/api/stats/technicians')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('retourne des compteurs à zéro pour un technicien sans activité', async () => {
      const token = await adminToken();
      await createTestUser({
        role: 'TECHNICIAN',
        firstName: 'Sofia',
        lastName: 'Ben Ali',
      });

      const response = await request(app)
        .get('/api/stats/technicians')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        firstName: 'Sofia',
        lastName: 'Ben Ali',
        assignedThisMonth: 0,
        resolvedThisMonth: 0,
      });
    });

    it('comptabilise les tickets affectés et résolus par technicien', async () => {
      const token = await adminToken();
      const demandeur = await createTestUser();
      const technicien = await createTestUser({ role: 'TECHNICIAN' });

      await createTestTicket({ requesterId: demandeur.id, assigneeId: technicien.id });
      const aResoudre = await createTestTicket({
        requesterId: demandeur.id,
        assigneeId: technicien.id,
      });
      await markResolved(aResoudre.id, new Date());

      const response = await request(app)
        .get('/api/stats/technicians')
        .set('Authorization', `Bearer ${token}`);

      const stats = response.body.find(
        (t: { id: number }) => t.id === technicien.id
      );
      expect(stats.assignedThisMonth).toBe(2);
      expect(stats.resolvedThisMonth).toBe(1);
    });

    it('exclut les techniciens désactivés du suivi de charge', async () => {
      const token = await adminToken();
      await createTestUser({ role: 'TECHNICIAN', isActive: true });
      await createTestUser({ role: 'TECHNICIAN', isActive: false });

      const response = await request(app)
        .get('/api/stats/technicians')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body).toHaveLength(1);
    });

    it('ne comptabilise que les rôles techniciens', async () => {
      const token = await adminToken();
      await createTestUser({ role: 'TECHNICIAN' });
      await createTestUser({ role: 'USER' });
      await createTestLocation();

      const response = await request(app)
        .get('/api/stats/technicians')
        .set('Authorization', `Bearer ${token}`);

      // L'administrateur créé pour le test n'est pas comptabilisé non plus
      expect(response.body).toHaveLength(1);
    });
  });
});