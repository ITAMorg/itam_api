import * as dotenv from 'dotenv';
import * as path from 'path';

// Charge .env.test uniquement si le fichier existe (utile en local, ignoré en CI)
// En CI, les variables sont injectées directement par le workflow GitHub Actions.
dotenv.config({
  path: path.resolve(__dirname, '../../.env.test'),
});

// Vérification défensive : DATABASE_URL doit pointer sur une base de TEST
// (nom contenant "test") pour éviter d'écraser accidentellement la BDD de dev/prod.
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('test')) {
  throw new Error(
    '❌ Configuration de test invalide : DATABASE_URL doit pointer sur une base de test ' +
    '(le nom de la base doit contenir "test"). ' +
    'En local : vérifie que .env.test existe et pointe sur itam_test. ' +
    'En CI : vérifie que les env vars sont injectées par le workflow.'
  );
}

if (process.env.NODE_ENV !== 'test') {
  throw new Error(
    '❌ NODE_ENV doit être "test" pour lancer les tests.'
  );
}