import { Request, Response, NextFunction } from 'express';
import { Prisma } from '.prisma/client';
import { logger } from '../config/logger';
import { AppError, isAppError } from '../errors/AppError';

/**
 * Traitement centralisé des erreurs.
 *
 * Ce middleware constitue le point de sortie unique de toute erreur
 * survenue pendant le traitement d'une requête. Il remplit trois
 * fonctions que les blocs `try/catch` dispersés dans les contrôleurs ne
 * pouvaient pas assurer de façon cohérente :
 *
 *   1. attribuer un statut HTTP conforme à la nature réelle de
 *      l'erreur, plutôt qu'un 500 systématique ;
 *   2. empêcher toute fuite de détail d'implémentation vers le client ;
 *   3. garantir qu'aucune erreur ne passe sans être journalisée, avec
 *      l'identifiant de corrélation de la requête concernée.
 *
 * Express 5 transmet nativement à ce middleware les rejets de promesse
 * issus des gestionnaires asynchrones : aucun emballage n'est requis.
 */

interface ErrorResponseBody {
  message: string;
  code: string;
  requestId?: string;
}

/**
 * Correspondance entre les codes d'erreur Prisma et les statuts HTTP.
 *
 * Sans cette table, toute contrainte violée en base remonte en 500,
 * c'est-à-dire « le serveur a échoué » — alors qu'un email déjà
 * utilisé relève d'une requête en conflit avec l'état des données, que
 * le client peut corriger.
 */
const mapPrismaError = (
  error: Prisma.PrismaClientKnownRequestError,
): AppError => {
  switch (error.code) {
    // Violation de contrainte d'unicité
    case 'P2002': {
      const target = (error.meta?.target as string[] | undefined)?.join(', ');
      return new AppError(
        409,
        target
          ? `Cette valeur est déjà utilisée pour : ${target}.`
          : 'Cette valeur est déjà utilisée.',
        'CONFLICT',
        { prismaCode: error.code, target },
      );
    }

    // Enregistrement requis introuvable
    case 'P2025':
      return new AppError(
        404,
        'Ressource introuvable.',
        'NOT_FOUND',
        { prismaCode: error.code, cause: error.meta?.cause },
      );

    // Violation de contrainte de clé étrangère
    case 'P2003':
      return new AppError(
        409,
        "Cette opération est impossible : la ressource est liée à d'autres données.",
        'FOREIGN_KEY_CONFLICT',
        { prismaCode: error.code, field: error.meta?.field_name },
      );

    // Valeur trop longue pour la colonne
    case 'P2000':
      return new AppError(
        400,
        'Une valeur fournie dépasse la longueur autorisée.',
        'VALUE_TOO_LONG',
        { prismaCode: error.code, column: error.meta?.column_name },
      );

    default:
      return new AppError(
        500,
        'Une erreur est survenue lors du traitement de la requête.',
        'DATABASE_ERROR',
        { prismaCode: error.code },
      );
  }
};

/**
 * Ramène une exception quelconque à une `AppError`.
 */
const normalize = (error: unknown): AppError => {
  if (isAppError(error)) return error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return mapPrismaError(error);
  }

  // Données non conformes au schéma attendu par Prisma : la requête
  // est en cause, pas le serveur.
  if (error instanceof Prisma.PrismaClientValidationError) {
    return new AppError(
      400,
      'Les données fournies sont invalides.',
      'VALIDATION_ERROR',
    );
  }

  // Charge utile JSON malformée, rejetée par express.json().
  if (
    error instanceof SyntaxError &&
    'body' in error &&
    (error as SyntaxError & { status?: number }).status === 400
  ) {
    return new AppError(
      400,
      'Le corps de la requête est un JSON invalide.',
      'MALFORMED_JSON',
    );
  }

  // Défaillance non anticipée : le message d'origine ne doit pas
  // franchir la frontière de l'API.
  return new AppError(
    500,
    'Une erreur interne est survenue.',
    'INTERNAL_ERROR',
  );
};

/**
 * Gestionnaire de route inconnue.
 *
 * Monté après toutes les routes applicatives. Sans lui, une URL
 * inexistante reçoit la page d'erreur HTML par défaut d'Express, ce qui
 * rompt le contrat de l'API — un client attendant du JSON reçoit du
 * balisage — et laisse ces requêtes hors du dispositif de
 * journalisation.
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  next(
    new AppError(
      404,
      `Route inconnue : ${req.method} ${req.path}`,
      'ROUTE_NOT_FOUND',
    ),
  );
};

/**
 * Gestionnaire d'erreurs.
 *
 * La signature à quatre paramètres est ce qui permet à Express
 * d'identifier ce middleware comme gestionnaire d'erreurs ; le
 * paramètre `next` doit donc être conservé même inutilisé.
 */
export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const appError = normalize(error);
  const requestId = req.id as string | undefined;

  const logContext = {
    reqId: requestId,
    method: req.method,
    path: req.path,
    statusCode: appError.statusCode,
    code: appError.code,
    details: appError.details,
    err: error,
  };

  // Le niveau distingue ce qui appelle une intervention de ce qui
  // relève du fonctionnement normal. Une alerte se déclenche sur
  // `error`, jamais sur `warn`.
  if (appError.statusCode >= 500) {
    logger.error(logContext, 'Erreur non anticipée');
  } else {
    logger.warn(logContext, 'Requête rejetée');
  }

  // Une réponse partiellement envoyée ne peut plus être modifiée :
  // la connexion est confiée à Express, qui l'interrompra.
  if (res.headersSent) {
    logger.error(
      { reqId: requestId },
      'Erreur survenue après envoi des en-têtes',
    );
    return;
  }

  const body: ErrorResponseBody = {
    message: appError.message,
    code: appError.code,
  };

  // L'identifiant est renvoyé au client afin qu'un utilisateur
  // signalant une anomalie puisse fournir la référence exacte de
  // l'échange, et que le diagnostic remonte directement à la trace.
  if (requestId) body.requestId = requestId;

  res.status(appError.statusCode).json(body);
};