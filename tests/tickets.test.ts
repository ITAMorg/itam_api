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
 * Tests d'intégration des routes /api/tickets.
 *
 * Points démonstratifs particulièrement importants pour la grille RNCP :
 *  - Filtrage RBAC via la relation asset.locationId (démo OWASP A01)
 *  - Règles métier automatiques (transitions d'état + effets de bord sur assets)
 *  - Génération de référence auto-formatée (contrainte métier)
 *  - Premier commentaire déclenche transition OPEN → IN_PROGRESS
 */
describe('Tickets API', () => {
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

  // ─── Authentification requise ──────────────────────────────────────────────

  describe('Authentification', () => {
    it('refuse l\'accès à GET /api/tickets sans token (401)', async () => {
      const response = await request(app).get('/api/tickets');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Unauthorized');
    });
  });

  // ─── GET /api/tickets : filtrage RBAC par location d'asset ─────────────────

  describe('GET /api/tickets - Filtrage RBAC via asset.locationId', () => {
    it('un ADMIN voit tous les tickets, toutes locations confondues', async () => {
      const parisLoc = await createTestLocation({ name: 'Paris' });
      const lyonLoc = await createTestLocation({ name: 'Lyon' });
      const type = await createTestAssetType();

      const parisAsset = await createTestAsset({ typeId: type.id, locationId: parisLoc.id });
      const lyonAsset = await createTestAsset({ typeId: type.id, locationId: lyonLoc.id });

      const requester = await createTestUser({ email: 'req@test.local' });

      await createTestTicket({ requesterId: requester.id, assetId: parisAsset.id });
      await createTestTicket({ requesterId: requester.id, assetId: lyonAsset.id });

      await createTestUser({
        email: 'admin@test.local',
        password: 'AdminPass123',
        role: 'ADMIN',
      });
      const token = await loginAs('admin@test.local', 'AdminPass123');

      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('un USER ne voit QUE les tickets dont l\'asset est dans sa location (OWASP A01)', async () => {
      const parisLoc = await createTestLocation({ name: 'Paris' });
      const lyonLoc = await createTestLocation({ name: 'Lyon' });
      const type = await createTestAssetType();

      const parisAsset = await createTestAsset({ typeId: type.id, locationId: parisLoc.id });
      const lyonAsset = await createTestAsset({ typeId: type.id, locationId: lyonLoc.id });

      const requester = await createTestUser({ email: 'req@test.local' });

      const parisTicket = await createTestTicket({
        requesterId: requester.id,
        assetId: parisAsset.id,
        title: 'Ticket Paris',
      });
      await createTestTicket({
        requesterId: requester.id,
        assetId: lyonAsset.id,
        title: 'Ticket Lyon',
      });

      await createTestUser({
        email: 'user-paris@test.local',
        password: 'UserPass123',
        role: 'USER',
        locationId: parisLoc.id,
      });
      const token = await loginAs('user-paris@test.local', 'UserPass123');

      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(parisTicket.id);
      expect(response.body[0].title).toBe('Ticket Paris');
    });

    it('un USER ne voit PAS les tickets sans asset (comportement du filtrage par relation)', async () => {
      // Comportement à noter : le filtre `asset.locationId` exclut mécaniquement
      // les tickets où assetId est null, même s'ils ont été créés par l'utilisateur.
      // Test documentaire pour tracer ce comportement (axe d'évolution possible).
      const parisLoc = await createTestLocation({ name: 'Paris' });
      const requester = await createTestUser({
        email: 'requester@test.local',
        password: 'ReqPass123',
        role: 'USER',
        locationId: parisLoc.id,
      });

      // Ticket sans asset (assetId = null)
      await createTestTicket({ requesterId: requester.id, assetId: null });

      const token = await loginAs('requester@test.local', 'ReqPass123');

      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });
  });

  // ─── POST /api/tickets : création par tous les rôles ───────────────────────

  describe('POST /api/tickets - Création', () => {
    it('un USER peut créer un ticket (droit métier essentiel)', async () => {
      const user = await createTestUser({
        email: 'user@test.local',
        password: 'UserPass123',
        role: 'USER',
      });
      const token = await loginAs('user@test.local', 'UserPass123');

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Mon écran ne fonctionne plus',
          description: 'Écran noir depuis ce matin',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        title: 'Mon écran ne fonctionne plus',
        status: 'OPEN', // valeur par défaut
        priority: 'MEDIUM', // valeur par défaut
        type: 'INCIDENT', // valeur par défaut
      });
      // Le requesterId doit être auto-défini à partir du token, pas du body
      expect(response.body.requesterId).toBe(user.id);
    });

    it('génère une référence auto au format TKT-YYYY-XXXXX', async () => {
      await createTestUser({
        email: 'user@test.local',
        password: 'UserPass123',
        role: 'USER',
      });
      const token = await loginAs('user@test.local', 'UserPass123');

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test référence auto',
        });

      const currentYear = new Date().getFullYear();
      expect(response.body.reference).toMatch(
        new RegExp(`^TKT-${currentYear}-\\d{5}$`)
      );
    });
  });

  // ─── PATCH /api/tickets/:id : permissions ──────────────────────────────────

  describe('PATCH /api/tickets/:id - Permissions', () => {
    it('un USER ne peut PAS modifier un ticket (403)', async () => {
      const type = await createTestAssetType();
      const asset = await createTestAsset({ typeId: type.id });
      const requester = await createTestUser({ email: 'req@test.local' });
      const ticket = await createTestTicket({
        requesterId: requester.id,
        assetId: asset.id,
      });

      await createTestUser({
        email: 'user@test.local',
        password: 'UserPass123',
        role: 'USER',
      });
      const token = await loginAs('user@test.local', 'UserPass123');

      const response = await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', 'Forbidden');
    });

    it('un TECHNICIAN peut modifier un ticket', async () => {
      const type = await createTestAssetType();
      const asset = await createTestAsset({ typeId: type.id });
      const requester = await createTestUser({ email: 'req@test.local' });
      const ticket = await createTestTicket({
        requesterId: requester.id,
        assetId: asset.id,
      });

      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      const response = await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ priority: 'HIGH' });

      expect(response.status).toBe(200);
      expect(response.body.priority).toBe('HIGH');
    });
  });

  // ─── PATCH /api/tickets/:id : logique métier des transitions ───────────────

  describe('PATCH /api/tickets/:id - Transitions métier', () => {
    it('passer un ticket à RESOLVED définit automatiquement resolvedAt', async () => {
      const type = await createTestAssetType();
      const asset = await createTestAsset({ typeId: type.id });
      const requester = await createTestUser({ email: 'req@test.local' });
      const ticket = await createTestTicket({
        requesterId: requester.id,
        assetId: asset.id,
        status: 'IN_PROGRESS',
      });

      await createTestUser({
        email: 'admin@test.local',
        password: 'AdminPass123',
        role: 'ADMIN',
      });
      const token = await loginAs('admin@test.local', 'AdminPass123');

      const response = await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'RESOLVED' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('RESOLVED');
      expect(response.body.resolvedAt).not.toBeNull();
      const resolvedAt = new Date(response.body.resolvedAt).getTime();
      expect(Date.now() - resolvedAt).toBeLessThan(5000);
    });

    it('passer un ticket à IN_PROGRESS met l\'asset lié en MAINTENANCE (effet de bord)', async () => {
      const type = await createTestAssetType();
      const asset = await createTestAsset({
        typeId: type.id,
        status: 'IN_SERVICE',
      });
      const requester = await createTestUser({ email: 'req@test.local' });
      const ticket = await createTestTicket({
        requesterId: requester.id,
        assetId: asset.id,
        status: 'OPEN',
      });

      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'IN_PROGRESS' });

      const updatedAsset = await prismaTest.asset.findUnique({
        where: { id: asset.id },
      });
      expect(updatedAsset!.status).toBe('MAINTENANCE');
    });

        it('rouvrir un ticket bas remet l\'asset en MAINTENANCE', async () => {
      const type = await createTestAssetType();
      const asset = await createTestAsset({
        typeId: type.id,
        status: 'IN_SERVICE',
      });
      const requester = await createTestUser({ email: 'req-reopen@test.local' });

      const ticket = await createTestTicket({
        requesterId: requester.id,
        assetId: asset.id,
        status: 'RESOLVED',
        priority: 'LOW',
      });

      await createTestUser({
        email: 'tech-reopen@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech-reopen@test.local', 'TechPass123');

      await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'OPEN' });

      const updatedAsset = await prismaTest.asset.findUnique({
        where: { id: asset.id },
      });

      expect(updatedAsset!.status).toBe('MAINTENANCE');
    });

    it('rouvrir un ticket haut remet l\'asset en BROKEN', async () => {
      const type = await createTestAssetType();
      const asset = await createTestAsset({
        typeId: type.id,
        status: 'IN_SERVICE',
      });
      const requester = await createTestUser({ email: 'req-crit@test.local' });

      const ticket = await createTestTicket({
        requesterId: requester.id,
        assetId: asset.id,
        status: 'CLOSED',
        priority: 'HIGH',
      });

      await createTestUser({
        email: 'tech-crit@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech-crit@test.local', 'TechPass123');

      await request(app)
        .patch(`/api/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'OPEN' });

      const updatedAsset = await prismaTest.asset.findUnique({
        where: { id: asset.id },
      });

      expect(updatedAsset!.status).toBe('BROKEN');
    });
  });

  // ─── DELETE /api/tickets/:id : permissions strictes ADMIN ──────────────────

  describe('DELETE /api/tickets/:id - Suppression', () => {
    it('un ADMIN peut supprimer un ticket (204)', async () => {
      const requester = await createTestUser({ email: 'req@test.local' });
      const ticket = await createTestTicket({ requesterId: requester.id });

      await createTestUser({
        email: 'admin@test.local',
        password: 'AdminPass123',
        role: 'ADMIN',
      });
      const token = await loginAs('admin@test.local', 'AdminPass123');

      const response = await request(app)
        .delete(`/api/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);

      const deletedTicket = await prismaTest.ticket.findUnique({
        where: { id: ticket.id },
      });
      expect(deletedTicket).toBeNull();
    });

    it('un TECHNICIAN ne peut PAS supprimer un ticket (403)', async () => {
      const requester = await createTestUser({ email: 'req@test.local' });
      const ticket = await createTestTicket({ requesterId: requester.id });

      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      const response = await request(app)
        .delete(`/api/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);

      const stillThere = await prismaTest.ticket.findUnique({
        where: { id: ticket.id },
      });
      expect(stillThere).not.toBeNull();
    });
  });

  // ─── POST /api/tickets/:id/actions : logique métier riche ──────────────────

  describe('POST /api/tickets/:id/actions - Ajout de commentaires et transitions auto', () => {
    it('le premier commentaire fait passer un ticket OPEN en IN_PROGRESS et l\'asset en MAINTENANCE', async () => {
      // C'est une règle métier automatisée : ajouter un commentaire signifie
      // "un technicien s'occupe du ticket", donc transition d'état + effet de bord sur asset
      const type = await createTestAssetType();
      const asset = await createTestAsset({
        typeId: type.id,
        status: 'IN_SERVICE',
      });
      const requester = await createTestUser({ email: 'req@test.local' });
      const ticket = await createTestTicket({
        requesterId: requester.id,
        assetId: asset.id,
        status: 'OPEN',
      });

      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      const response = await request(app)
        .post(`/api/tickets/${ticket.id}/actions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Je prends en charge le ticket' });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe('Je prends en charge le ticket');

      // Vérifications des effets de bord en base
      const updatedTicket = await prismaTest.ticket.findUnique({
        where: { id: ticket.id },
      });
      expect(updatedTicket!.status).toBe('IN_PROGRESS');

      const updatedAsset = await prismaTest.asset.findUnique({
        where: { id: asset.id },
      });
      expect(updatedAsset!.status).toBe('MAINTENANCE');
    });

    it('un deuxième commentaire ne modifie plus l\'état du ticket (déjà en IN_PROGRESS)', async () => {
      const requester = await createTestUser({ email: 'req@test.local' });
      const ticket = await createTestTicket({
        requesterId: requester.id,
        status: 'IN_PROGRESS',
      });

      await createTestUser({
        email: 'tech@test.local',
        password: 'TechPass123',
        role: 'TECHNICIAN',
      });
      const token = await loginAs('tech@test.local', 'TechPass123');

      // Ajout d'un premier commentaire (le ticket est déjà IN_PROGRESS, donc pas de transition)
      await request(app)
        .post(`/api/tickets/${ticket.id}/actions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Premier commentaire' });

      // Le ticket reste IN_PROGRESS
      const updatedTicket = await prismaTest.ticket.findUnique({
        where: { id: ticket.id },
      });
      expect(updatedTicket!.status).toBe('IN_PROGRESS');
    });
  });
});