import * as dotenv from 'dotenv';
import * as path from 'path';

// Charge les variables d'environnement depuis .env.test
// Ce fichier est exécuté par Jest AVANT tout autre import (voir setupFiles dans jest.config.ts)
// Objectif : garantir que DATABASE_URL pointe sur itam_test et non itam_dev
dotenv.config({
  path: path.resolve(__dirname, '../../.env.test'),
});

// Vérification défensive : si .env.test n'a pas été trouvé, on crashe immédiatement
// plutôt que de risquer de polluer la BDD de dev avec des tests
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('itam_test')) {
  throw new Error(
    '❌ Configuration de test invalide : DATABASE_URL doit pointer sur itam_test. ' +
    'Vérifie que .env.test existe à la racine et contient DATABASE_URL avec "itam_test".'
  );
}

if (process.env.NODE_ENV !== 'test') {
  throw new Error(
    '❌ NODE_ENV doit être "test" pour lancer les tests. Vérifie .env.test.'
  );
}