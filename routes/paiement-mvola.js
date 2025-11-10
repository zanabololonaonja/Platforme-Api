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
  console.log("🔄 Récupération du token MVola...");
  try {
    const res = await fetch(MVOLA_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${MVOLA_CLIENT_ID}:${MVOLA_CLIENT_SECRET}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE",
    });

    if (!res.ok) {
      throw new Error(`Erreur token: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log("✅ Token MVola reçu avec succès");
    return data.access_token;
  } catch (error) {
    console.error("❌ Erreur récupération token MVola:", error);
    throw error;
  }
}

// Fonction pour vérifier le statut avec polling
async function checkTransactionStatus(serverCorrelationId, donId, maxAttempts = 30) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const token = await getAccessToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Version": "1.0",
        "X-CorrelationID": "POLL-" + Date.now(),
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

      const result = await response.json();
      console.log(`📊 Statut MVola (tentative ${attempts + 1}):`, result.status);

      // Si la transaction est complétée
      if (result.status === 'completed') {
        console.log("✅ Transaction MVola approuvée et complétée!");
        
        // Mettre à jour le statut du don en "payé" dans la base de données
        await db.query(
          `UPDATE dons SET statut_paiement = 'payé', server_correlation_id = $1, object_reference = $2 WHERE id = $3`,
          [serverCorrelationId, result.objectReference, donId]
        );
        
        // Récupérer le don mis à jour pour envoyer le reçu
        const donResult = await db.query('SELECT * FROM dons WHERE id = $1', [donId]);
        const don = donResult.rows[0];
        
        // Envoyer le reçu
        if (don.donateur && JSON.parse(don.donateur).email) {
          const donateur = JSON.parse(don.donateur);
          await sendDonReceipt(donateur.email, don);
          console.log("📧 Reçu envoyé à :", donateur.email);
        }
        
        return {
          success: true,
          status: 'completed',
          objectReference: result.objectReference,
          data: result
        };
      }
      
      // Si la transaction échoue
      if (result.status === 'failed') {
        console.log("❌ Transaction MVola échouée");
        
        // Mettre à jour le statut du don en "échoué"
        await db.query(
          `UPDATE dons SET statut_paiement = 'échoué' WHERE id = $1`,
          [donId]
        );
        
        return {
          success: false,
          status: 'failed',
          data: result
        };
      }

      // Si toujours pending, attendre 10 secondes
      attempts++;
      if (attempts < maxAttempts) {
        console.log(`⏳ En attente d'approbation MVola... (${attempts}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

    } catch (error) {
      console.error("❌ Erreur vérification statut MVola:", error);
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  // Timeout
  await db.query(
    `UPDATE dons SET statut_paiement = 'timeout' WHERE id = $1`,
    [donId]
  );
  
  return {
    success: false,
    status: 'timeout',
    message: 'Timeout - transaction non approuvée dans le délai imparti'
  };
}

// 📌 Ajouter un don avec paiement MVola
router.post("/", async (req, res) => {
  let donId; // Déclarer donId à un niveau supérieur pour y avoir accès dans le setTimeout

  try {
    const { id_campagne, montant, type_don, moyen_paiement, donateur } = req.body;

    console.log("🔹 Nouveau don reçu :", { id_campagne, montant, type_don, moyen_paiement, donateur });

    if (!id_campagne || !montant || !type_don || !moyen_paiement || !donateur) {
      console.warn("⚠️ Champs manquants dans le don");
      return res.status(400).json({ success: false, message: "Champs manquants." });
    }

    // Vérifier si c'est un paiement MVola
    const isMvolaPayment = moyen_paiement.toLowerCase() === 'mvola';
    
    // Insérer le don dans la table avec le statut initial
    const statutInitial = isMvolaPayment ? 'en_attente' : 'payé';
    
    const result = await db.query(
      `INSERT INTO dons (id_campagne, montant, type_don, moyen_paiement, donateur, date_don, id_donateur, statut_paiement)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
       RETURNING *`,
      [id_campagne, montant, type_don, moyen_paiement, JSON.stringify(donateur), donateur.id, statutInitial]
    );

    const don = result.rows[0];
    donId = don.id; // Assigner la valeur
    console.log("✅ Don enregistré avec statut:", statutInitial, don);

    // Si c'est un paiement MVola, initier la transaction
    if (isMvolaPayment) {
      console.log("🔄 Initialisation du paiement MVola...");
      
      // Répondre immédiatement au client
      res.status(200).json({
        success: true,
        message: "Don enregistré. Paiement MVola en attente d'approbation...",
        don: don,
        statut: 'en_attente',
        instructions: "Veuillez approuver la transaction dans MVola Developer → Transaction Approvals"
      });

      // ⭐ Démarrer le processus MVola en arrière-plan
      setTimeout(async () => {
        try {
          const token = await getAccessToken();
          
          // Génération de références uniques
          const timestamp = Date.now();
          const transactionRef = "DON_TX_" + timestamp;
          const originalRef = "DON_ORIG_" + timestamp;

          // Corps de la requête MVola
          const body = {
            amount: String(montant),
            currency: "Ar",
            descriptionText: `Don campagne ${id_campagne}`,
            requestingOrganisationTransactionReference: transactionRef,
            requestDate: new Date().toISOString().split('.')[0] + ".000Z",
            originalTransactionReference: originalRef,
            debitParty: [
              { 
                key: "msisdn", 
                value: donateur.telephone || "0343500003" // Utiliser le téléphone du donateur
              }
            ],
            creditParty: [
              { 
                key: "msisdn", 
                value: MVOLA_MERCHANT_MSISDN
              }
            ],
            metadata: [
              {
                key: "partnerName",
                value: "TestPartner"
              },
              {
                key: "fc", 
                value: "USD"
              },
              {
                key: "amountFc",
                value: "1"
              },
              {
                key: "campagne",
                value: String(id_campagne)
              },
              {
                key: "type",
                value: "don"
              }
            ]
          };

          console.log("📤 Requête MVola envoyée pour le don:", donId);

          // Headers MVola
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

          // Requête pour créer le paiement MVola
          const response = await fetch(MVOLA_API, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body),
          });

          const resultMVola = await response.json();
          console.log("📨 Réponse MVola pour le don:", donId, resultMVola);

          if (!response.ok || !resultMVola.serverCorrelationId) {
            throw new Error(resultMVola.errorDescription || "Erreur lors de l'initiation MVola");
          }

          // Mettre à jour le don avec le serverCorrelationId
          await db.query(
            `UPDATE dons SET server_correlation_id = $1 WHERE id = $2`,
            [resultMVola.serverCorrelationId, donId]
          );

          console.log("🔄 Démarrage du polling MVola pour le don:", donId);
          
          // Démarrer le polling pour vérifier le statut
          const statusResult = await checkTransactionStatus(resultMVola.serverCorrelationId, donId);
          
          if (statusResult.success && statusResult.status === 'completed') {
            console.log("🎉 Don finalisé avec succès! ID:", donId);
          } else {
            console.log("❌ Échec du don. ID:", donId, "Statut:", statusResult.status);
          }

        } catch (error) {
          console.error("❌ Erreur lors du processus MVola pour le don:", donId, error);
          
          // Mettre à jour le statut du don en "échoué"
          await db.query(
            `UPDATE dons SET statut_paiement = 'échoué' WHERE id = $1`,
            [donId]
          );
        }
      }, 1000); // Démarrer après 1 seconde

    } else {
      // Pour les autres moyens de paiement, envoyer le reçu immédiatement
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
        statut: 'payé'
      });
    }

  } catch (err) {
    console.error("❌ Erreur lors du don :", err);
    
    // Si une erreur se produit après l'insertion mais avant la réponse
    if (donId) {
      await db.query(
        `UPDATE dons SET statut_paiement = 'erreur' WHERE id = $1`,
        [donId]
      );
    }
    
    res.status(500).json({ success: false, message: "Erreur serveur: " + err.message });
  }
});

// 📌 Vérification manuelle du statut d'un don MVola
router.get("/status-mvola/:donId", async (req, res) => {
  try {
    const { donId } = req.params;
    
    // Récupérer le don
    const donResult = await db.query('SELECT * FROM dons WHERE id = $1', [donId]);
    const don = donResult.rows[0];
    
    if (!don) {
      return res.status(404).json({ success: false, message: "Don non trouvé" });
    }
    
    if (!don.server_correlation_id) {
      return res.json({ 
        success: false, 
        message: "Aucune transaction MVola associée à ce don",
        statut: don.statut_paiement 
      });
    }
    
    // Vérifier le statut MVola
    const statusResult = await checkTransactionStatus(don.server_correlation_id, donId, 5);
    res.json(statusResult);

  } catch (error) {
    console.error("❌ Erreur vérification statut MVola:", error);
    res.status(500).json({ 
      success: false, 
      message: "Erreur vérification statut MVola",
      error: error.message 
    });
  }
});

// 📌 Historique des dons par email (inchangé)
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
        d.statut_paiement,
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