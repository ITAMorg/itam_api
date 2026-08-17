import 'dotenv/config';
import app from './app';
import { logger } from './config/logger';
import prisma from './config/prisma';
import { autoCloseResolvedTickets } from './jobs/autoCloseTickets';

const PORT = Number(process.env.PORT) || 3000;

const AUTO_CLOSE_INTERVAL_MS = 24 * 60 * 60 * 1000;

autoCloseResolvedTickets();
const autoCloseTimer = setInterval(
  autoCloseResolvedTickets,
  AUTO_CLOSE_INTERVAL_MS,
);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'ITAM API démarrée');
});

/**
 * Capture des défaillances non rattrapées.
 *
 * Sans ces gestionnaires, une exception non traitée ou un rejet de
 * promesse ignoré termine le processus sans laisser la moindre trace :
 * la supervision constate une indisponibilité sans pouvoir en établir
 * la cause. Le journal est écrit avant la sortie du processus.
 */
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Exception non rattrapée — arrêt du processus');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Rejet de promesse non traité');
});

/**
 * Arrêt maîtrisé.
 *
 * À réception d'un signal d'arrêt, le serveur cesse d'accepter de
 * nouvelles connexions, laisse les requêtes en cours se terminer, puis
 * ferme le pool de connexions à la base. Sans cette séquence, un
 * redéploiement interrompt les requêtes en vol et abandonne des
 * connexions ouvertes côté PostgreSQL.
 *
 * Un délai de grâce borne l'attente : passé ce délai, le processus est
 * terminé même si des requêtes sont encore actives.
 */
const SHUTDOWN_TIMEOUT_MS = 10_000;

const shutdown = (signal: string): void => {
  logger.info({ signal }, 'Signal d’arrêt reçu — fermeture en cours');

  clearInterval(autoCloseTimer);

  const forceExit = setTimeout(() => {
    logger.error(
      { timeoutMs: SHUTDOWN_TIMEOUT_MS },
      'Délai de grâce dépassé — arrêt forcé',
    );
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  // Empêche le minuteur de maintenir le processus en vie à lui seul.
  forceExit.unref();

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Erreur lors de la fermeture du serveur HTTP');
      process.exit(1);
    }

    try {
      await prisma.$disconnect();
      logger.info('Connexions à la base fermées — arrêt terminé');
      process.exit(0);
    } catch (disconnectError) {
      logger.error(
        { err: disconnectError },
        'Erreur lors de la fermeture des connexions à la base',
      );
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));