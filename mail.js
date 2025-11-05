const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const db = require("./config/database"); // Assure-toi que le chemin est correct

// Lire le logo en base64
const logoPath = path.join(__dirname, "assets/logoremove.png");
const logoBase64 = fs.readFileSync(logoPath, { encoding: 'base64' });

async function sendDonReceipt(email, don) {
  try {
    const donateur = typeof don.donateur === "string" ? JSON.parse(don.donateur) : don.donateur;

    // 🔹 Récupérer le nom de la campagne si inexistant
    if (!don.nom_campagne && don.id_campagne) {
      const campagneResult = await db.query(
        "SELECT titre FROM campagnes WHERE id = $1",
        [don.id_campagne]
      );
      don.nom_campagne = campagneResult.rows[0]?.titre || 'Non spécifiée';
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"ONG Ndao Hifanosika" <${process.env.EMAIL_USER}>`,
      to: donateur.email,
      subject: "📄 Reçu de don - ONG Ndao Hifanosika",
      html: `
      <div style="font-family:Arial, sans-serif; border:1px solid #555; padding:20px; max-width:600px; margin:auto;">
        
        <!-- En-tête -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
          <div style="flex:1;">
            <img src="data:image/png;base64,${logoBase64}" alt="Logo ONG" style="height:50px; display:block;">
          </div>
          <div style="flex:2; text-align:center;">
            <h2 style="margin:0;">Reçu au titre des dons</h2>
            <p style="margin:0; font-size:14px; color:#555;">Association d’intérêt général</p>
          </div>
          <div style="flex:1; text-align:right;">
            <p style="font-size:14px; color:#555;"><strong>Reçu N°:</strong> ${don.numero || '0001'}</p>
          </div>
        </div>

        <hr style="margin:20px 0;">

        <h3 style="background:#f2f2f2; padding:8px;">Bénéficiaire du versement</h3>
        <p><strong>Nom de l'association :</strong> ONG Ndao Hifanosika</p>
        <p><strong>Adresse :</strong> Madagascar</p>
        <p><strong>Objet :</strong> Actions d’aide humanitaire et sociale</p>

        <hr style="margin:20px 0;">

        <h3 style="background:#f2f2f2; padding:8px;">Donateur</h3>
        <p><strong>${donateur.nom} ${donateur.prenom}</strong></p>
        <p><strong>Email :</strong> ${donateur.email}</p>

        <hr style="margin:20px 0;">

        <h3 style="background:#f2f2f2; padding:8px;">Détails du don</h3>
        <p><strong>Campagne soutenue :</strong> ${don.nom_campagne || 'Non spécifiée'}</p>
        <p><strong>Montant du don :</strong> ${don.montant} Ar</p>
        <p><strong>Date du don :</strong> ${new Date(don.date_don).toLocaleString()}</p>
        <p><strong>Mode de paiement :</strong> ${don.moyen_paiement || 'Mobile Money / Cash'}</p>

        <hr style="margin:20px 0;">

        <p style="font-size:13px; color:#555;">
          Ce reçu est à conserver. Il peut être utilisé comme justificatif dans le cadre de déclaration fiscale,
          conformément aux dispositions applicables aux dons aux organismes reconnus d’intérêt général.
        </p>

        <p style="margin-top:25px;">✅ Merci pour votre soutien à l’ONG Ndao Hifanosika 💛</p>
        <p>Pour suivre nos actions : <a href="https://ndaohifanosikaong.vercel.app/" target="_blank">Visiter le site</a></p>
      </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email envoyé à ${donateur.email}`);
  } catch (error) {
    console.error("❌ Erreur d'envoi d'email :", error);
  }
}

module.exports = { sendDonReceipt };
