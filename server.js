const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const campagnesRoutes = require('./routes/campagnes');
const paiementMvola = require("./routes/paiement-mvola");

// Configuration CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ CORRECTION CRITIQUE : Servir le dossier profils spécifiquement
console.log('📁 Configuration des fichiers statiques:');

// Servir le dossier uploads principal
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    console.log('📤 Servir fichier uploads:', filePath);
  }
}));

// ✅ NOUVELLE CONFIGURATION : Servir spécifiquement le dossier profils
app.use('/uploads/profils', express.static(path.join(__dirname, 'uploads', 'profils'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    console.log('📤 Servir fichier profils:', filePath);
  }
}));

// ✅ ROUTE FALLBACK pour les fichiers profils
app.get('/uploads/profils/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'uploads', 'profils', filename);
  
  console.log('🔍 Fallback route pour:', filename, '->', filePath);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ 
      success: false,
      message: 'Fichier non trouvé',
      filename,
      filePath 
    });
  }
});

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/actualites', require('./routes/actualites'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/campagnes', campagnesRoutes);
app.use("/api/dons", require("./routes/dons"));
app.use("/api/paiement-mvola", paiementMvola);
app.get("/", (req, res) => {
  res.send("✅ API ONG Ndao Hifanosika fonctionne !");
});
app.get('/favicon.ico', (req, res) => res.status(204));



const donsRouter = require("./routes/dons");
app.use(cors());
app.use("/api/dons", donsRouter);


// Route de diagnostic
app.get('/api/debug-uploads', (req, res) => {
  const profilsPath = path.join(__dirname, 'uploads', 'profils');
  
  try {
    const files = fs.readdirSync(profilsPath);
    
    // Tester l'accessibilité de chaque fichier
    const filesWithAccess = files.map(filename => {
      const filePath = path.join(profilsPath, filename);
      const url = `/uploads/profils/${filename}`;
      const fullUrl = `http://localhost:${process.env.PORT || 5000}${url}`;
      
      return {
        filename,
        path: filePath,
        url,
        fullUrl,
        exists: fs.existsSync(filePath),
        size: fs.statSync(filePath).size
      };
    });
    
    res.json({
      success: true,
      paths: {
        uploads: path.join(__dirname, 'uploads'),
        profils: profilsPath
      },
      files: filesWithAccess,
      fileCount: files.length,
      staticConfig: {
        staticPath: path.join(__dirname, 'uploads'),
        servedAt: '/uploads'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});



// Route de test
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API fonctionne avec PostgreSQL!',
    uploadsPath: path.join(__dirname, 'uploads')
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  console.log('❌ Route non trouvée:', req.method, req.url);
  res.status(404).json({ 
    message: 'Route non trouvée',
    method: req.method,
    url: req.url
  });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📁 Dossier uploads: ${path.join(__dirname, 'uploads')}`);
  console.log(`📁 Dossier profils: ${path.join(__dirname, 'uploads', 'profils')}`);
  console.log(`🌐 URL fichiers: http://localhost:${PORT}/uploads/`);
  console.log(`🌐 URL profils: http://localhost:${PORT}/uploads/profils/`);
  console.log(`🔍 Diagnostic: http://localhost:${PORT}/api/debug-uploads`);
});