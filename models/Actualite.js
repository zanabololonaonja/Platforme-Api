const express = require('express');
const router = express.Router();
const Actualite = require('../models/Actualite');
const { auth, requireRole } = require('../middleware/auth');
const db = require('../config/database');

// POST - Créer une actualité (avec images multiples)
router.post('/', auth, requireRole(['admin', 'personnel']), async (req, res) => {
  try {
    console.log('🟡 Création d\'actualité avec images:', req.body);
    
    const { titre, contenu, images, statut } = req.body;
    
    // Convertir le tableau d'images en JSON pour la base de données
    const imagesJson = images && images.length > 0 ? JSON.stringify(images) : null;
    
    const actualite = await Actualite.create({
      titre,
      contenu,
      images: imagesJson,
      auteur_id: req.user.id,
      statut: statut || 'brouillon'
    });
    
    console.log('✅ Actualité créée avec images:', actualite);
    res.json({ 
      success: true, 
      actualite,
      message: 'Article créé avec ' + (images ? images.length : 0) + ' image(s)'
    });
    
  } catch (error) {
    console.error('❌ Erreur création actualité:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur création: ' + error.message 
    });
  }
});

// GET - Actualités publiées (PUBLIQUE)
router.get('/', async (req, res) => {
  try {
    console.log('📰 Récupération des actualités publiées...');
    
    const query = `
      SELECT id, titre, contenu, images, date_creation, date_modification 
      FROM actualites 
      WHERE statut = 'publie'
      ORDER BY date_creation DESC
    `;
    
    const result = await db.query(query);
    
    // Convertir le JSON string en tableau d'images
    const actualites = result.rows.map(row => ({
      ...row,
      images: row.images ? JSON.parse(row.images) : []
    }));
    
    console.log('📋 Actualités trouvées:', actualites.length);
    
    res.json({
      success: true,
      actualites: actualites,
      count: actualites.length
    });
  } catch (error) {
    console.error('❌ Erreur /actualites:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des actualités'
    });
  }
});

// GET - Toutes les actualités (ADMIN/PERSONNEL)
/// GET - Actualités publiées (PUBLIC)
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        a.id, 
        a.titre, 
        a.contenu, 
        a.images, 
        a.categorie,
        a.statut,
        a.date_creation,
        a.date_modification,
        a.auteur,  // Utilisez la colonne auteur qui existe
        u.nom as createur_nom,
        u.prenom as createur_prenom,
        u.photo_profil as createur_photo,
        u.role as createur_role
      FROM actualites a
      LEFT JOIN users u ON LOWER(TRIM(u.nom)) = LOWER(TRIM(a.auteur)) OR LOWER(TRIM(u.prenom)) = LOWER(TRIM(a.auteur))
      WHERE a.statut = 'publie'
      ORDER BY a.date_creation DESC
    `;
    
    const result = await db.query(query);
    
    const actualites = result.rows.map(row => {
      // Déterminer le nom complet de l'auteur
      let createur_nom_complet;
      
      if (row.createur_prenom && row.createur_nom) {
        createur_nom_complet = `${row.createur_prenom} ${row.createur_nom}`;
      } else if (row.createur_nom) {
        createur_nom_complet = row.createur_nom;
      } else if (row.auteur) {
        createur_nom_complet = row.auteur;
      } else {
        createur_nom_complet = 'Administrateur';
      }

      // Déterminer le rôle
      let createur_role;
      if (row.createur_role === 'admin') {
        createur_role = 'Administrateur';
      } else if (row.createur_role === 'personnel') {
        createur_role = 'Personnel';
      } else if (row.auteur && row.auteur.toLowerCase().includes('admin')) {
        createur_role = 'Administrateur';
      } else {
        createur_role = 'Administrateur'; // Par défaut
      }

      return {
        ...row,
        images: row.images ? JSON.parse(row.images) : [],
        createur_nom_complet: createur_nom_complet,
        createur_role: createur_role
      };
    });
    
    res.json({
      success: true,
      actualites: actualites,
      count: actualites.length
    });
  } catch (error) {
    console.error('❌ Erreur /actualites:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// DELETE - Supprimer une actualité
router.delete('/:id', auth, requireRole(['admin', 'personnel']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`🗑️ Tentative de suppression article ${id} par utilisateur ${userId}`);

    // Vérifier si l'actualité existe
    const checkQuery = `
      SELECT a.*, u.role as auteur_role 
      FROM actualites a 
      LEFT JOIN users u ON a.auteur_id = u.id 
      WHERE a.id = $1
    `;
    const checkResult = await db.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Article non trouvé'
      });
    }

    const actualite = checkResult.rows[0];

    // Vérifier les permissions
    // Admin peut supprimer n'importe quel article
    // Personnel ne peut supprimer que ses propres articles
    if (userRole !== 'admin' && actualite.auteur_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à supprimer cet article'
      });
    }

    // Supprimer les images associées si elles existent
    if (actualite.images) {
      try {
        const images = JSON.parse(actualite.images);
        for (const image of images) {
          if (image.path) {
            const fullPath = path.join(__dirname, '..', 'uploads', 'articles', path.basename(image.path));
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
              console.log(`🗑️ Image supprimée: ${image.path}`);
            }
          }
        }
      } catch (imageError) {
        console.error('❌ Erreur suppression images:', imageError);
        // Continuer même si la suppression des images échoue
      }
    }

    // Supprimer l'actualité de la base de données
    const deleteQuery = 'DELETE FROM actualites WHERE id = $1 RETURNING *';
    const deleteResult = await db.query(deleteQuery, [id]);

    console.log(`✅ Article ${id} supprimé avec succès`);
    
    res.json({
      success: true,
      message: 'Article supprimé avec succès',
      actualite: deleteResult.rows[0]
    });

  } catch (error) {
    console.error('❌ Erreur suppression actualité:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression: ' + error.message
    });
  }
});
module.exports = router;