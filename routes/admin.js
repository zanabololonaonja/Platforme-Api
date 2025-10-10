const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

// Récupérer les utilisateurs en attente
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

// Valider un utilisateur (statut → actif)
router.put('/users/:id/validate', auth, requireRole(['admin']), async (req, res) => {
  try {
    const user = await User.updateStatus(req.params.id, 'actif');
    res.json({
      success: true,
      message: 'Utilisateur validé avec succès',
      user
    });
  } catch (error) {
    console.error('❌ Erreur validation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation: ' + error.message
    });
  }
});

// Refuser un utilisateur (statut → inactif)
router.put('/users/:id/reject', auth, requireRole(['admin']), async (req, res) => {
  try {
    const user = await User.updateStatus(req.params.id, 'inactif');
    res.json({
      success: true,
      message: 'Utilisateur refusé',
      user
    });
  } catch (error) {
    console.error('❌ Erreur refus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du refus: ' + error.message
    });
  }
});

// NOUVELLE ROUTE : Changer le statut d'un utilisateur (actif/inactif)
router.put('/users/:id/status', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;
    
    console.log(`🔄 Changement de statut pour l'utilisateur ${id} → ${statut}`);
    
    // Valider le statut
    const statutsValides = ['actif', 'inactif', 'en_attente'];
    if (!statutsValides.includes(statut)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide. Valeurs autorisées: actif, inactif, en_attente'
      });
    }
    
    const user = await User.updateStatus(id, statut);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: `Statut de l'utilisateur mis à jour: ${statut}`,
      user
    });
  } catch (error) {
    console.error('❌ Erreur changement statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de statut: ' + error.message
    });
  }
});

// GET - Tous les utilisateurs
router.get('/users', auth, requireRole(['admin']), async (req, res) => {
  try {
    console.log('🔍 Récupération de tous les utilisateurs...');
    
    const users = await User.findAll();
    
    console.log('📋 Utilisateurs trouvés:', users.length);
    
    res.json({
      success: true,
      users: users,
      count: users.length
    });
  } catch (error) {
    console.error('❌ Erreur /users:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur: ' + error.message
    });
  }
});

// GET - Récupérer un utilisateur spécifique
router.get('/users/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Récupération de l'utilisateur ID: ${id}`);
    
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
    console.error('❌ Erreur /users/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur: ' + error.message
    });
  }
});

// PUT - Mettre à jour complètement un utilisateur
router.put('/users/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, email, telephone, role, statut } = req.body;
    
    console.log(`✏️ Mise à jour complète de l'utilisateur ID: ${id}`, req.body);
    
    const updatedUser = await User.update(id, {
      nom,
      prenom,
      email,
      telephone,
      role,
      statut
    });
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Utilisateur mis à jour avec succès',
      user: updatedUser
    });
  } catch (error) {
    console.error('❌ Erreur PUT /users/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour: ' + error.message
    });
  }
});

// GET - Statistiques des utilisateurs
router.get('/users-stats', auth, requireRole(['admin']), async (req, res) => {
  try {
    console.log('📊 Récupération des statistiques utilisateurs...');
    
    const stats = await User.getStats();
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('❌ Erreur /users-stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques: ' + error.message
    });
  }
});



module.exports = router;