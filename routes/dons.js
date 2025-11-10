const express = require("express");
const router = express.Router();
const db = require('../config/database');
const { sendDonReceipt } = require("../mail.js");
const fetch = global.fetch || require("node-fetch");

// 🔹 Configuration MVola
const MVOLA_TOKEN_URL = "https://devapi.mvola.mg/token";
const MVOLA_API = "https://devapi.mvola.mg/mvola/mm/transactions/type/merchantpay/1.0.0/";
const MVOLA_STATUS_API = "https://devapi.mvola.mg/mvola/mm/transactions/type/merchantpay/1.0.0/status/";
const MVOLA_CLIENT_ID = process.env.MVOLA_CLIENT_ID;
const MVOLA_CLIENT_SECRET = process.env.MVOLA_CLIENT_SECRET;
const MVOLA_MERCHANT_MSISDN = "0343500004";

// Fonction pour récupérer le token MVola
async function getAccessToken() {
  const res = await fetch(MVOLA_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${MVOLA_CLIENT_ID}:${MVOLA_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE",
  });
  const data = await res.json();
  return data.access_token;
}

// ⭐ NOUVELLE FONCTION : Vérifier le statut MVola
async function checkMvolaStatus(serverCorrelationId) {
  try {
    const token = await getAccessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Version": "1.0",
      "X-CorrelationID": "CHECK-" + Date.now(),
      "UserLanguage": "FR",
      "partnerName": "TestPartner",
      "UserAccountIdentifier": `msisdn;${MVOLA_MERCHANT_MSISDN}`,
      "Cache-Control": "no-cache"
    };

    const response = await fetch(MVOLA_STATUS_API + serverCorrelationId, {
      method: "GET",
      headers: headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("❌ Erreur vérification statut MVola:", error);
    throw error;
  }
}

// ⭐ NOUVELLE FONCTION : Mettre à jour le statut du don
async function updateDonStatus(donId, serverCorrelationId) {
  try {
    // Vérifier le statut actuel auprès de MVola
    const statusResult = await checkMvolaStatus(serverCorrelationId);
    console.log(`📊 Statut MVola pour don ${donId}:`, statusResult.status);

    if (statusResult.status === 'completed') {
      // Mettre à jour le don en "payé"
      await db.query(
        `UPDATE dons SET statut_paiement = 'payé', object_reference = $1 WHERE id = $2`,
        [statusResult.objectReference, donId]
      );
      
      // Récupérer le don mis à jour
      const donResult = await db.query('SELECT * FROM dons WHERE id = $1', [donId]);
      const don = donResult.rows[0];
      
      // Envoyer le reçu
      if (don.donateur) {
        const donateur = typeof don.donateur === 'string' ? JSON.parse(don.donateur) : don.donateur;
        if (donateur.email) {
          await sendDonReceipt(donateur.email, { ...don, statut_paiement: 'payé' });
          console.log("📧 Reçu envoyé à:", donateur.email);
        }
      }
      
      console.log("✅ Don mis à jour avec statut: payé");
      return { success: true, status: 'completed' };
      
    } else if (statusResult.status === 'failed') {
      await db.query(`UPDATE dons SET statut_paiement = 'échoué' WHERE id = $1`, [donId]);
      console.log("❌ Don mis à jour avec statut: échoué");
      return { success: false, status: 'failed' };
    } else {
      console.log("⏳ Don toujours en attente");
      return { success: true, status: 'pending' };
    }
  } catch (error) {
    console.error("❌ Erreur mise à jour statut don:", error);
    throw error;
  }
}

// 📌 Route pour ajouter un don
router.post("/", async (req, res) => {
  try {
    const { id_campagne, montant, type_don, moyen_paiement, donateur } = req.body;

    console.log("🔹 Don reçu:", req.body);

    // Vérification des champs
    if (!montant || !donateur) {
      return res.status(400).json({ 
        success: false, 
        message: "Montant et donateur sont requis" 
      });
    }

    // Pour MVola, vérifier qu'on a un téléphone
    if (moyen_paiement?.toLowerCase() === 'mvola' && !donateur.telephone) {
      return res.status(400).json({ 
        success: false, 
        message: "Numéro de téléphone requis pour MVola" 
      });
    }

    // 1. Enregistrer le don en BD
    const result = await db.query(
      `INSERT INTO dons (id_campagne, montant, type_don, moyen_paiement, donateur, date_don, statut_paiement)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       RETURNING *`,
      [
        id_campagne || null, 
        montant, 
        type_don || 'ponctuel', 
        moyen_paiement || 'autre',
        JSON.stringify(donateur), 
        moyen_paiement?.toLowerCase() === 'mvola' ? 'en_attente' : 'payé'
      ]
    );

    const don = result.rows[0];
    console.log("✅ Don enregistré en BD, ID:", don.id);

    // 2. Si c'est MVola, initier le paiement
    if (moyen_paiement?.toLowerCase() === 'mvola') {
      try {
        const token = await getAccessToken();
        const timestamp = Date.now();

        // Préparer la requête MVola
        const bodyMVola = {
          amount: String(montant),
          currency: "Ar",
          descriptionText: `Don ${id_campagne ? 'campagne ' + id_campagne : ''}`.trim(),
          requestingOrganisationTransactionReference: "DON_" + timestamp,
          requestDate: new Date().toISOString().split('.')[0] + ".000Z",
          originalTransactionReference: "ORIG_" + timestamp,
          debitParty: [{ key: "msisdn", value: donateur.telephone }],
          creditParty: [{ key: "msisdn", value: MVOLA_MERCHANT_MSISDN }],
          metadata: [
            { key: "partnerName", value: "TestPartner" },
            { key: "fc", value: "USD" },
            { key: "amountFc", value: "1" }
          ]
        };

        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Version": "1.0",
          "X-CorrelationID": "DON_" + timestamp,
          "UserLanguage": "FR",
          "partnerName": "TestPartner",
          "UserAccountIdentifier": `msisdn;${MVOLA_MERCHANT_MSISDN}`,
          "Cache-Control": "no-cache"
        };

        // Envoyer la requête à MVola
        const response = await fetch(MVOLA_API, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(bodyMVola),
        });

        const resultMVola = await response.json();
        
        if (resultMVola.serverCorrelationId) {
          // Mettre à jour le don avec l'ID de corrélation
          await db.query(
            `UPDATE dons SET server_correlation_id = $1 WHERE id = $2`,
            [resultMVola.serverCorrelationId, don.id]
          );

          console.log("✅ Paiement MVola initié:", resultMVola.serverCorrelationId);

          // ⭐ DÉMARRER LA VÉRIFICATION AUTOMATIQUE DU STATUT
          startStatusPolling(don.id, resultMVola.serverCorrelationId);

          res.json({
            success: true,
            message: "Don enregistré. Vérification du paiement en cours...",
            don: don,
            serverCorrelationId: resultMVola.serverCorrelationId,
            statut: 'en_attente'
          });

        } else {
          throw new Error("Erreur MVola: " + (resultMVola.errorDescription || "Inconnue"));
        }

      } catch (error) {
        console.error("❌ Erreur MVola:", error);
        // En cas d'erreur MVola, marquer le don comme échoué
        await db.query(`UPDATE dons SET statut_paiement = 'échoué' WHERE id = $1`, [don.id]);
        
        res.status(500).json({
          success: false,
          message: "Erreur lors de l'initiation du paiement MVola",
          error: error.message
        });
      }

    } else {
      // Pour les autres moyens de paiement, marquer directement comme payé
      await db.query(`UPDATE dons SET statut_paiement = 'payé' WHERE id = $1`, [don.id]);
      
      // Envoyer le reçu
      if (donateur.email) {
        await sendDonReceipt(donateur.email, { ...don, statut_paiement: 'payé' });
      }

      res.json({
        success: true,
        message: "Don enregistré avec succès !",
        don: { ...don, statut_paiement: 'payé' },
        statut: 'payé'
      });
    }

  } catch (err) {
    console.error("❌ Erreur générale:", err);
    res.status(500).json({ 
      success: false, 
      message: "Erreur serveur: " + err.message 
    });
  }
});

// ⭐ NOUVELLE FONCTION : Polling automatique du statut
function startStatusPolling(donId, serverCorrelationId) {
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes (10s * 30)
  
  const checkStatus = async () => {
    try {
      attempts++;
      console.log(`🔄 Vérification statut MVola (tentative ${attempts}/${maxAttempts}) pour don:`, donId);
      
      const result = await updateDonStatus(donId, serverCorrelationId);
      
      if (result.status === 'completed') {
        console.log("🎉 Transaction MVola confirmée pour don:", donId);
        return; // Arrêter le polling
      } else if (result.status === 'failed') {
        console.log("❌ Transaction MVola échouée pour don:", donId);
        return; // Arrêter le polling
      } else if (attempts < maxAttempts) {
        // Continuer le polling
        setTimeout(checkStatus, 10000); // Vérifier toutes les 10 secondes
      } else {
        console.log("⏰ Timeout - Arrêt du polling pour don:", donId);
        await db.query(`UPDATE dons SET statut_paiement = 'timeout' WHERE id = $1`, [donId]);
      }
    } catch (error) {
      console.error("❌ Erreur lors du polling pour don:", donId, error);
      if (attempts < maxAttempts) {
        setTimeout(checkStatus, 10000);
      }
    }
  };
  
  // Démarrer la première vérification après 5 secondes
  setTimeout(checkStatus, 5000);
}

// 📌 Route pour vérifier manuellement le statut d'un don MVola
router.get("/status/:donId", async (req, res) => {
  try {
    const { donId } = req.params;
    
    const donResult = await db.query('SELECT * FROM dons WHERE id = $1', [donId]);
    const don = donResult.rows[0];
    
    if (!don) {
      return res.status(404).json({ success: false, message: "Don non trouvé" });
    }

    if (!don.server_correlation_id) {
      return res.json({ 
        success: true, 
        message: "Aucune transaction MVola associée",
        statut_don: don.statut_paiement 
      });
    }

    // Vérifier le statut actuel
    const result = await updateDonStatus(donId, don.server_correlation_id);
    
    res.json({
      success: true,
      statut_don: result.status === 'completed' ? 'payé' : 
                 result.status === 'failed' ? 'échoué' : don.statut_paiement,
      message: result.status === 'completed' ? 'Paiement confirmé' : 
              result.status === 'failed' ? 'Paiement échoué' : 'En attente'
    });

  } catch (error) {
    console.error("❌ Erreur vérification statut:", error);
    res.status(500).json({ 
      success: false, 
      message: "Erreur vérification statut" 
    });
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
