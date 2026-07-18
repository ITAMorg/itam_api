import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * Setup global exécuté UNE SEULE FOIS avant toute la suite de tests.
 *
 * Rôle :
 *  1. Recharger explicitement .env.test (globalSetup tourne dans un process séparé
 *     de setupFiles, donc les variables ne sont pas héritées automatiquement)
 *  2. Appliquer les migrations Prisma sur la BDD itam_test pour garantir
 *     que le schéma est à jour avant que les tests ne tournent
 *
 * Référence : https://jestjs.io/docs/configuration#globalsetup-string
 */
export default async function globalSetup(): Promise<void> {
  // globalSetup tourne dans un process Node isolé : on recharge .env.test manuellement
  dotenv.config({
    path: path.resolve(__dirname, '../../.env.test'),
  });

  // Garde-fou critique : impossible de continuer si on ne cible pas itam_test
  if (!process.env.DATABASE_URL?.includes('itam_test')) {
    throw new Error(
      '❌ globalSetup : DATABASE_URL ne pointe pas sur itam_test. Abandon.'
    );
  }

  console.log('\n🔧 [Test Setup] Application des migrations Prisma sur itam_test...');

  try {
    // migrate deploy applique toutes les migrations existantes en mode idempotent
    // (ne crée pas de nouvelle migration, applique juste celles déjà versionnées)
    execSync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
      stdio: 'inherit',
    });

    console.log('✅ [Test Setup] Schéma de test prêt.\n');
  } catch (error) {
    console.error('❌ [Test Setup] Échec des migrations sur la BDD de test.');
    throw error;
  }
}