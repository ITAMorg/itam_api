import { prismaTest } from './prisma';

/**
 * Vide toutes les tables métier de la BDD de test.
 *
 * À appeler dans un beforeEach() de chaque fichier de test pour garantir
 * l'isolation : chaque test démarre avec une BDD vide et reproductible.
 *
 * Stratégie : TRUNCATE ... RESTART IDENTITY CASCADE
 *  - TRUNCATE   : plus rapide que DELETE (pas de scan ligne à ligne)
 *  - RESTART IDENTITY : réinitialise les séquences auto-increment
 *  - CASCADE    : gère automatiquement les FK sans se soucier de l'ordre
 *
 * Garde-fou : refuse de tourner si DATABASE_URL ne pointe pas sur test.
 * Triple protection après env.ts et setup.ts — on ne veut PAS truncater
 * accidentellement la BDD de dev.
 */
export async function cleanDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL?.includes('test')) {
    throw new Error(
      '❌ cleanDatabase : refus de truncater — DATABASE_URL ne cible pas test.'
    );
  }

  // Ordre logique enfants -> parents (CASCADE gère les FK, mais l'ordre reste explicite)
  const tables = [
    'TicketAttachment',
    'TicketComment',
    'Ticket',
    'AssetLifecycle',
    'Asset',
    'AssetType',
    'Supplier',
    'Location',
    'RefreshToken',
    'User',
  ];

  const tablesList = tables.map((t) => `"${t}"`).join(', ');

  await prismaTest.$executeRawUnsafe(
    `TRUNCATE TABLE ${tablesList} RESTART IDENTITY CASCADE;`
  );
}