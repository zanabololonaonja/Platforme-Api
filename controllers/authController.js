const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Générer un token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'votre_secret_jwt', {
    expiresIn: '30d',
  });
};

// INSCRIPTION
exports.register = async (req, res) => {
  try {
    const { 
      nom, 
      prenom, 
      email, 
      password, 
      telephone, 
      role, 
      donateurType, 
      nomEntreprise, 
      poste 
    } = req.body;

    console.log('📝 Tentative inscription:', { email, role, donateurType });

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
      role,
      donateurType,
      nomEntreprise,
      poste
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

// CONNEXION
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

    console.log('👤 Utilisateur trouvé:', { id: user.id, email: user.email });

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Email ou mot de passe incorrect.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
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

    const token = generateToken(user.id);

    const userResponse = {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      role: user.role,
      statut: user.statut,
      photo_profil: user.photo_profil || null,
      donateurType: user.donateurType || null,
      nomEntreprise: user.nomEntreprise || null,
      poste: user.poste || null
    };

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

// PROFIL UTILISATEUR
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const userResponse = {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      role: user.role,
      statut: user.statut,
      photo_profil: user.photo_profil || null,
      donateurType: user.donateurType || null,
      nomEntreprise: user.nomEntreprise || null,
      poste: user.poste || null
    };

    console.log('📋 Profil récupéré:', userResponse);

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
