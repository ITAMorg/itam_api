import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Journalisation structurée de l'API ITAM.
 *
 * Toute sortie est émise en JSON sur stdout, horodatée en ISO 8601.
 * Ce format est une condition de l'exploitation automatisée : un
 * agrégateur de journaux peut indexer, filtrer et déclencher des alertes
 * sur des champs nommés, ce qu'une sortie texte ne permet pas.
 */

const NODE_ENV = process.env.NODE_ENV ?? 'development';

/**
 * Niveau de journalisation.
 * - test        : silencieux, pour ne pas noyer la sortie des tests
 * - autres      : pilotable par LOG_LEVEL, 'info' par défaut
 */
const resolveLevel = (): string => {
  if (NODE_ENV === 'test') return 'silent';
  return process.env.LOG_LEVEL ?? 'info';
};

/**
 * Champs systématiquement masqués avant écriture.
 *
 * Un journal est susceptible d'être transmis à un service tiers et
 * conservé durablement. Il ne doit jamais contenir de secret ni de
 * donnée d'authentification, y compris lorsqu'une erreur inattendue
 * conduit à sérialiser un objet entier.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.newPassword',
  'req.body.refreshToken',
  'res.headers["set-cookie"]',
  'accessToken',
  'refreshToken',
  'password',
];

export const logger = pino({
  level: resolveLevel(),
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'itam-api',
    env: NODE_ENV,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

/**
 * Identifiant de corrélation.
 *
 * Un identifiant unique est attribué à chaque requête et rappelé dans
 * toutes les lignes de journal qu'elle produit, ainsi que dans l'en-tête
 * de réponse `x-request-id`. Il devient ainsi possible de reconstituer
 * le parcours complet d'une requête, et à un utilisateur signalant une
 * anomalie de fournir la référence exacte de l'échange concerné.
 *
 * Un identifiant fourni par le client est réutilisé s'il est présent,
 * ce qui permet un suivi de bout en bout depuis les applications
 * Flutter.
 */
const genReqId = (req: IncomingMessage, res: ServerResponse): string => {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && incoming.length > 0
      ? incoming
      : randomUUID();
  res.setHeader('x-request-id', id);
  return id;
};

/**
 * Middleware de journalisation des requêtes HTTP.
 *
 * Remplace `morgan('dev')`. Chaque requête produit une ligne unique
 * contenant méthode, chemin, statut, durée et identifiant de
 * corrélation. Le niveau est calculé à partir du code de statut, ce qui
 * permet de filtrer les anomalies sans analyser le texte du message.
 */
export const httpLogger = pinoHttp({
  logger,

  genReqId,

  customLogLevel: (_req, res, err) => {
    if (err) return 'error';
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },

  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,

  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,

  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});