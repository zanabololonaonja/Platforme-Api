const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Générer un token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'votre_secret_jwt', {
    expiresIn: '30d',
  });
};

// Inscription
exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, password, telephone, role } = req.body;

    console.log('📝 Tentative inscription:', { email, role });

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà.'
      });
    }

    // Créer l'utilisateur
    const user = await User.create({
      nom,
      prenom,
      email,
      password,
      telephone,
      role
    });

    console.log('✅ Inscription réussie:', { id: user.id, email: user.email });

    res.status(201).json({
      success: true,
      message: role === 'personnel' 
        ? 'Compte créé avec succès. En attente de validation par l\'administrateur.' 
        : 'Compte créé avec succès.',
      user
    });

  } catch (error) {
    console.error('❌ Erreur inscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'inscription.'
    });
  }
};

// Connexion - CORRECTION
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Tentative connexion:', email);

    // Trouver l'utilisateur
    const user = await User.findByEmail(email);
    if (!user) {
      console.log('❌ Utilisateur non trouvé:', email);
      return res.status(400).json({
        success: false,
        message: 'Email ou mot de passe incorrect.'
      });
    }

    console.log('👤 Utilisateur trouvé:', { 
      id: user.id, 
      email: user.email,
      hasPassword: !!user.password,  // ← CHANGEMENT: password au lieu de mot_de_passe
      photo_profil: user.photo_profil 
    });

    // ✅ CORRECTION: Utiliser directement 'password' puisque c'est le nom de colonne
    if (!user.password) {
      console.log('❌ Aucun mot de passe trouvé pour l\'utilisateur');
      return res.status(400).json({
        success: false,
        message: 'Email ou mot de passe incorrect.'
      });
    }

    // Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, user.password);  // ← CHANGEMENT: user.password
    if (!isMatch) {
      console.log('❌ Mot de passe incorrect pour:', email);
      return res.status(400).json({
        success: false,
        message: 'Email ou mot de passe incorrect.'
      });
    }

    // Vérifier le statut pour le personnel
    if (user.role === 'personnel' && user.statut !== 'actif') {
      console.log('❌ Compte personnel non activé:', email);
      return res.status(400).json({
        success: false,
        message: 'Votre compte personnel est en attente de validation par l\'administrateur.'
      });
    }

    // Générer le token
    const token = generateToken(user.id);

    // ✅ CORRECTION: Inclure photo_profil dans la réponse
    const userResponse = {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      role: user.role,
      statut: user.statut,
      photo_profil: user.photo_profil || null
    };

    console.log('✅ Login réussi - Données envoyées:', {
      id: userResponse.id,
      nom: userResponse.nom,
      prenom: userResponse.prenom,
      photo_profil: userResponse.photo_profil,
      hasPhoto: !!userResponse.photo_profil
    });

    res.json({
      success: true,
      message: 'Connexion réussie.',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('❌ Erreur connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion.'
    });
  }
};

// Récupérer le profil utilisateur
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // ✅ CORRECTION: Retourner toutes les données
    const userResponse = {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      role: user.role,
      statut: user.statut,
      photo_profil: user.photo_profil || null
    };

    console.log('📋 Profil récupéré:', {
      id: userResponse.id,
      photo_profil: userResponse.photo_profil
    });

    res.json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error('❌ Erreur profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur.'
    });
  }
};