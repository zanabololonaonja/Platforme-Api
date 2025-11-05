const db = require('../config/database');

class Don {
  // Créer un don
  static async create({ id_campagne, montant, type_don, moyen_paiement, donateur }) {
    const query = `
      INSERT INTO dons (id_campagne, montant, type_don, moyen_paiement, donateur, date_don)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    const values = [id_campagne, montant, type_don, moyen_paiement, JSON.stringify(donateur)];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Récupérer tous les dons
  static async getAll() {
    const query = `SELECT * FROM dons ORDER BY date_don DESC`;
    const result = await db.query(query);
    return result.rows;
  }

  // Récupérer les dons d'une campagne
  static async getByCampagne(id_campagne) {
    const query = `SELECT * FROM dons WHERE id_campagne=$1 ORDER BY date_don DESC`;
    const result = await db.query(query, [id_campagne]);
    return result.rows;
  }
}

module.exports = Don;
