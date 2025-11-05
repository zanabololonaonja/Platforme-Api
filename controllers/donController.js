import Don from "../models/Don.js";
import { sendDonReceipt } from "../mail.js";

export const createDon = async (req, res) => {
  try {
    const { id_campagne, montant, type_don, moyen_paiement, donateur } = req.body;

    const newDon = await Don.create({
      id_campagne,
      montant,
      type_don,
      moyen_paiement,
      donateur,
    });

    await sendDonReceipt({
      nom: donateur.nom,
      prenom: donateur.prenom,
      email: donateur.email,
      montant,
      type_don,
      moyen_paiement,
      date_don: newDon.date_don,
      adresse: donateur.adresse,
      code_postal: donateur.code_postal,
      ville: donateur.ville,
      pays: donateur.pays,
      telephone: donateur.telephone,
    });

    res.status(201).json({ success: true, message: "Don enregistré et reçu envoyé", don: newDon });
  } catch (error) {
    console.error("❌ Erreur lors du don:", error);
    res.status(500).json({ success: false, message: "Erreur lors du don: " + error.message });
  }
};

export const getAllDons = async (req, res) => {
  try {
    const dons = await Don.getAll();
    res.json({ success: true, dons });
  } catch (error) {
    console.error("❌ Erreur récupération dons:", error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};
