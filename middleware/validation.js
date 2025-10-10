const validateRegister = (req, res, next) => {
  const { nom, prenom, email, password, telephone, role } = req.body;

  if (!nom || !prenom || !email || !password || !telephone || !role) {
    return res.status(400).json({
      success: false,
      message: 'Tous les champs sont obligatoires.'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Le mot de passe doit contenir au moins 6 caractères.'
    });
  }

  if (!['personnel', 'donateur'].includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Rôle invalide.'
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email et mot de passe sont obligatoires.'
    });
  }

  next();
};

module.exports = { validateRegister, validateLogin };