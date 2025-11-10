const { Pool } = require('pg');
require('dotenv').config();

let pool;

if (process.env.DATABASE_URL) {
  // ✅ Mode PRODUCTION (Render / Railway / Neon)
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log("🌍 Mode Production : Connexion à PostgreSQL via DATABASE_URL");
} else {
  // ✅ Mode LOCAL (XAMPP / Postgres local)
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    port: process.env.DB_PORT || 5432,
    ssl: false
  });
  console.log("💻 Mode Local : Connexion à PostgreSQL local");
}

pool.connect((err) => {
  if (err) {
    console.error('❌ Erreur lors de la connexion PostgreSQL:', err.message);
  } else {
    console.log('✅ Connecté à PostgreSQL avec succès!');
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
