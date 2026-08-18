/**
 * Erreurs applicatives de l'API ITAM.
 *
 * Une `AppError` porte explicitement le statut HTTP attendu et un
 * message destiné au client. Elle distingue les erreurs *prévues* —
 * conflit, ressource absente, droits insuffisants — des défaillances
 * inattendues.
 *
 * Cette distinction commande le comportement du gestionnaire central :
 *
 *   - une `AppError` est un cas de figure anticipé : son message est
 *     transmis au client tel quel, et l'événement est journalisé au
 *     niveau `warn` ;
 *   - toute autre exception est une défaillance : son détail reste
 *     confiné au journal serveur au niveau `error`, et le client ne
 *     reçoit qu'un message générique.
 *
 * Sans cette séparation, le seul moyen de renvoyer un message
 * exploitable au client serait de lui transmettre le message brut de
 * l'exception — c'est-à-dire d'exposer des détails d'implémentation
 * (noms de tables, contraintes, requêtes) à un appelant non fiable.
 */
export class AppError extends Error {
  /** Statut HTTP à renvoyer. */
  public readonly statusCode: number;

  /**
   * Marque les erreurs anticipées par le code applicatif, par
   * opposition aux défaillances non prévues.
   */
  public readonly isOperational: boolean = true;

  /**
   * Code applicatif stable, indépendant du texte du message.
   * Il permet aux clients Flutter de réagir à une situation précise
   * sans analyser une chaîne de caractères susceptible d'évoluer.
   */
  public readonly code: string;

  /** Détail complémentaire, journalisé mais jamais transmis au client. */
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Sans cet appel, la pile d'appels inclut le constructeur
    // lui-même, ce qui masque le point d'origine réel de l'erreur.
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Fabriques par situation.
 *
 * Elles imposent un couple statut/code cohérent à travers toute
 * l'application : sans elles, un même cas de figure recevrait des
 * statuts différents selon le contrôleur qui le traite.
 */

/** 400 — la requête est malformée ou incomplète. */
export const badRequest = (
  message: string,
  details?: unknown,
): AppError => new AppError(400, message, 'BAD_REQUEST', details);

/** 401 — authentification absente, invalide ou expirée. */
export const unauthorized = (
  message = 'Authentification requise.',
): AppError => new AppError(401, message, 'UNAUTHORIZED');

/** 403 — authentifié, mais droits insuffisants. */
export const forbidden = (
  message = 'Accès refusé.',
): AppError => new AppError(403, message, 'FORBIDDEN');

/** 404 — la ressource demandée n'existe pas. */
export const notFound = (
  resource = 'Ressource',
): AppError =>
  new AppError(404, `${resource} introuvable.`, 'NOT_FOUND');

/**
 * 409 — la requête est valide mais entre en conflit avec l'état
 * actuel des données. Cas typique : une valeur devant être unique et
 * déjà utilisée.
 */
export const conflict = (
  message: string,
  details?: unknown,
): AppError => new AppError(409, message, 'CONFLICT', details);

/** 422 — requête bien formée mais métier invalide. */
export const unprocessable = (
  message: string,
  details?: unknown,
): AppError => new AppError(422, message, 'UNPROCESSABLE', details);

/**
 * Indique si une exception relève d'un cas anticipé.
 * Utilisé par le gestionnaire central pour décider du niveau de
 * journalisation et du contenu transmis au client.
 */
export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError;