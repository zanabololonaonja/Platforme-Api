const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ✅ CORRECTION: Création garantie du dossier
const ensureUploadDir = () => {
  const uploadDir = path.join(__dirname, '../uploads/profils');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('✅ Dossier créé:', uploadDir);
  }
  return uploadDir;
};

const uploadDir = ensureUploadDir();

// Configuration de multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'profil-' + uniqueSuffix + path.extname(file.originalname);
    console.log('📸 Nouveau fichier:', filename);
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'));
    }
  }
});

// POST - Uploader une photo de profil
router.post('/profile-photo/:userId', auth, upload.single('photo'), async (req, res) => {
  try {
    console.log('🔼 Upload photo reçu pour user:', req.params.userId);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier uploadé'
      });
    }

    const { userId } = req.params;
    
    // Vérifier les permissions
    if (parseInt(userId) !== req.user.id && req.user.role !== 'admin') {
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que votre propre profil'
      });
    }

    // Chemin relatif pour la base de données
    const imageUrl = `/uploads/profils/${req.file.filename}`;
    
    console.log('📊 Informations upload:', {
      '🖼️ URL image': imageUrl,
      '📁 Chemin physique': req.file.path,
      '📂 Dossier upload': uploadDir,
      '👤 User ID': userId,
      'Fichier existe': fs.existsSync(req.file.path)
    });

    // Vérifier que le fichier a bien été créé
    if (!fs.existsSync(req.file.path)) {
      throw new Error('Le fichier n\'a pas été créé sur le serveur');
    }

    // Récupérer l'utilisateur actuel pour supprimer l'ancienne photo
    const currentUser = await User.findById(userId);
    if (currentUser && currentUser.photo_profil) {
      const oldPhotoPath = path.join(__dirname, '..', currentUser.photo_profil);
      console.log('🗑️ Tentative suppression ancienne photo:', oldPhotoPath);
      
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
        console.log('✅ Ancienne photo supprimée:', oldPhotoPath);
      }
    }

    const updatedUser = await User.updatePhotoProfil(userId, imageUrl);

    if (!updatedUser) {
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // ✅ Vérification finale que le fichier est accessible
    const fullUrl = `http://localhost:${process.env.PORT || 5000}${imageUrl}`;
    console.log('🔗 URL complète de l\'image:', fullUrl);

    res.json({
      success: true,
      message: 'Photo uploadée avec succès',
      user: updatedUser,
      imageUrl: imageUrl,
      fullUrl: fullUrl // Pour debug
    });
    
  } catch (error) {
    console.error('❌ Erreur uploadPhoto:', error);
    
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('🗑️ Fichier temporaire supprimé après erreur');
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload de la photo: ' + error.message
    });
  }
});

// ==== AJOUTEZ CE CODE DANS VOTRE FICHIER upload.js ====

// Configuration pour les images d'ARTICLES
const ensureArticlesUploadDir = () => {
  const articlesUploadDir = path.join(__dirname, '../uploads/articles');
  if (!fs.existsSync(articlesUploadDir)) {
    fs.mkdirSync(articlesUploadDir, { recursive: true });
    console.log('✅ Dossier articles créé:', articlesUploadDir);
  }
  return articlesUploadDir;
};

const articlesUploadDir = ensureArticlesUploadDir();

const articleStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, articlesUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = 'article-' + uniqueSuffix + path.extname(file.originalname);
    console.log('📸 Nouvelle image article:', filename);
    cb(null, filename);
  }
});

const uploadArticleImages = multer({
  storage: articleStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'));
    }
  }
});

// ✅ ROUTE POUR UPLOADER LES IMAGES D'ARTICLES
router.post('/article-images', auth, uploadArticleImages.array('images', 10), async (req, res) => {
  try {
    console.log('🔼 Upload images article reçu - Fichiers:', req.files?.length);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune image uploadée'
      });
    }

    // Chemin relatif pour la base de données
    const imageUrls = req.files.map(file => ({
      url: `/uploads/articles/${file.filename}`,
      filename: file.filename,
      originalname: file.originalname,
      size: file.size
    }));

    console.log('📊 Informations upload articles:', {
      '🖼️ URLs images': imageUrls,
      '📁 Dossier upload': articlesUploadDir,
      '📁 Fichiers créés': req.files.map(f => f.path)
    });

    res.json({
      success: true,
      message: `${req.files.length} image(s) uploadée(s) avec succès`,
      images: imageUrls
    });
    
  } catch (error) {
    console.error('❌ Erreur upload images article:', error);
    
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log('🗑️ Fichier article supprimé après erreur:', file.path);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload des images: ' + error.message
    });
  }
});



// ============================
// 🔹 3. UPLOAD IMAGES CAMPAGNES
// ============================

const ensureCampagnesDir = () => {
  const campagnesDir = path.join(__dirname, '../uploads/campagnes');
  if (!fs.existsSync(campagnesDir)) {
    fs.mkdirSync(campagnesDir, { recursive: true });
    console.log('✅ Dossier campagnes créé:', campagnesDir);
  }
  return campagnesDir;
};
const campagnesDir = ensureCampagnesDir();

const campagneStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, campagnesDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'campagne-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const uploadCampagne = multer({ storage: campagneStorage });

// POST - Image de campagne
router.post('/campagne-image', auth, uploadCampagne.single('image'), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: 'Aucune image uploadée' });

    const imageUrl = `/uploads/campagnes/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Image de campagne uploadée avec succès',
      image: imageUrl
    });
  } catch (error) {
    console.error('❌ Erreur upload campagne:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});// ==== FIN DE L'AJOUT ====

module.exports = router;