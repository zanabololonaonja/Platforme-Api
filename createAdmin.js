const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'onja',
  database: 'ndaohifanosika',
  port: 5432,
});

async function createNewAdmin() {
  try {
    console.log('🔧 Création du nouvel admin...');
    
    // Générer un nouveau hash pour admin123
    const hashedPassword = await bcrypt.hash('admin123', 10);
    console.log('📦 Hash généré');

    // Supprimer l'ancien admin
    await pool.query("DELETE FROM users WHERE email = 'admin@ong.org'");
    console.log('🗑️ Ancien admin supprimé');
    
    // Créer le nouvel admin
    const result = await pool.query(`
      INSERT INTO users (nom, prenom, email, password, telephone, role, statut) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, role
    `, [
      'Admin', 
      'Super', 
      'admin@ong.org', 
      hashedPassword,
      '+261341234567', 
      'admin', 
      'actif'
    ]);

    console.log('✅ NOUVEL ADMIN CRÉÉ:', result.rows[0]);
    console.log('📧 Email: admin@ong.org');
    console('🔑 Mot de passe: admin123');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
  
  process.exit();
}

createNewAdmin();