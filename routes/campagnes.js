const express = require('express');
const router = express.Router();
const Campagne = require('../models/Campagne');
const { auth, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configuration multer pour upload d'image unique
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/campagnes/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// POST - Créer une campagne
router.post('/', auth, requireRole(['admin', 'personnel']), upload.single('image'), async (req, res) => {
  try {
    const { titre, description, dateDebut, dateFin, budget } = req.body;
    const image = req.file ? req.file.filename : null;

    const campagne = await Campagne.create({
      titre,
      description,
      dateDebut,
      dateFin,
      budget,
      image,
      auteur_id: req.user.id
    });

    res.json({
      success: true,
      message: 'Campagne créée avec succès',
      campagne
    });
  } catch (error) {
    console.error('❌ Erreur création campagne:', error);
    res.status(500).json({ success: false, message: 'Erreur création campagne: ' + error.message });
  }
});

// GET - Toutes les campagnes
router.get('/', async (req, res) => {
  try {
    const campagnes = await Campagne.getAll();
    res.json({ success: true, campagnes, count: campagnes.length });
  } catch (error) {
    console.error('❌ Erreur récupération campagnes:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.delete('/:id', auth, requireRole(['admin', 'personnel']), async (req, res) => {
  try {
    const id = req.params.id;
    const campagne = await Campagne.findById(id);

    if (!campagne) {
      return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    }

    // Vérifie que le personnel ne supprime que ses propres campagnes
    if (req.user.role !== 'admin' && campagne.auteur_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    // Supprime l'image si elle existe
    if (campagne.image) {
      const imgPath = path.join(__dirname, '..', 'uploads', 'campagnes', campagne.image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await Campagne.deleteById(id);
    res.json({ success: true, message: 'Campagne supprimée avec succès' });
  } catch (error) {
    console.error('❌ Erreur suppression campagne:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
