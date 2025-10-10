const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  // Créer un utilisateur
  static async create(userData) {
    try {
      const { nom, prenom, email, password, telephone, role, photo_profil } = userData;
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      let statut = 'en_attente';
      if (role === 'donateur') statut = 'actif';
      if (role === 'admin') statut = 'actif';

      const query = `
        INSERT INTO users (nom, prenom, email, password, telephone, role, statut, photo_profil)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, nom, prenom, email, telephone, role, statut, photo_profil, date_creation
      `;
      
      const values = [nom, prenom, email, hashedPassword, telephone, role, statut, photo_profil || null];
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erreur création utilisateur:', error);
      throw error;
    }
  }

  // Trouver par email - CORRECTION
  static async findByEmail(email) {
    try {
      const query = `
        SELECT id, nom, prenom, email, telephone, role, statut, 
               photo_profil, password, date_creation  -- ← CHANGEMENT: password au lieu de mot_de_passe
        FROM users 
        WHERE email = $1
      `;
      const values = [email];
      
      const result = await db.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Erreur findByEmail:', error);
      throw error;
    }
  }

  // Trouver par ID
  static async findById(id) {
    try {
      const query = `
        SELECT id, nom, prenom, email, telephone, role, statut, 
               photo_profil, date_creation
        FROM users 
        WHERE id = $1
      `;
      const values = [id];
      
      const result = await db.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Erreur findById:', error);
      throw error;
    }
  }

  // Mettre à jour le statut
  static async updateStatus(id, statut) {
    try {
      const query = `
        UPDATE users 
        SET statut = $1, date_modification = CURRENT_TIMESTAMP 
        WHERE id = $2 
        RETURNING id, nom, prenom, email, role, statut
      `;
      const result = await db.query(query, [statut, id]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erreur updateStatus:', error);
      throw error;
    }
  }

  // Trouver les utilisateurs en attente
  static async findPending() {
    try {
      const query = `
        SELECT id, nom, prenom, email, telephone, role, statut, photo_profil, date_creation 
        FROM users 
        WHERE role = 'personnel' AND statut = 'en_attente'
        ORDER BY date_creation DESC
      `;
      const result = await db.query(query);
      console.log('🔍 Users trouvés en attente:', result.rows.length);
      return result.rows;
    } catch (error) {
      console.error('❌ Erreur findPending:', error);
      throw error;
    }
  }

  // Vérifier si admin existe
  static async adminExists() {
    try {
      const query = 'SELECT COUNT(*) FROM users WHERE role = $1';
      const result = await db.query(query, ['admin']);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('❌ Erreur adminExists:', error);
      throw error;
    }
  }

  // Récupérer tous les utilisateurs
  static async findAll() {
    try {
      const query = `
        SELECT id, nom, prenom, email, telephone, role, statut, photo_profil, date_creation 
        FROM users 
        ORDER BY date_creation DESC
      `;
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Erreur findAll:', error);
      throw error;
    }
  }

  // Mettre à jour un utilisateur
  static async update(id, userData) {
    try {
      const { nom, prenom, email, telephone, role, statut, photo_profil } = userData;
      
      // Construire la requête dynamiquement
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (nom !== undefined) {
        fields.push(`nom = $${paramCount}`);
        values.push(nom);
        paramCount++;
      }
      if (prenom !== undefined) {
        fields.push(`prenom = $${paramCount}`);
        values.push(prenom);
        paramCount++;
      }
      if (email !== undefined) {
        fields.push(`email = $${paramCount}`);
        values.push(email);
        paramCount++;
      }
      if (telephone !== undefined) {
        fields.push(`telephone = $${paramCount}`);
        values.push(telephone);
        paramCount++;
      }
      if (role !== undefined) {
        fields.push(`role = $${paramCount}`);
        values.push(role);
        paramCount++;
      }
      if (statut !== undefined) {
        fields.push(`statut = $${paramCount}`);
        values.push(statut);
        paramCount++;
      }
      if (photo_profil !== undefined) {
        fields.push(`photo_profil = $${paramCount}`);
        values.push(photo_profil);
        paramCount++;
      }

      // Ajouter la date de modification
      fields.push(`date_modification = CURRENT_TIMESTAMP`);

      if (fields.length === 0) {
        throw new Error('Aucun champ à mettre à jour');
      }

      values.push(id);
      
      const query = `
        UPDATE users 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, nom, prenom, email, telephone, role, statut, photo_profil, date_creation
      `;
      
      console.log('📝 Requête UPDATE:', query);
      console.log('📋 Valeurs:', values);
      
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erreur update:', error);
      throw error;
    }
  }

  // Supprimer un utilisateur
  static async delete(id) {
    try {
      const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
      const result = await db.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erreur delete:', error);
      throw error;
    }
  }

  // Mettre à jour la photo de profil
  static async updatePhotoProfil(userId, photoPath) {
    try {
      console.log('📝 Mise à jour photo profil pour user:', userId, 'photo:', photoPath);
      
      const query = `
        UPDATE users 
        SET photo_profil = $1 
        WHERE id = $2 
        RETURNING id, nom, prenom, email, telephone, role, photo_profil, statut
      `;
      const values = [photoPath, userId];
      
      console.log('📋 Query:', query);
      console.log('📦 Values:', values);
      
      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        console.log('❌ Aucun utilisateur trouvé avec ID:', userId);
        return null;
      }
      
      console.log('✅ Photo mise à jour avec succès:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erreur SQL updatePhotoProfil:', error);
      throw error;
    }
  }

  // Compter le nombre total d'utilisateurs
  static async count() {
    try {
      const query = 'SELECT COUNT(*) FROM users';
      const result = await db.query(query);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('❌ Erreur count:', error);
      throw error;
    }
  }

  // Récupérer les statistiques des utilisateurs
  static async getStats() {
    try {
      const totalQuery = 'SELECT COUNT(*) FROM users';
      const roleQuery = 'SELECT role, COUNT(*) as count FROM users GROUP BY role';
      const statusQuery = 'SELECT statut, COUNT(*) as count FROM users GROUP BY statut';

      const [totalResult, roleResult, statusResult] = await Promise.all([
        db.query(totalQuery),
        db.query(roleQuery),
        db.query(statusQuery)
      ]);

      return {
        total: parseInt(totalResult.rows[0].count),
        byRole: roleResult.rows.reduce((acc, row) => {
          acc[row.role] = parseInt(row.count);
          return acc;
        }, {}),
        byStatus: statusResult.rows.reduce((acc, row) => {
          acc[row.statut] = parseInt(row.count);
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('❌ Erreur getStats:', error);
      throw error;
    }
  }
}

module.exports = User;