const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'onja',
  database: 'ndaohifanosika',
  port: 5432,
  // PAS de SSL pour PostgreSQL local
});

pool.connect((err) => {
  if (err) {
    console.error('❌ Erreur PostgreSQL:', err.stack);
  } else {
    console.log('✅ Connecté à PostgreSQL avec succès!');
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};