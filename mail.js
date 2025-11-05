const nodemailer = require("nodemailer");

async function sendDonReceipt(email, don) {
  try {
    const donateur = typeof don.donateur === "string" ? JSON.parse(don.donateur) : don.donateur;

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
      subject: " Reçu fiscal - 🎉 Merci pour votre don !",
      html: `
        <h2>Reçu de don</h2>
        <p>Bonjour ${donateur.prenom} ${donateur.nom},</p>
        <p>Merci pour votre don à <b>Ndao Hifanosika</b>.</p>
        <ul>
          <li>Nom : ${donateur.nom}</li>
          <li>Prénom : ${donateur.prenom}</li>
          <li>Montant : ${don.montant} Ar</li>
          <li>Date : ${new Date(don.date_don).toLocaleString()}</li>
        </ul>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email envoyé à ${donateur.email}`);
  } catch (error) {
    console.error("❌ Erreur d'envoi d'email :", error);
  }
}

module.exports = { sendDonReceipt };
