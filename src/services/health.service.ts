import prisma from '../config/prisma';
import { logger } from '../config/logger';

/**
 * Contrôles de santé de l'API ITAM.
 *
 * Deux sondes de finalité distincte :
 *
 * - `liveness`  : le processus répond-il ? Ne dépend d'aucune ressource
 *                 externe. Un échec appelle un redémarrage.
 * - `readiness` : le service est-il apte à traiter des requêtes ?
 *                 Vérifie la base de données. Un échec appelle un
 *                 retrait du trafic, pas un redémarrage : redémarrer
 *                 n'a aucun effet sur une base indisponible.
 **/
const DB_TIMEOUT_MS = Number(process.env.HEALTH_DB_TIMEOUT_MS) || 3000;

const DB_SLOW_THRESHOLD_MS =
  Number(process.env.HEALTH_DB_SLOW_MS) || 500;

export type DependencyStatus = 'up' | 'degraded' | 'down';

export interface DependencyCheck {
  status: DependencyStatus;
  responseTimeMs: number;
  error?: string;
}

export interface ReadinessReport {
  status: DependencyStatus;
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: DependencyCheck;
  };
}

export interface LivenessReport {
  status: 'up';
  timestamp: string;
  uptimeSeconds: number;
}

const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
  let timer: NodeJS.Timeout;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} : délai de ${timeoutMs} ms dépassé`)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  }) as Promise<T>;
};

/**
 * Sonde de vivacité.
 *
 * Ne consulte aucune ressource externe : si cette fonction s'exécute,
 * le processus Node est vivant et sa boucle d'événements n'est pas
 * bloquée.
 */
export const checkLiveness = (): LivenessReport => ({
  status: 'up',
  timestamp: new Date().toISOString(),
  uptimeSeconds: Math.floor(process.uptime()),
});

/**
 * Contrôle de la base de données.
 *
 * Exécute la requête la plus légère possible. L'objectif n'est pas de
 * valider le schéma mais d'établir qu'une connexion est disponible dans
 * le pool et que le serveur répond dans un délai acceptable.
 *
 * Le temps de réponse est mesuré et retourné : il constitue en
 * lui-même un indicateur de supervision, distinct du simple état
 * disponible ou non.
 */
export const checkDatabase = async (): Promise<DependencyCheck> => {
  const startedAt = process.hrtime.bigint();

  try {
    await withTimeout(
      prisma.$queryRaw`SELECT 1`,
      DB_TIMEOUT_MS,
      'Contrôle de la base de données',
    );

    const responseTimeMs = Number(
      (process.hrtime.bigint() - startedAt) / 1_000_000n,
    );

    const status: DependencyStatus =
      responseTimeMs > DB_SLOW_THRESHOLD_MS ? 'degraded' : 'up';

    if (status === 'degraded') {
      logger.warn(
        { responseTimeMs, thresholdMs: DB_SLOW_THRESHOLD_MS },
        'Base de données lente',
      );
    }

    return { status, responseTimeMs };
    } catch (error) {
    const responseTimeMs = Number(
      (process.hrtime.bigint() - startedAt) / 1_000_000n,
    );

    logger.error(
      { err: error, responseTimeMs },
      'Base de données injoignable',
    );

    const isTimeout =
      error instanceof Error &&
      error.message.includes('délai de');

    return {
      status: 'down',
      responseTimeMs,
      error: isTimeout
        ? 'Délai de réponse dépassé'
        : 'Base de données injoignable',
    };
  }
};

/**
 * Sonde d'aptitude au service.
 *
 * L'état global est celui de la dépendance la plus dégradée. Le rapport
 * détaille chaque contrôle afin qu'une alerte puisse désigner la cause
 * précise plutôt qu'un échec global.
 */
export const checkReadiness = async (): Promise<ReadinessReport> => {
  const database = await checkDatabase();

  return {
    status: database.status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    checks: { database },
  };
};