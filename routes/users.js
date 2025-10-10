const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// PUT - Mettre à jour un utilisateur (propre profil ou admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userData = req.body;
    
    console.log(`✏️ Mise à jour de l'utilisateur ID: ${id}`, userData);
    
    // Vérifier que l'utilisateur modifie son propre profil ou est admin
    if (parseInt(id) !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que votre propre profil'
      });
    }

    // Si ce n'est pas un admin, on empêche de modifier le rôle et le statut
    if (req.user.role !== 'admin') {
      delete userData.role;
      delete userData.statut;
    }

    const updatedUser = await User.update(id, userData);
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      user: updatedUser
    });
  } catch (error) {
    console.error('❌ Erreur PUT /users/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil: ' + error.message
    });
  }
});

// DELETE - Supprimer la photo de profil
router.delete('/:id/photo', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Suppression photo pour l'utilisateur ${id}`);

    // Vérifier que l'utilisateur modifie son propre profil ou est admin
    if (parseInt(id) !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que votre propre profil'
      });
    }

    // Récupérer l'utilisateur actuel pour supprimer le fichier physique
    const currentUser = await User.findById(id);
    if (currentUser && currentUser.photo_profil) {
      const photoPath = path.join(__dirname, '..', currentUser.photo_profil);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
        console.log('🗑️ Fichier photo supprimé:', photoPath);
      }
    }

    const updatedUser = await User.updatePhotoProfil(id, null);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Photo de profil supprimée avec succès',
      user: updatedUser
    });
  } catch (error) {
    console.error('❌ Erreur suppression photo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la photo: ' + error.message
    });
  }
});

// routes/users.js - Route GET /profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Retourner toutes les données utilisateur nécessaires
    res.json({
      success: true,
      user: {
        id: user.id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        telephone: user.telephone,
        role: user.role,
        photo_profil: user.photo_profil, // Le chemin relatif
        statut: user.statut
        // Ajoutez d'autres champs si nécessaire
      }
    });
  } catch (error) {
    console.error('❌ Erreur récupération profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
});

// GET - Récupérer un utilisateur par ID (pour admin)
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('❌ Erreur récupération utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'utilisateur'
    });
  }
});

// Vos autres routes existantes...
router.get('/users/pending', auth, requireRole(['admin']), async (req, res) => {
  try {
    console.log('🔍 Route /users/pending appelée');
    const pendingUsers = await User.findPending();
    
    res.json({
      success: true,
      users: pendingUsers,
      count: pendingUsers.length
    });
    
  } catch (error) {
    console.error('❌ Erreur /users/pending:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur: ' + error.message
    });
  }
});

module.exports = router;