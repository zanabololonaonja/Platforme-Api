const express = require("express");
const router = express.Router();
const db = require('../config/database');
const { sendDonReceipt } = require("../mail.js");

// 📌 Ajouter un don
router.post("/", async (req, res) => {
  try {
    const { id_campagne, montant, type_don, moyen_paiement, donateur } = req.body;

    console.log("🔹 Nouveau don reçu :", { id_campagne, montant, type_don, moyen_paiement, donateur });

    if (!id_campagne || !montant || !type_don || !moyen_paiement || !donateur) {
      console.warn("⚠️ Champs manquants dans le don");
      return res.status(400).json({ success: false, message: "Champs manquants." });
    }

    // Insérer le don dans la table
    const result = await db.query(
      `INSERT INTO dons (id_campagne, montant, type_don, moyen_paiement, donateur, date_don, id_donateur)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       RETURNING *`,
      [id_campagne, montant, type_don, moyen_paiement, JSON.stringify(donateur), donateur.id]
    );

    const don = result.rows[0];
    console.log("✅ Don enregistré :", don);

    // Envoyer le reçu fiscal
    if (donateur.email) {
      await sendDonReceipt(donateur.email, don);
      console.log("📧 Reçu envoyé à :", donateur.email);
    } else {
      console.warn("⚠️ Email du donateur manquant, reçu non envoyé");
    }

    res.status(200).json({
      success: true,
      message: "Don ajouté et reçu envoyé avec succès !",
      don,
    });

  } catch (err) {
    console.error("❌ Erreur lors du don :", err);
    res.status(500).json({ success: false, message: "Erreur serveur: " + err.message });
  }
});

// 📌 Historique des dons par email
router.get("/historique/email/:email", async (req, res) => {
  try {
    const { email } = req.params;
    console.log("🔹 Récupération historique pour email :", email);

    if (!email) {
      console.warn("⚠️ Email manquant pour récupérer l'historique");
      return res.status(400).json({ success: false, message: "Email manquant" });
    }

    const query = `
      SELECT 
        d.id, 
        d.montant, 
        d.date_don, 
        d.type_don, 
        d.moyen_paiement, 
        c.titre AS nom_campagne
      FROM dons d
      LEFT JOIN campagnes c ON d.id_campagne = c.id
      WHERE d.donateur->>'email' = $1
      ORDER BY d.date_don DESC
    `;

    const result = await db.query(query, [email]);
    console.log("🔹 Résultat SQL :", result.rows);

    res.status(200).json({
      success: true,
      dons: result.rows,
    });

  } catch (error) {
    console.error("❌ Erreur récupération historique dons :", error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

module.exports = router;
