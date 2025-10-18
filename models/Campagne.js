const db = require('../config/database');

class Campagne {
  static async create({ titre, description, dateDebut, dateFin, budget, image, auteur_id }) {
    const query = `
      INSERT INTO campagnes (titre, description, date_debut, date_fin, budget, image, auteur_id, date_creation)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    const values = [titre, description, dateDebut, dateFin, budget, image, auteur_id];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async getAll() {
    const query = `
      SELECT c.*, u.nom AS createur_nom, u.prenom AS createur_prenom
      FROM campagnes c
      LEFT JOIN users u ON c.auteur_id = u.id
      ORDER BY c.date_creation DESC
    `;
    const result = await db.query(query);
    return result.rows;
  }

  static async findById(id) {
    const query = `SELECT * FROM campagnes WHERE id = $1`;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async deleteById(id) {
    const query = `DELETE FROM campagnes WHERE id = $1 RETURNING *`;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Campagne;
