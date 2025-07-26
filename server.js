require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 8000;

// Configuración de Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Crear directorios necesarios
const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Configuración de multer para subida de archivos (usando memoria para Cloudinary)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB máximo
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp4|avi|mov|wmv|flv|webm/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de video'));
        }
    }
});

// Base de datos en memoria para clips
let clips = [];
let stats = {
    total_clips: 0,
    total_views: 0,
    total_likes: 0
};

// Datos estáticos de la liga (se actualizan manualmente en el código)
let standings = [
    { position: 1, team: 'ACP 507', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { position: 2, team: 'BKS FC', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { position: 3, team: 'Coiner FC', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { position: 4, team: 'FC WEST SIDE', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { position: 5, team: 'Humacao FC', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { position: 6, team: 'Jumpers FC', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { position: 7, team: 'LOS PLEBES Tk', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { position: 8, team: 'Punta Coco FC', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { position: 9, team: 'Pura Vibra', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { position: 10, team: 'Rayos X FC', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { position: 11, team: 'Tiki Taka FC', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { position: 12, team: 'WEST SIDE PTY', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
];

let matches = [];

let settings = {
    seasonName: 'Temporada 2025',
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0
};

// Equipos de la Liga Panameña de Clubes Pro
const teams = [
    { id: 1, name: 'ACP 507', founded: 2020, stadium: 'Estadio ACP' },
    { id: 2, name: 'BKS FC', founded: 2023, stadium: 'BKS Stadium' },
    { id: 3, name: 'Coiner FC', founded: 2019, stadium: 'Campo Coiner' },
    { id: 4, name: 'FC WEST SIDE', founded: 2021, stadium: 'West Side Arena' },
    { id: 5, name: 'Humacao FC', founded: 2020, stadium: 'Estadio Humacao' },
    { id: 6, name: 'Jumpers FC', founded: 2022, stadium: 'Jumpers Arena' },
    { id: 7, name: 'LOS PLEBES Tk', founded: 2021, stadium: 'Estadio Los Plebes' },
    { id: 8, name: 'Punta Coco FC', founded: 2018, stadium: 'Punta Coco Field' },
    { id: 9, name: 'Pura Vibra', founded: 2022, stadium: 'Vibra Stadium' },
    { id: 10, name: 'Rayos X FC', founded: 2020, stadium: 'Rayos Stadium' },
    { id: 11, name: 'Tiki Taka FC', founded: 2021, stadium: 'Tiki Taka Field' },
    { id: 12, name: 'WEST SIDE PTY', founded: 2023, stadium: 'West Side Stadium' }
];

// Cargar datos existentes solo para clips
const clipsFile = path.join(dataDir, 'clips.json');
const statsFile = path.join(dataDir, 'stats.json');

if (fs.existsSync(clipsFile)) {
    try {
        clips = JSON.parse(fs.readFileSync(clipsFile, 'utf8'));
    } catch (error) {
        console.log('Error cargando clips, iniciando con array vacío');
        clips = [];
    }
}

if (fs.existsSync(statsFile)) {
    try {
        stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
    } catch (error) {
        console.log('Error cargando estadísticas, iniciando con valores por defecto');
        stats = { total_clips: 0, total_views: 0, total_likes: 0 };
    }
}

// Función para guardar datos solo de clips
function saveData() {
    try {
        fs.writeFileSync(clipsFile, JSON.stringify(clips, null, 2));
        fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    } catch (error) {
        console.error('Error guardando datos:', error);
    }
}

// Funciones para actualizar datos manualmente y emitir en tiempo real
function updateStandings(newStandings) {
    standings = newStandings;
    io.emit('standings_updated', standings);
    console.log('Tabla de posiciones actualizada y emitida en tiempo real');
}

function updateMatches(newMatches) {
    matches = newMatches;
    io.emit('matches_updated', matches);
    console.log('Partidos actualizados y emitidos en tiempo real');
}

function addMatch(matchData) {
    const newMatch = {
        id: Date.now().toString(),
        ...matchData,
        createdAt: new Date().toISOString()
    };
    matches.push(newMatch);
    io.emit('match_added', newMatch);
    io.emit('matches_updated', matches);
    console.log('Nuevo partido agregado:', newMatch.homeTeam, 'vs', newMatch.awayTeam);
    return newMatch;
}

function updateMatch(matchId, updateData) {
    const matchIndex = matches.findIndex(m => m.id === matchId);
    if (matchIndex !== -1) {
        matches[matchIndex] = { ...matches[matchIndex], ...updateData };
        io.emit('match_updated', matches[matchIndex]);
        io.emit('matches_updated', matches);
        console.log('Partido actualizado:', matches[matchIndex].homeTeam, 'vs', matches[matchIndex].awayTeam);
        return matches[matchIndex];
    }
    return null;
}

// Exponer funciones globalmente para uso manual
global.updateStandings = updateStandings;
global.updateMatches = updateMatches;
global.addMatch = addMatch;
global.updateMatch = updateMatch;

// Rutas de la API

// Obtener clips con paginación y filtros
app.get('/api/clips', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const category = req.query.category || 'all';
    
    let filteredClips = clips;
    
    // Filtrar por categoría
    if (category !== 'all') {
        filteredClips = clips.filter(clip => clip.type === category);
    }
    
    // Ordenar por fecha (más recientes primero)
    filteredClips.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
    
    // Paginación
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedClips = filteredClips.slice(startIndex, endIndex);
    
    res.json({
        clips: paginatedClips,
        has_more: endIndex < filteredClips.length,
        total: filteredClips.length
    });
});

// Subir nuevo clip
app.post('/api/upload', upload.single('clipFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No se subió ningún archivo' });
        }

        const { clipTitle, clipDescription, clipType, clubSelect } = req.body;

        if (!clipTitle || !clipDescription || !clipType || !clubSelect) {
            return res.status(400).json({ 
                success: false, 
                error: 'Todos los campos son obligatorios' 
            });
        }

        // Subir video a Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const publicId = `lpcp-clips/clip-${uniqueSuffix}`;
            
            cloudinary.uploader.upload_stream(
                {
                    resource_type: 'video',
                    public_id: publicId,
                    folder: 'lpcp-clips',
                    quality: 'auto',
                    format: 'mp4'
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            ).end(req.file.buffer);
        });

        // Crear nuevo clip con URL de Cloudinary
        const newClip = {
            id: Date.now().toString(),
            title: clipTitle,
            description: clipDescription,
            type: clipType,
            club: clubSelect,
            filename: uploadResult.public_id, // Guardamos el public_id de Cloudinary
            video_url: uploadResult.secure_url, // URL segura del video
            upload_date: new Date().toISOString(),
            views: 0,
            likes: 0,
            liked_by: []
        };

        clips.push(newClip);
        
        // Actualizar estadísticas
        stats.total_clips += 1;
        stats.total_views += Math.floor(Math.random() * 5 + 1); // Vistas iniciales aleatorias
        
        // Guardar datos
        saveData();

        // Notificar a todos los clientes conectados
        io.emit('newClip', {
            clip: newClip,
            stats: stats
        });

        res.json({ 
            success: true, 
            clip: newClip,
            stats: stats
        });

    } catch (error) {
        console.error('Error subiendo clip:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor: ' + error.message
        });
    }
});

// Obtener un clip específico por ID
app.get('/api/clips/:id', (req, res) => {
    const clipId = req.params.id;
    const clip = clips.find(c => c.id === clipId);
    
    if (!clip) {
        return res.status(404).json({ success: false, error: 'Clip no encontrado' });
    }
    
    res.json(clip);
});

// Obtener estadísticas
app.get('/api/stats', (req, res) => {
    res.json(stats);
});

// Dar like a un clip
app.post('/api/clips/:id/like', (req, res) => {
    const clipId = req.params.id;
    const userId = req.body.userId || req.ip; // En producción usarías autenticación real
    
    const clip = clips.find(c => c.id === clipId);
    
    if (!clip) {
        return res.status(404).json({ success: false, error: 'Clip no encontrado' });
    }
    
    // Verificar si ya dio like
    const alreadyLiked = clip.liked_by.includes(userId);
    
    if (alreadyLiked) {
        // Quitar like
        clip.liked_by = clip.liked_by.filter(id => id !== userId);
        clip.likes -= 1;
        stats.total_likes -= 1;
    } else {
        // Agregar like
        clip.liked_by.push(userId);
        clip.likes += 1;
        stats.total_likes += 1;
    }
    
    saveData();
    
    // Notificar cambio en tiempo real
    io.emit('likeUpdate', {
        clipId: clipId,
        likes: clip.likes,
        stats: stats
    });
    
    res.json({ 
        success: true, 
        likes: clip.likes,
        liked: !alreadyLiked 
    });
});

// Incrementar vistas de un clip
app.post('/api/clips/:id/view', (req, res) => {
    const clipId = req.params.id;
    const clip = clips.find(c => c.id === clipId);
    
    if (!clip) {
        return res.status(404).json({ success: false, error: 'Clip no encontrado' });
    }
    
    clip.views += 1;
    stats.total_views += 1;
    
    saveData();
    
    // Notificar cambio en tiempo real
    io.emit('viewUpdate', {
        clipId: clipId,
        views: clip.views,
        stats: stats
    });
    
    res.json({ success: true, views: clip.views });
});

// ===== RUTAS API PARA PANEL DE ADMINISTRACIÓN =====

// Obtener clasificaciones
app.get('/api/standings', (req, res) => {
    res.json(standings);
});

// Actualizar clasificaciones
app.put('/api/standings', (req, res) => {
    try {
        standings = req.body;
        saveData();
        res.json({ success: true, message: 'Clasificaciones actualizadas' });
    } catch (error) {
        console.error('Error actualizando clasificaciones:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener clasificaciones/posiciones (solo lectura)
app.get('/api/standings', (req, res) => {
    res.json(standings);
});

// Obtener partidos (solo lectura)
app.get('/api/matches', (req, res) => {
    res.json(matches);
});

// Obtener configuración (solo lectura)
app.get('/api/settings', (req, res) => {
    res.json(settings);
});

// Obtener equipos
app.get('/api/teams', (req, res) => {
    res.json(teams);
});

// Servir archivos de video (redirigir a Cloudinary)
app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    
    // Buscar el clip por filename (public_id de Cloudinary)
    const clip = clips.find(c => c.filename === filename || c.filename.includes(filename));
    
    if (!clip || !clip.video_url) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    // Redirigir a la URL de Cloudinary
    res.redirect(clip.video_url);
});

// WebSocket para tiempo real
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    
    // Enviar estadísticas actuales al conectarse
    socket.emit('statsUpdate', stats);
    
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

// Rutas para servir las páginas HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/clips.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'clips.html'));
});

// Rutas para las secciones de la página principal (con anclas)
app.get('/liga', (req, res) => {
    res.redirect('/#liga');
});

app.get('/clubes', (req, res) => {
    res.redirect('/#clubes');
});

app.get('/temporada', (req, res) => {
    res.redirect('/#temporada');
});

app.get('/contacto', (req, res) => {
    res.redirect('/#contacto');
});

// Ruta para clips
app.get('/clips', (req, res) => {
    res.sendFile(path.join(__dirname, 'clips.html'));
});

// Iniciar servidor
server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📁 Archivos subidos en: ${uploadsDir}`);
    console.log(`💾 Datos guardados en: ${dataDir}`);
});

// Manejo de errores
process.on('uncaughtException', (error) => {
    console.error('Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesa rechazada no manejada:', reason);
});
