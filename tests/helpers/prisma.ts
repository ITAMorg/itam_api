import { PrismaClient } from '.prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Client Prisma dédié aux tests.
 *
 * Singleton exporté pour être utilisé par tous les helpers (cleanup, factories)
 * et par tous les fichiers de test. Utiliser un seul client partagé évite :
 *  - d'ouvrir 20 connexions inutiles au pool PostgreSQL
 *  - des race conditions entre tests
 *  - des fuites de connexions non fermées
 *
 * Important : ce client se connecte à la BDD définie par DATABASE_URL,
 * qui doit pointer sur itam_test (garanti par tests/helpers/env.ts).
 *
 * Prisma 7 : le moteur "client" nécessite un adapter explicite (PrismaPg ici),
 * même pattern que src/config/prisma.ts pour rester cohérent avec la prod.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prismaTest = new PrismaClient({
  adapter,
  log: ['error'], // silencieux sauf en cas d'erreur (évite le bruit dans les logs de tests)
});