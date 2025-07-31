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
        methods: ["GET", "POST", "DELETE", "PUT"]
    }
});

const PORT = process.env.PORT || 3000;

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

// Configuración de multer para videos (clips)
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
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

// Configuración de multer para imágenes (logos de clubes)
const uploadImage = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen (JPEG, PNG, GIF, WebP)'));
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

// Tabla de posiciones dinámica (se genera automáticamente basada en equipos y partidos)
let standings = [];

// Partidos del torneo
let matches = [];

// Datos del torneo
let tournament = {
    teams: [],  // Se llenará con los equipos existentes
    matches: [],
    standings: [],
    settings: {
        seasonName: 'Temporada 2025',
        pointsWin: 3,
        pointsDraw: 1,
        pointsLoss: 0
    },
    currentBracket: null
};

// Configuración del torneo (mantenemos esto por compatibilidad)
let settings = {
    seasonName: 'Temporada 2025',
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0
};

// Variable para el bracket actual de playoffs (mantenida por compatibilidad)
let currentBracket = null;

// Equipos de la Liga Panameña de Clubes Pro
let teams = [
    { id: 1, name: 'ACP 507', founded: 2020, stadium: 'Estadio ACP', logo: 'img/default-team.png' },
    { id: 2, name: 'BKS FC', founded: 2023, stadium: 'BKS Stadium', logo: 'img/default-team.png' },
    { id: 3, name: 'Coiner FC', founded: 2019, stadium: 'Campo Coiner', logo: 'img/default-team.png' },
    { id: 4, name: 'FC WEST SIDE', founded: 2021, stadium: 'West Side Arena', logo: 'img/default-team.png' },
    { id: 5, name: 'Humacao FC', founded: 2020, stadium: 'Estadio Humacao', logo: 'img/default-team.png' },
    { id: 6, name: 'Jumpers FC', founded: 2022, stadium: 'Jumpers Arena', logo: 'img/default-team.png' },
    { id: 7, name: 'LOS PLEBES Tk', founded: 2021, stadium: 'Estadio Los Plebes', logo: 'img/default-team.png' },
    { id: 8, name: 'Punta Coco FC', founded: 2018, stadium: 'Punta Coco Field', logo: 'img/default-team.png' },
    { id: 9, name: 'Pura Vibra', founded: 2022, stadium: 'Vibra Stadium', logo: 'img/default-team.png' },
    { id: 10, name: 'Rayos X FC', founded: 2020, stadium: 'Rayos Stadium', logo: 'img/default-team.png' },
    { id: 11, name: 'Tiki Taka FC', founded: 2021, stadium: 'Tiki Taka Field', logo: 'img/default-team.png' },
    { id: 12, name: 'WEST SIDE PTY', founded: 2023, stadium: 'West Side Stadium', logo: 'img/default-team.png' }
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
        const statsData = fs.readFileSync(statsFile, 'utf8');
        stats = JSON.parse(statsData);
        console.log('Estadísticas cargadas:', stats);
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// Función para cargar datos (primero desde Cloudinary, luego local)
async function loadTournamentData() {
    // Intentar restaurar desde Cloudinary primero
    const restoredFromCloud = await restoreFromCloudinary();
    
    if (!restoredFromCloud) {
        // Si no se pudo restaurar desde Cloudinary, cargar datos locales
        const tournamentFile = path.join(dataDir, 'tournament.json');
        if (fs.existsSync(tournamentFile)) {
            try {
                const tournamentData = fs.readFileSync(tournamentFile, 'utf8');
                const data = JSON.parse(tournamentData);
                
                if (data.teams && data.teams.length > 0) {
                    teams = data.teams;
                    // Actualizar los equipos en el objeto tournament
                    tournament.teams = [...teams];
                    console.log('✅ Equipos cargados (local):', teams.length);
                }
                
                if (data.matches && data.matches.length > 0) {
                    matches = data.matches;
                    console.log('✅ Partidos cargados (local):', matches.length);
                }
                
                if (data.standings && data.standings.length > 0) {
                    standings = data.standings;
                    console.log('✅ Tabla de posiciones cargada (local):', standings.length);
                }
                
                if (data.settings) {
                    settings = { ...settings, ...data.settings };
                    console.log('✅ Configuración cargada (local)');
                }
                
                if (data.currentBracket) {
                    currentBracket = data.currentBracket;
                    console.log('✅ Bracket cargado (local)');
                }
                
                if (data.clubs && data.clubs.length > 0) {
                    clubs = data.clubs;
                    console.log('✅ Clubes cargados (local):', clubs.length);
                }
                
                if (data.players && data.players.length > 0) {
                    players = data.players;
                    console.log('✅ Jugadores cargados (local):', players.length);
                }
                
            } catch (error) {
                console.error('❌ Error cargando datos del torneo:', error);
                console.log('🔄 Usando datos por defecto');
            }
        } else {
            console.log('📝 Archivo de torneo no encontrado, usando datos por defecto');
        }
    }
}

// Cargar datos del torneo
loadTournamentData();

// Función para guardar datos localmente y hacer backup en Cloudinary
function saveData() {
    try {
        // Guardar clips y stats
        fs.writeFileSync(clipsFile, JSON.stringify(clips, null, 2));
        fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
        
        // Guardar datos del torneo
        const tournamentFile = path.join(dataDir, 'tournament.json');
        const tournamentData = {
            teams: teams,
            matches: matches,
            standings: standings,
            settings: settings,
            bracket: currentBracket,
            clubs: clubs, // Agregar clubes al backup
            players: players // Agregar jugadores al backup
        };
        
        fs.writeFileSync(tournamentFile, JSON.stringify(tournamentData, null, 2));
        
        // Backup asíncrono en Cloudinary (no bloquea la ejecución)
        backupToCloudinary(tournamentData).catch(error => {
            console.warn('⚠️ Error en backup de Cloudinary:', error.message);
        });
        
        console.log('✅ Datos guardados exitosamente');
    } catch (error) {
        console.error('❌ Error guardando datos:', error);
    }
}

// Función para hacer backup en Cloudinary
async function backupToCloudinary(data) {
    try {
        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
            const jsonString = JSON.stringify(data, null, 2);
            const buffer = Buffer.from(jsonString, 'utf8');
            
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    { 
                        resource_type: 'raw',
                        folder: 'lpcp/backups',
                        public_id: 'tournament_data',
                        format: 'json'
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                ).end(buffer);
            });
            
            console.log('☁️ Backup en Cloudinary exitoso:', result.public_id);
        }
    } catch (error) {
        console.warn('⚠️ Error en backup de Cloudinary (continuando normalmente):', error.message);
    }
}

// Función para restaurar datos desde Cloudinary
async function restoreFromCloudinary() {
    try {
        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
            const backupUrl = cloudinary.url('lpcp/backups/tournament_data.json', {
                resource_type: 'raw'
            });
            
            const response = await fetch(backupUrl);
            if (response.ok) {
                const data = await response.json();
                
                // Restaurar datos
                if (data.teams) teams = data.teams;
                if (data.matches) matches = data.matches;
                if (data.standings) standings = data.standings;
                if (data.settings) settings = data.settings;
                if (data.bracket) currentBracket = data.bracket;
                if (data.clubs) clubs = data.clubs;
                if (data.players) players = data.players;
                
                console.log('☁️ Datos restaurados desde Cloudinary exitosamente');
                return true;
            }
        }
    } catch (error) {
        console.warn('⚠️ No se pudo restaurar desde Cloudinary (usando datos locales):', error.message);
    }
    return false;
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

// Eliminar clip (solo para administradores)
app.delete('/api/clips/:id', async (req, res) => {
    try {
        const clipId = req.params.id;
        const clipIndex = clips.findIndex(c => c.id === clipId);
        
        if (clipIndex === -1) {
            return res.status(404).json({ success: false, error: 'Clip no encontrado' });
        }
        
        const clip = clips[clipIndex];
        console.log('🗑️ Eliminando clip:', clip.title, 'ID:', clipId);
        
        // Si el clip está en Cloudinary, intentar eliminarlo
        if (clip.filename) {
            try {
                await cloudinary.uploader.destroy(clip.filename, { resource_type: 'video' });
                console.log('✅ Clip eliminado de Cloudinary:', clip.filename);
            } catch (cloudinaryError) {
                console.warn('⚠️ Error eliminando de Cloudinary (continuando):', cloudinaryError.message);
            }
        }
        
        // Eliminar de la base de datos local
        clips.splice(clipIndex, 1);
        
        // Actualizar estadísticas
        stats.total_clips = clips.length;
        stats.total_views = clips.reduce((sum, c) => sum + (c.views || 0), 0);
        stats.total_likes = clips.reduce((sum, c) => sum + (c.likes || 0), 0);
        
        // Guardar cambios
        saveData();
        
        // Notificar cambio en tiempo real
        io.emit('clipDeleted', {
            clipId: clipId,
            stats: stats
        });
        
        console.log('✅ Clip eliminado exitosamente:', clipId);
        res.json({ 
            success: true, 
            message: 'Clip eliminado exitosamente',
            stats: stats
        });
        
    } catch (error) {
        console.error('Error eliminando clip:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor: ' + error.message
        });
    }
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

// Obtener partidos (solo lectura)
app.get('/api/matches', (req, res) => {
    res.json(matches);
});

// Obtener configuración (solo lectura)
app.get('/api/settings', (req, res) => {
    res.json(settings);
});

// Obtener tabla de posiciones
app.get('/api/standings', (req, res) => {
    try {
        console.log('📊 Solicitando tabla de posiciones...');
        console.log('🔍 Tournament.teams:', tournament.teams.length, 'equipos');
        
        // Asegurar que la tabla de posiciones esté actualizada
        updateStandingsFromMatches();
        
        console.log('📋 Standings generados:', standings.length, 'equipos');
        res.json(standings);
    } catch (error) {
        console.error('❌ Error al obtener tabla de posiciones:', error);
        res.status(500).json({ error: 'Error al obtener la tabla de posiciones' });
    }
});

// ==================== TOURNAMENT MANAGEMENT API ====================

// Obtener equipos
app.get('/api/teams', (req, res) => {
    res.json(teams);
});
// Endpoint eliminado - se usa el que soporta subida de archivos más abajo

// Eliminar equipo (solo admin)
app.delete('/api/teams/:id', (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const teamIndex = teams.findIndex(t => t.id === teamId);
        
        if (teamIndex === -1) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }
        
        const teamName = teams[teamIndex].name;
        
        teams.splice(teamIndex, 1);
        
        // También eliminar de la tabla de posiciones
        const tournamentTeamIndex = tournament.teams.findIndex(t => t.name === teamName);
        if (tournamentTeamIndex !== -1) {
            tournament.teams.splice(tournamentTeamIndex, 1);
        }
        
        // Recalcular tabla de posiciones
        updateStandingsFromMatches();
        saveData();
        
        // Emitir actualizaciones en tiempo real
        io.emit('teamsUpdate', teams);
        io.emit('standingsUpdate', standings);
        
        res.json({ success: true, message: 'Equipo eliminado' });
    } catch (error) {
        console.error('Error eliminando equipo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener partidos con filtros
app.get('/api/tournament/matches', (req, res) => {
    const { status, matchday } = req.query;
    let filteredMatches = matches;
    
    if (status) {
        filteredMatches = filteredMatches.filter(m => m.status === status);
    }
    
    if (matchday) {
        filteredMatches = filteredMatches.filter(m => m.matchday === parseInt(matchday));
    }
    
    res.json(filteredMatches);
});

// Agregar partido (solo admin)
app.post('/api/tournament/matches', (req, res) => {
    try {
        const { homeTeam, awayTeam, date, time, matchday } = req.body;
        
        console.log('⚽ Creando partido:', { homeTeam, awayTeam, date, time });
        
        if (!homeTeam || !awayTeam || !date || !time) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        
        if (homeTeam === awayTeam) {
            return res.status(400).json({ error: 'Un equipo no puede jugar contra sí mismo' });
        }
        
        // Buscar equipos por ID o nombre para obtener información completa
        let homeTeamData, awayTeamData;
        
        // Si homeTeam/awayTeam son números, buscar por ID
        if (!isNaN(homeTeam)) {
            homeTeamData = teams.find(t => t.id === parseInt(homeTeam)) || tournament.teams.find(t => t.id === parseInt(homeTeam));
        } else {
            // Si son strings, buscar por nombre
            homeTeamData = teams.find(t => t.name === homeTeam) || tournament.teams.find(t => t.name === homeTeam);
        }
        
        if (!isNaN(awayTeam)) {
            awayTeamData = teams.find(t => t.id === parseInt(awayTeam)) || tournament.teams.find(t => t.id === parseInt(awayTeam));
        } else {
            awayTeamData = teams.find(t => t.name === awayTeam) || tournament.teams.find(t => t.name === awayTeam);
        }
        
        if (!homeTeamData || !awayTeamData) {
            console.log('❌ Equipos no encontrados:', { homeTeam, awayTeam });
            console.log('📋 Equipos disponibles:', teams.map(t => ({ id: t.id, name: t.name })));
            return res.status(400).json({ error: 'Uno o ambos equipos no existen' });
        }
        
        console.log('✅ Equipos encontrados:', {
            home: { id: homeTeamData.id, name: homeTeamData.name },
            away: { id: awayTeamData.id, name: awayTeamData.name }
        });
        
        const newMatch = {
            id: Date.now(),
            homeTeam: homeTeamData.name, // Guardar nombre del equipo
            awayTeam: awayTeamData.name, // Guardar nombre del equipo
            homeTeamId: homeTeamData.id, // También guardar ID para referencia
            awayTeamId: awayTeamData.id, // También guardar ID para referencia
            homeTeamLogo: homeTeamData.logo || 'img/default-team.png', // Agregar logo
            awayTeamLogo: awayTeamData.logo || 'img/default-team.png', // Agregar logo
            date,
            time,
            matchday: matchday || 1,
            status: 'scheduled',
            homeScore: null,
            awayScore: null
        };
        
        matches.push(newMatch);
        saveData();
        
        // Emitir actualización en tiempo real
        io.emit('matchesUpdate', matches);
        
        res.json({ success: true, match: newMatch });
    } catch (error) {
        console.error('Error agregando partido:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar resultado de partido (solo admin)
app.put('/api/tournament/matches/:id', (req, res) => {
    try {
        const matchId = parseInt(req.params.id);
        const { homeScore, awayScore, status } = req.body;
        
        const matchIndex = matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1) {
            return res.status(404).json({ error: 'Partido no encontrado' });
        }
        
        const match = matches[matchIndex];
        
        if (homeScore !== undefined) match.homeScore = parseInt(homeScore);
        if (awayScore !== undefined) match.awayScore = parseInt(awayScore);
        if (status) match.status = status;
        
        // Si se agregan resultados, marcar como terminado
        if (homeScore !== undefined && awayScore !== undefined) {
            match.status = 'finished';
        }
        
        matches[matchIndex] = match;
        
        // Actualizar tabla de posiciones automáticamente
        updateStandingsFromMatches();
        
        saveData();
        
        // Emitir actualizaciones en tiempo real
        io.emit('matchesUpdate', matches);
        io.emit('standingsUpdate', standings);
        
        res.json({ success: true, match });
    } catch (error) {
        console.error('Error actualizando partido:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar partido (solo admin)
app.delete('/api/tournament/matches/:id', (req, res) => {
    try {
        const matchId = parseInt(req.params.id);
        const matchIndex = matches.findIndex(m => m.id === matchId);
        
        if (matchIndex === -1) {
            return res.status(404).json({ error: 'Partido no encontrado' });
        }
        
        matches.splice(matchIndex, 1);
        
        // Recalcular tabla de posiciones
        updateStandingsFromMatches();
        
        saveData();
        
        // Emitir actualizaciones en tiempo real
        io.emit('matchesUpdate', matches);
        io.emit('standingsUpdate', standings);
        
        res.json({ success: true, message: 'Partido eliminado' });
    } catch (error) {
        console.error('Error eliminando partido:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Función para actualizar tabla de posiciones basada en partidos
function updateStandingsFromMatches() {
    console.log('🔄 Actualizando tabla de posiciones desde partidos...');
    console.log('📋 Tournament.teams disponibles:', tournament.teams.length);
    
    // Reinicializar tabla de posiciones
    const teamStats = {};
    
    // Inicializar estadísticas para todos los equipos
    tournament.teams.forEach(team => {
        teamStats[team.name] = {
            team: team.name,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0
        };
    });
    
    // Procesar partidos terminados
    matches.filter(m => m.status === 'finished' && m.homeScore !== null && m.awayScore !== null)
           .forEach(match => {
        const homeTeam = match.homeTeam;
        const awayTeam = match.awayTeam;
        const homeScore = match.homeScore;
        const awayScore = match.awayScore;
        
        if (teamStats[homeTeam] && teamStats[awayTeam]) {
            // Actualizar estadísticas del equipo local
            teamStats[homeTeam].played++;
            teamStats[homeTeam].goalsFor += homeScore;
            teamStats[homeTeam].goalsAgainst += awayScore;
            
            // Actualizar estadísticas del equipo visitante
            teamStats[awayTeam].played++;
            teamStats[awayTeam].goalsFor += awayScore;
            teamStats[awayTeam].goalsAgainst += homeScore;
            
            // Determinar resultado
            if (homeScore > awayScore) {
                // Victoria local
                teamStats[homeTeam].won++;
                teamStats[homeTeam].points += 3;
                teamStats[awayTeam].lost++;
            } else if (homeScore < awayScore) {
                // Victoria visitante
                teamStats[awayTeam].won++;
                teamStats[awayTeam].points += 3;
                teamStats[homeTeam].lost++;
            } else {
                // Empate
                teamStats[homeTeam].drawn++;
                teamStats[homeTeam].points += 1;
                teamStats[awayTeam].drawn++;
                teamStats[awayTeam].points += 1;
            }
            
            // Calcular diferencia de goles
            teamStats[homeTeam].goalDifference = teamStats[homeTeam].goalsFor - teamStats[homeTeam].goalsAgainst;
            teamStats[awayTeam].goalDifference = teamStats[awayTeam].goalsFor - teamStats[awayTeam].goalsAgainst;
        }
    });
    
    // Convertir a array y ordenar
    standings.length = 0; // Limpiar array existente
    
    console.log('📊 Equipos procesados para tabla de posiciones:', Object.keys(teamStats).length);
    console.log('🏆 Equipos en teamStats:', Object.keys(teamStats));
    
    Object.values(teamStats)
        .sort((a, b) => {
            // Ordenar por puntos, luego por diferencia de goles, luego por goles a favor
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            return b.goalsFor - a.goalsFor;
        })
        .forEach((team, index) => {
            standings.push({ ...team, position: index + 1 });
        });
    
    console.log('✅ Tabla de posiciones actualizada con', standings.length, 'equipos');
    console.log('📋 Equipos en standings:', standings.map(s => s.team));
}

// ==================== TEAMS API ====================

// Obtener lista de equipos
app.get('/api/teams', (req, res) => {
    try {
        res.json(tournament.teams);
    } catch (error) {
        console.error('Error al obtener equipos:', error);
        res.status(500).json({ error: 'Error al obtener la lista de equipos' });
    }
});

// Obtener un equipo por ID
app.get('/api/teams/:id', (req, res) => {
    try {
        const teamId = req.params.id;
        const team = tournament.teams.find(t => t.id === teamId);
        
        if (!team) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }
        
        res.json(team);
    } catch (error) {
        console.error('Error al obtener equipo:', error);
        res.status(500).json({ error: 'Error al obtener el equipo' });
    }
});

// Crear un nuevo equipo
app.post('/api/teams', uploadImage.single('logo'), async (req, res) => {
    try {
        const { name } = req.body;
        
        // Validar campos obligatorios
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'El nombre del equipo es obligatorio' });
        }
        
        // Limpiar el nombre
        const cleanName = name.trim();
        
        // Verificar si el equipo ya existe
        const existingTeam = teams.find(t => t.name.toLowerCase() === cleanName.toLowerCase());
        if (existingTeam) {
            return res.status(400).json({ error: 'El equipo ya existe' });
        }
        
        let logoUrl = 'img/default-team.png';
        
        // Subir logo a Cloudinary si se proporcionó y está configurado
        if (req.file) {
            try {
                // Verificar si Cloudinary está configurado
                if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
                    const result = await new Promise((resolve, reject) => {
                        cloudinary.uploader.upload_stream(
                            { resource_type: 'auto', folder: 'lpcp/teams' },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        ).end(req.file.buffer);
                    });
                    logoUrl = result.secure_url;
                    console.log('✅ Logo subido a Cloudinary:', logoUrl);
                } else {
                    console.log('⚠️ Cloudinary no configurado, usando logo por defecto');
                    // Guardar archivo localmente como fallback
                    const fileName = `team_${Date.now()}_${req.file.originalname}`;
                    const localPath = path.join(__dirname, 'uploads', fileName);
                    fs.writeFileSync(localPath, req.file.buffer);
                    logoUrl = `/uploads/${fileName}`;
                    console.log('📁 Logo guardado localmente:', logoUrl);
                }
            } catch (uploadError) {
                console.error('❌ Error subiendo logo:', uploadError);
                // Continuar con logo por defecto si falla la subida
                logoUrl = 'img/default-team.png';
            }
        }
        
        const teamId = Date.now();
        
        // Crear equipo para el array teams
        const newTeam = {
            id: teamId,
            name: cleanName,
            logo: logoUrl
        };
        
        // Crear equipo para la tabla de posiciones
        const tournamentTeam = {
            id: `team_${teamId}`,
            name: cleanName,
            shortName: cleanName.substring(0, 3).toUpperCase(),
            logo: logoUrl,
            coach: '',
            stadium: '',
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0
        };
        
        // Agregar a ambos arrays
        teams.push(newTeam);
        tournament.teams.push(tournamentTeam);
        
        // También crear automáticamente como club
        const newClub = {
            id: `club_${teamId}`,
            name: cleanName,
            description: `Club de fútbol ${cleanName}`,
            founded: new Date().getFullYear(),
            players: 0,
            logo: logoUrl
        };
        clubs.push(newClub);
        
        // Recalcular tabla de posiciones
        updateStandingsFromMatches();
        saveData();
        
        // Emitir actualizaciones en tiempo real
        io.emit('teamsUpdate', teams);
        io.emit('standingsUpdate', standings);
        io.emit('clubsUpdate', clubs);
        
        res.json({ success: true, team: newTeam });
    } catch (error) {
        console.error('Error agregando equipo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar un equipo existente
app.put('/api/teams/:id', upload.single('logo'), async (req, res) => {
    try {
        const teamId = req.params.id;
        const { name, shortName, coach, stadium } = req.body;
        
        const teamIndex = tournament.teams.findIndex(t => t.id === teamId);
        
        if (teamIndex === -1) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }
        
        let logoUrl = tournament.teams[teamIndex].logo;
        
        // Actualizar logo si se proporciona uno nuevo
        if (req.file) {
            // Eliminar la imagen anterior de Cloudinary si existe
            if (logoUrl) {
                const publicId = logoUrl.split('/').pop().split('.')[0];
                try {
                    await cloudinary.uploader.destroy(`lpcp/teams/${publicId}`);
                } catch (error) {
                    console.warn('No se pudo eliminar la imagen anterior:', error);
                }
            }
            
            // Subir la nueva imagen
            const result = await cloudinary.uploader.upload_stream(
                { resource_type: 'auto', folder: 'lpcp/teams' },
                (error, result) => {
                    if (error) throw error;
                    logoUrl = result.secure_url;
                }
            ).end(req.file.buffer);
        }
        
        // Actualizar datos del equipo
        tournament.teams[teamIndex] = {
            ...tournament.teams[teamIndex],
            name: name || tournament.teams[teamIndex].name,
            shortName: shortName || tournament.teams[teamIndex].shortName,
            logo: logoUrl,
            coach: coach !== undefined ? coach : tournament.teams[teamIndex].coach,
            stadium: stadium !== undefined ? stadium : tournament.teams[teamIndex].stadium
        };
        
        saveData();
        
        // Emitir actualización a todos los clientes
        io.emit('teamsUpdate', tournament.teams);
        
        res.json(tournament.teams[teamIndex]);
    } catch (error) {
        console.error('Error al actualizar equipo:', error);
        res.status(500).json({ error: 'Error al actualizar el equipo' });
    }
});

// Eliminar un equipo
app.delete('/api/teams/:id', async (req, res) => {
    try {
        const teamId = req.params.id;
        const teamIndex = tournament.teams.findIndex(t => t.id === teamId);
        
        if (teamIndex === -1) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }
        
        // Eliminar logo de Cloudinary si existe
        const team = tournament.teams[teamIndex];
        if (team.logo) {
            try {
                const publicId = team.logo.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`lpcp/teams/${publicId}`);
            } catch (error) {
                console.warn('No se pudo eliminar la imagen del equipo:', error);
            }
        }
        
        // Eliminar el equipo
        tournament.teams.splice(teamIndex, 1);
        
        // Actualizar partidos que involucren a este equipo
        tournament.matches = tournament.matches.filter(match => 
            match.homeTeam !== teamId && match.awayTeam !== teamId
        );
        
        saveData();
        
        // Emitir actualizaciones
        io.emit('teamsUpdate', tournament.teams);
        io.emit('matchesUpdate', tournament.matches);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar equipo:', error);
        res.status(500).json({ error: 'Error al eliminar el equipo' });
    }
});

// ==================== CLUBS API ====================

// Variable global para almacenar clubes
let clubs = [];

// Variable global para almacenar jugadores
let players = [];

// Inicializar clubes basados en los equipos del torneo
function initializeClubs() {
    if (!clubs || clubs.length === 0) {
        // Crear clubes basados en todos los equipos del torneo
        clubs = teams.map(team => {
            // Generar descripción personalizada para cada equipo
            const descriptions = {
                "ACP 507": "Representando la tradición canalera con orgullo y determinación.",
                "BKS FC": "Fuerza y determinación caracterizan a este equipo competitivo.",
                "Coiner FC": "Estrategia y precisión definen el estilo de juego de este equipo.",
                "FC WEST SIDE": "Desde el oeste de Panamá, con pasión y técnica incomparable.",
                "Humacao FC": "Tradición y garra desde Humacao, siempre luchando por la victoria.",
                "Jumpers FC": "Agilidad y velocidad son las armas de este dinámico equipo.",
                "LOS PLEBES Tk": "Juventud y energía desbordante en cada jugada del partido.",
                "Punta Coco FC": "Desde la costa, con el espíritu del mar y la determinación.",
                "Pura Vibra": "Energía pura y pasión desmedida en cada encuentro deportivo.",
                "Rayos X FC": "Precisión quirúrgica y visión de juego excepcional.",
                "Tiki Taka FC": "Maestros del pase corto y el juego de posesión.",
                "WEST SIDE PTY": "Representando el oeste con orgullo y técnica depurada."
            };
            
            // Generar logos basados en nombres existentes (todos los equipos)
            const logos = {
                "ACP 507": "/img/APC 507.png",
                "BKS FC": "/img/BKS FC.jpg",
                "Coiner FC": "/img/Coiner FC.jpg",
                "FC WEST SIDE": "/img/West side.jpg",
                "Humacao FC": "/img/Humacao fc.jpg",
                "Jumpers FC": "/img/Jumpers FC.jpg",
                "LOS PLEBES Tk": "/img/Los Plebes.jpg",
                "Punta Coco FC": "/img/Punta Coco FC.png",
                "Pura Vibra": "/img/Pura vibra.png",
                "Rayos X FC": "/img/Rayos x FC.jpg",
                "Tiki Taka FC": "/img/Tiki taka FC.jpg",
                "WEST SIDE PTY": "/img/West Side PTY.jpg"
            };
            
            return {
                id: team.id,
                name: team.name,
                description: descriptions[team.name] || `Club de fútbol ${team.name}, comprometido con la excelencia deportiva.`,
                founded: team.founded,
                players: Math.floor(Math.random() * 8) + 11, // Entre 11 y 18 jugadores
                logo: logos[team.name] || '' // Logo vacío si no existe
            };
        });
        
        console.log(`✅ Clubes inicializados: ${clubs.length} clubes basados en equipos del torneo`);
    }
}

// ==================== PLAYERS API ====================

// Obtener lista de jugadores
app.get('/api/players', (req, res) => {
    try {
        res.json(players);
    } catch (error) {
        console.error('Error al obtener jugadores:', error);
        res.status(500).json({ error: 'Error al obtener la lista de jugadores' });
    }
});

// Obtener jugadores por club
app.get('/api/players/club/:clubId', (req, res) => {
    try {
        const clubId = req.params.clubId;
        const clubPlayers = players.filter(p => p.clubId === clubId);
        res.json(clubPlayers);
    } catch (error) {
        console.error('Error al obtener jugadores del club:', error);
        res.status(500).json({ error: 'Error al obtener jugadores del club' });
    }
});

// Crear un nuevo jugador
app.post('/api/players', uploadImage.single('playerPhoto'), async (req, res) => {
    try {
        const { name, clubId, position, age, number, nationality } = req.body;
        
        if (!name || !clubId) {
            return res.status(400).json({ error: 'Nombre y equipo son requeridos' });
        }
        
        // Verificar que el número no esté en uso en el mismo club
        if (number) {
            const existingPlayer = players.find(p => p.clubId === clubId && p.number === parseInt(number));
            if (existingPlayer) {
                return res.status(400).json({ error: `El número ${number} ya está en uso en este equipo` });
            }
        }
        
        let photoUrl = '';
        
        // Subir foto a Cloudinary si se proporcionó
        if (req.file) {
            try {
                const result = await cloudinary.uploader.upload_stream(
                    { resource_type: 'auto', folder: 'lpcp/players' },
                    (error, result) => {
                        if (error) throw error;
                        return result;
                    }
                ).end(req.file.buffer);
                
                photoUrl = result.secure_url;
            } catch (error) {
                console.warn('Error subiendo foto a Cloudinary:', error);
                // Continuar sin foto si falla la subida
            }
        }
        
        // Obtener nombre del club - Convertir clubId a número para comparación correcta
        const numericClubId = parseInt(clubId);
        
        console.log('🔍 Datos de búsqueda:', {
            clubId: clubId,
            numericClubId: numericClubId,
            clubIdType: typeof clubId,
            numericClubIdType: typeof numericClubId,
            clubsCount: clubs.length,
            teamsCount: teams.length,
            clubsIds: clubs.map(c => ({ id: c.id, name: c.name, idType: typeof c.id })),
            teamsIds: teams.map(t => ({ id: t.id, name: t.name, idType: typeof t.id }))
        });
        
        // Buscar usando tanto el valor original como el convertido a número
        const club = clubs.find(c => c.id === clubId || c.id === numericClubId) || 
                    teams.find(t => t.id === clubId || t.id === numericClubId);
        const clubName = club ? club.name : 'Equipo desconocido';
        
        console.log('🔍 Resultado de búsqueda:', { clubId, clubFound: !!club, clubName });
        
        const newPlayer = {
            id: Date.now(),
            name: name.trim(),
            clubId: clubId,
            clubName: clubName,
            position: position || 'Jugador',
            age: age ? parseInt(age) : null,
            number: number ? parseInt(number) : null,
            nationality: nationality || 'Panamá',
            photo: photoUrl,
            registeredAt: new Date().toISOString()
        };
        
        players.push(newPlayer);
        
        // Guardar cambios
        saveData();
        
        // Notificar a los clientes
        io.emit('playersUpdate', players);
        
        res.json(newPlayer);
    } catch (error) {
        console.error('Error al crear jugador:', error);
        res.status(500).json({ error: 'Error al crear el jugador' });
    }
});

// ==================== CLUBS API ====================

// Obtener lista de clubes
app.get('/api/clubs', (req, res) => {
    try {
        initializeClubs();
        res.json(clubs);
    } catch (error) {
        console.error('Error al obtener clubes:', error);
        res.status(500).json({ error: 'Error al obtener la lista de clubes' });
    }
});

// Obtener un club por ID
app.get('/api/clubs/:id', (req, res) => {
    try {
        const clubId = parseInt(req.params.id);
        const club = clubs.find(c => c.id === clubId);
        
        if (!club) {
            return res.status(404).json({ error: 'Club no encontrado' });
        }
        
        res.json(club);
    } catch (error) {
        console.error('Error al obtener club:', error);
        res.status(500).json({ error: 'Error al obtener el club' });
    }
});

// Crear un nuevo club
app.post('/api/clubs', uploadImage.single('clubLogo'), async (req, res) => {
    try {
        console.log('🏢 Creando nuevo club...');
        console.log('📋 Datos recibidos:', req.body);
        
        const { clubName, clubDescription, clubFounded, clubPlayers } = req.body;
        
        // Validación más tolerante
        if (!clubName || clubName.trim() === '') {
            console.log('❌ Nombre del club faltante');
            return res.status(400).json({ error: 'El nombre del club es requerido' });
        }
        
        if (!clubDescription || clubDescription.trim() === '') {
            console.log('❌ Descripción del club faltante');
            return res.status(400).json({ error: 'La descripción del club es requerida' });
        }
        
        if (!clubFounded) {
            console.log('❌ Año de fundación faltante');
            return res.status(400).json({ error: 'El año de fundación es requerido' });
        }
        
        if (!clubPlayers) {
            console.log('❌ Número de jugadores faltante');
            return res.status(400).json({ error: 'El número de jugadores es requerido' });
        }
        
        // Validar datos
        const founded = parseInt(clubFounded);
        const players = parseInt(clubPlayers);
        
        if (founded < 2000 || founded > 2030) {
            return res.status(400).json({ error: 'El año de fundación debe estar entre 2000 y 2030' });
        }
        
        if (players < 1 || players > 50) {
            return res.status(400).json({ error: 'El número de jugadores debe estar entre 1 y 50' });
        }
        
        let logoUrl = '';
        
        // Subir logo (local o Cloudinary)
        if (req.file) {
            try {
                // Intentar subir a Cloudinary primero
                if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
                    const result = await new Promise((resolve, reject) => {
                        cloudinary.uploader.upload_stream(
                            { resource_type: 'auto', folder: 'lpcp/clubs' },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        ).end(req.file.buffer);
                    });
                    logoUrl = result.secure_url;
                } else {
                    // Fallback: guardar localmente
                    const fileName = `club-${Date.now()}-${req.file.originalname}`;
                    const filePath = path.join(uploadsDir, fileName);
                    fs.writeFileSync(filePath, req.file.buffer);
                    logoUrl = `/uploads/${fileName}`;
                    console.log('📁 Logo guardado localmente:', logoUrl);
                }
            } catch (error) {
                console.warn('⚠️ Error subiendo logo, intentando guardar localmente:', error);
                try {
                    // Fallback: guardar localmente si falla Cloudinary
                    const fileName = `club-${Date.now()}-${req.file.originalname}`;
                    const filePath = path.join(uploadsDir, fileName);
                    fs.writeFileSync(filePath, req.file.buffer);
                    logoUrl = `/uploads/${fileName}`;
                    console.log('📁 Logo guardado localmente como fallback:', logoUrl);
                } catch (localError) {
                    console.error('❌ Error guardando logo localmente:', localError);
                }
            }
        }
        
        initializeClubs();
        
        const newClub = {
            id: Math.max(...clubs.map(c => c.id), 0) + 1,
            name: clubName.trim(),
            description: clubDescription.trim(),
            founded: founded,
            players: players,
            logo: logoUrl
        };
        
        clubs.push(newClub);
        
        // Guardar los cambios
        saveData();
        
        // Emitir actualización a todos los clientes
        io.emit('clubsUpdate', clubs);
        
        res.json(newClub);
    } catch (error) {
        console.error('❌ Error al crear club:', error);
        res.status(500).json({ error: 'Error al crear el club' });
    }
});

// Eliminar un jugador
app.delete('/api/players/:id', async (req, res) => {
    try {
        const playerId = parseInt(req.params.id);
        
        const playerIndex = players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) {
            return res.status(404).json({ error: 'Jugador no encontrado' });
        }
        
        // Eliminar foto de Cloudinary si existe
        const player = players[playerIndex];
        if (player.photo && player.photo.includes('cloudinary')) {
            try {
                const publicId = player.photo.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`lpcp/players/${publicId}`);
            } catch (error) {
                console.warn('No se pudo eliminar la foto del jugador de Cloudinary:', error);
            }
        }
        
        // Eliminar jugador
        players.splice(playerIndex, 1);
        
        // Guardar cambios
        saveData();
        
        // Notificar a los clientes
        io.emit('playersUpdate', players);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar jugador:', error);
        res.status(500).json({ error: 'Error al eliminar el jugador' });
    }
});

// Actualizar un club
app.put('/api/clubs/:id', uploadImage.single('clubLogo'), async (req, res) => {
    try {
        const clubId = parseInt(req.params.id);
        const { clubName, clubDescription, clubFounded, clubPlayers } = req.body;
        
        initializeClubs();
        const clubIndex = clubs.findIndex(c => c.id === clubId);
        
        if (clubIndex === -1) {
            return res.status(404).json({ error: 'Club no encontrado' });
        }
        
        let logoUrl = clubs[clubIndex].logo; // Mantener logo existente por defecto
        
        // Subir nuevo logo si se proporcionó
        if (req.file) {
            try {
                // Eliminar logo anterior si es de Cloudinary
                if (clubs[clubIndex].logo && clubs[clubIndex].logo.includes('cloudinary')) {
                    try {
                        const publicId = clubs[clubIndex].logo.split('/').pop().split('.')[0];
                        await cloudinary.uploader.destroy(`lpcp/clubs/${publicId}`);
                    } catch (error) {
                        console.warn('No se pudo eliminar la imagen anterior de Cloudinary:', error);
                    }
                }
                
                // Intentar subir a Cloudinary si está configurado
                if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
                    try {
                        const result = await new Promise((resolve, reject) => {
                            cloudinary.uploader.upload_stream(
                                { resource_type: 'auto', folder: 'lpcp/clubs' },
                                (error, result) => {
                                    if (error) reject(error);
                                    else resolve(result);
                                }
                            ).end(req.file.buffer);
                        });
                        logoUrl = result.secure_url;
                        console.log('☁️ Logo actualizado en Cloudinary:', logoUrl);
                    } catch (cloudinaryError) {
                        console.warn('⚠️ Error subiendo a Cloudinary, intentando guardar localmente:', cloudinaryError);
                        throw cloudinaryError; // Caer al bloque catch externo para manejar el fallo
                    }
                } else {
                    // Guardar localmente si no hay configuración de Cloudinary
                    const fileName = `club-${Date.now()}-${req.file.originalname}`;
                    const filePath = path.join(uploadsDir, fileName);
                    fs.writeFileSync(filePath, req.file.buffer);
                    logoUrl = `/uploads/${fileName}`;
                    console.log('📁 Logo actualizado y guardado localmente (sin Cloudinary):', logoUrl);
                }
            } catch (error) {
                console.warn('⚠️ Error subiendo nuevo logo, intentando guardar localmente:', error);
                try {
                    // Último intento: guardar localmente
                    const fileName = `club-${Date.now()}-${req.file.originalname}`;
                    const filePath = path.join(uploadsDir, fileName);
                    fs.writeFileSync(filePath, req.file.buffer);
                    logoUrl = `/uploads/${fileName}`;
                    console.log('📁 Logo actualizado y guardado localmente como fallback:', logoUrl);
                } catch (localError) {
                    console.error('❌ Error crítico guardando logo localmente:', localError);
                    return res.status(500).json({ error: 'No se pudo guardar el logo' });
                }
            }
        }
        
        // Actualizar datos del club
        clubs[clubIndex] = {
            ...clubs[clubIndex],
            name: clubName ? clubName.trim() : clubs[clubIndex].name,
            description: clubDescription ? clubDescription.trim() : clubs[clubIndex].description,
            founded: clubFounded ? parseInt(clubFounded) : clubs[clubIndex].founded,
            players: clubPlayers ? parseInt(clubPlayers) : clubs[clubIndex].players,
            logo: logoUrl
        };
        
        // Guardar los cambios
        saveData();
        
        // Emitir actualización a todos los clientes
        io.emit('clubsUpdate', clubs);
        
        res.json(clubs[clubIndex]);
    } catch (error) {
        console.error('Error al actualizar club:', error);
        res.status(500).json({ error: 'Error al actualizar el club' });
    }
});

// Eliminar un club
app.delete('/api/clubs/:id', async (req, res) => {
    try {
        const clubId = parseInt(req.params.id);
        
        initializeClubs();
        const clubIndex = clubs.findIndex(c => c.id === clubId);
        
        if (clubIndex === -1) {
            return res.status(404).json({ error: 'Club no encontrado' });
        }
        
        // Eliminar logo de Cloudinary si existe
        const club = clubs[clubIndex];
        if (club.logo && club.logo.includes('cloudinary')) {
            try {
                const publicId = club.logo.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`lpcp/clubs/${publicId}`);
            } catch (error) {
                console.warn('No se pudo eliminar la imagen del club:', error);
            }
        }
        
        // Eliminar el club
        clubs.splice(clubIndex, 1);
        
        // Guardar los cambios
        saveData();
        
        // Emitir actualización
        io.emit('clubsUpdate', clubs);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar club:', error);
        res.status(500).json({ error: 'Error al eliminar el club' });
    }
});

// Inicializar clubes al arrancar el servidor
initializeClubs();

// ==================== PLAYERS API ====================

// Obtener todos los jugadores
app.get('/api/players', (req, res) => {
    try {
        res.json(players);
    } catch (error) {
        console.error('Error al obtener jugadores:', error);
        res.status(500).json({ error: 'Error al obtener la lista de jugadores' });
    }
});

// Obtener jugadores por club
app.get('/api/players/club/:clubId', (req, res) => {
    try {
        const clubId = parseInt(req.params.clubId);
        const clubPlayers = players.filter(p => p.clubId === clubId);
        res.json(clubPlayers);
    } catch (error) {
        console.error('Error al obtener jugadores del club:', error);
        res.status(500).json({ error: 'Error al obtener jugadores del club' });
    }
});

// Obtener un jugador por ID
// Obtener un jugador por ID
app.get('/api/players/:id', (req, res) => {
    try {
        const playerId = parseInt(req.params.id);
        const player = players.find(p => p.id === playerId);
        
        if (!player) {
            return res.status(404).json({ error: 'Jugador no encontrado' });
        }
        
        res.json(player);
    } catch (error) {
        console.error('Error al obtener jugador:', error);
        res.status(500).json({ error: 'Error al obtener el jugador' });
    }
});
app.post('/api/players', async (req, res) => {
    try {
        const { playerName, teamId } = req.body;
        
        console.log('📝 Datos recibidos para registro de jugador:', { playerName, teamId });
        
        if (!playerName || !teamId) {
            return res.status(400).json({ error: 'El nombre del jugador y el equipo son obligatorios' });
        }
        
        // Convertir teamId a número
        const clubId = parseInt(teamId);
        
        // Validaciones
        if (isNaN(clubId)) {
            return res.status(400).json({ error: 'ID de equipo inválido' });
        }
        
        // Verificar que el club existe
        initializeClubs();
        const clubExists = clubs.find(c => c.id === clubId);
        if (!clubExists) {
            return res.status(400).json({ error: 'El club especificado no existe' });
        }
        
        console.log('✅ Club encontrado:', clubExists.name);
        
        const newPlayer = {
            id: Math.max(...players.map(p => p.id), 0) + 1,
            name: playerName.trim(),
            age: null,
            position: '',
            number: null,
            clubId: clubId,
            clubName: clubExists.name,
            nationality: 'Panamá',
            photo: '',
            registeredAt: new Date().toISOString()
        };
        
        console.log('🎯 Nuevo jugador creado:', newPlayer);
        
        players.push(newPlayer);
        
        // Guardar los cambios
        saveData();
        
        // Emitir actualización a todos los clientes
        io.emit('playersUpdate', players);
        
        res.json(newPlayer);
    } catch (error) {
        console.error('Error al registrar jugador:', error);
        res.status(500).json({ error: 'Error al registrar el jugador' });
    }
});

// Endpoint para actualizar un jugador existente
app.put('/api/players/:id', uploadImage.single('playerPhoto'), async (req, res) => {
    try {
        const playerId = parseInt(req.params.id);
        const { playerName, teamId, playerAge, playerPosition, playerNumber, playerNationality } = req.body;
        
        const playerIndex = players.findIndex(p => p.id === playerId);
        
        if (playerIndex === -1) {
            return res.status(404).json({ error: 'Jugador no encontrado' });
        }
        
        let photoUrl = players[playerIndex].photo; // Mantener foto existente por defecto
        
        // Subir nueva foto si se proporcionó
        if (req.file) {
            try {
                // Eliminar foto anterior si es de Cloudinary
                if (players[playerIndex].photo && players[playerIndex].photo.includes('cloudinary')) {
                    try {
                        const publicId = players[playerIndex].photo.split('/').pop().split('.')[0];
                        await cloudinary.uploader.destroy(`lpcp/players/${publicId}`);
                    } catch (error) {
                        console.warn('No se pudo eliminar la foto anterior de Cloudinary:', error);
                    }
                }
                
                // Intentar subir a Cloudinary primero
                if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
                    const result = await new Promise((resolve, reject) => {
                        cloudinary.uploader.upload_stream(
                            { resource_type: 'auto', folder: 'lpcp/players' },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        ).end(req.file.buffer);
                    });
                    photoUrl = result.secure_url;
                } else {
                    // Fallback: guardar localmente
                    const fileName = `player-${Date.now()}-${req.file.originalname}`;
                    const filePath = path.join(uploadsDir, fileName);
                    fs.writeFileSync(filePath, req.file.buffer);
                    photoUrl = `/uploads/${fileName}`;
                    console.log('📁 Foto de jugador actualizada y guardada localmente:', photoUrl);
                }
            } catch (error) {
                console.warn('⚠️ Error subiendo nueva foto, intentando guardar localmente:', error);
                try {
                    // Fallback: guardar localmente si falla Cloudinary
                    const fileName = `player-${Date.now()}-${req.file.originalname}`;
                    const filePath = path.join(uploadsDir, fileName);
                    fs.writeFileSync(filePath, req.file.buffer);
                    photoUrl = `/uploads/${fileName}`;
                    console.log('📁 Foto de jugador actualizada y guardada localmente como fallback:', photoUrl);
                } catch (localError) {
                    console.error('❌ Error guardando foto localmente:', localError);
                }
            }
        }
        
        // Obtener información del club si cambió
        let clubName = players[playerIndex].clubName;
        if (clubId) {
            const club = clubs.find(c => c.id === parseInt(clubId));
            if (club) {
                clubName = club.name;
            }
        }
        
        // Actualizar datos del jugador
        players[playerIndex] = {
            ...players[playerIndex],
            name: playerName ? playerName.trim() : players[playerIndex].name,
            age: playerAge ? parseInt(playerAge) : players[playerIndex].age,
            position: playerPosition ? playerPosition.trim() : players[playerIndex].position,
            number: playerNumber ? parseInt(playerNumber) : players[playerIndex].number,
            clubId: clubId ? parseInt(clubId) : players[playerIndex].clubId,
            clubName: clubName,
            nationality: playerNationality ? playerNationality.trim() : players[playerIndex].nationality,
            photo: photoUrl,
            updatedAt: new Date().toISOString()
        };
        
        // Guardar los cambios
        saveData();
        
        // Emitir actualización a todos los clientes
        io.emit('playersUpdate', players);
        
        res.json(players[playerIndex]);
    } catch (error) {
        console.error('Error al actualizar jugador:', error);
        res.status(500).json({ error: 'Error al actualizar el jugador' });
    }
});

// Eliminar un jugador
app.delete('/api/players/:id', async (req, res) => {
    try {
        const playerId = parseInt(req.params.id);
        
        const playerIndex = players.findIndex(p => p.id === playerId);
        
        if (playerIndex === -1) {
            return res.status(404).json({ error: 'Jugador no encontrado' });
        }
        
        // Eliminar foto de Cloudinary si existe
        const player = players[playerIndex];
        if (player.photo && player.photo.includes('cloudinary')) {
            try {
                const publicId = player.photo.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`lpcp/players/${publicId}`);
            } catch (error) {
                console.warn('No se pudo eliminar la foto del jugador:', error);
            }
        }
        
        // Eliminar el jugador
        players.splice(playerIndex, 1);
        
        // Guardar los cambios
        saveData();
        
        // Emitir actualización
        io.emit('playersUpdate', players);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar jugador:', error);
        res.status(500).json({ error: 'Error al eliminar el jugador' });
    }
});

// ==================== CONFIGURATION API ====================

// Actualizar zonas de clasificación
app.post('/api/settings/classification-zones', (req, res) => {
    try {
        const { classificationZones } = req.body;
        
        if (!classificationZones || !Array.isArray(classificationZones)) {
            return res.status(400).json({ error: 'Zonas de clasificación inválidas' });
        }
        
        settings.classificationZones = classificationZones;
        saveData();
        
        io.emit('classificationZonesUpdate', settings.classificationZones);
        
        res.json({ success: true, message: 'Zonas de clasificación actualizadas' });
    } catch (error) {
        console.error('Error updating classification zones:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar configuración de colores de tabla (legacy - mantener por compatibilidad)
app.post('/api/settings/table-config', (req, res) => {
    try {
        const { tableConfig } = req.body;
        
        if (!settings.tableConfig) {
            settings.tableConfig = {};
        }
        
        settings.tableConfig = { ...settings.tableConfig, ...tableConfig };
        saveData();
        
        io.emit('tableConfigUpdate', settings.tableConfig);
        
        res.json({ success: true, message: 'Configuración de tabla actualizada' });
    } catch (error) {
        console.error('Error updating table config:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar configuración general del torneo
app.post('/api/settings/tournament-config', (req, res) => {
    try {
        const { seasonName, pointsWin, pointsDraw, playoffFormat } = req.body;
        
        if (seasonName) settings.seasonName = seasonName;
        if (pointsWin !== undefined) settings.pointsWin = pointsWin;
        if (pointsDraw !== undefined) settings.pointsDraw = pointsDraw;
        if (playoffFormat) settings.playoffFormat = playoffFormat;
        
        saveData();
        
        io.emit('tournamentConfigUpdate', settings);
        
        res.json({ success: true, message: 'Configuración de torneo actualizada' });
    } catch (error) {
        console.error('Error updating tournament config:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ==================== PLAYOFFS API ====================

// Crear bracket de playoffs
app.post('/api/playoffs/bracket', (req, res) => {
    try {
        const { format, teams, matches, createdAt } = req.body;
        
        if (!format || !teams || !matches) {
            return res.status(400).json({ error: 'Datos de bracket incompletos' });
        }
        
        currentBracket = {
            format,
            teams,
            matches,
            createdAt: createdAt || new Date().toISOString()
        };
        
        saveData();
        
        io.emit('bracketUpdate', currentBracket);
        
        res.json({ success: true, bracket: currentBracket });
    } catch (error) {
        console.error('Error creating bracket:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener bracket actual
app.get('/api/playoffs/bracket', (req, res) => {
    res.json(currentBracket);
});

// Eliminar bracket
app.delete('/api/playoffs/bracket', (req, res) => {
    try {
        currentBracket = null;
        saveData();
        
        io.emit('bracketUpdate', null);
        
        res.json({ success: true, message: 'Bracket eliminado' });
    } catch (error) {
        console.error('Error deleting bracket:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar resultado de partido de playoffs
app.put('/api/playoffs/matches/:matchId', (req, res) => {
    try {
        const matchId = req.params.matchId; // No convertir a entero, mantener como string
        const { homeScore, awayScore } = req.body;
        
        if (!currentBracket || !currentBracket.matches) {
            return res.status(404).json({ error: 'No hay bracket activo' });
        }
        
        console.log('🔍 Buscando partido con ID:', matchId);
        console.log('📋 IDs disponibles:', currentBracket.matches.map(m => m.id));
        
        const matchIndex = currentBracket.matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1) {
            console.log('❌ Partido no encontrado. ID buscado:', matchId);
            console.log('📋 Partidos disponibles:', currentBracket.matches);
            return res.status(404).json({ error: 'Partido no encontrado' });
        }
        
        // Actualizar resultado
        if (homeScore === null || awayScore === null) {
            // Limpiar resultado
            currentBracket.matches[matchIndex].homeScore = null;
            currentBracket.matches[matchIndex].awayScore = null;
            currentBracket.matches[matchIndex].status = 'pending';
            
            // TODO: Revertir avances en rondas siguientes si es necesario
            console.log('🔄 Resultado limpiado para partido:', matchId);
        } else {
            // Establecer resultado
            currentBracket.matches[matchIndex].homeScore = parseInt(homeScore);
            currentBracket.matches[matchIndex].awayScore = parseInt(awayScore);
            currentBracket.matches[matchIndex].status = 'finished';
            
            // Determinar ganador y avanzar al siguiente round si es necesario
            const match = currentBracket.matches[matchIndex];
            const winner = homeScore > awayScore ? match.homeTeam : match.awayTeam;
            
            // Buscar si hay un partido de la siguiente ronda que dependa de este resultado
            advanceWinnerToNextRound(match, winner);
        }
        
        saveData();
        
        io.emit('bracketUpdate', currentBracket);
        
        res.json({ success: true, match: currentBracket.matches[matchIndex] });
    } catch (error) {
        console.error('Error updating playoff match:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Función para avanzar ganador a la siguiente ronda
function advanceWinnerToNextRound(finishedMatch, winner) {
    if (!currentBracket || !currentBracket.matches) return false;
    
    console.log(`🏆 Avanzando ganador: ${winner} del partido ${finishedMatch.id}`);
    let updated = false;
    
    // Extraer el número del match ID (ej: "match_1" -> "1")
    const matchNumber = finishedMatch.id.replace('match_', '');
    
    // Buscar todos los partidos que esperan el resultado de este partido
    const matchesToUpdate = currentBracket.matches.filter(match => {
        if (!match.homeTeam || !match.awayTeam) return false;
        
        // Verificar si este partido espera el resultado del partido terminado
        // Buscar tanto "Ganador Match X" como "Ganador de match_X"
        const isHomeWaiting = match.homeTeam.includes(`Ganador Match ${matchNumber}`) || 
                             match.homeTeam.includes(`Ganador de ${finishedMatch.id}`) ||
                             match.homeTeam === `Ganador Match ${matchNumber}`;
        const isAwayWaiting = match.awayTeam.includes(`Ganador Match ${matchNumber}`) || 
                             match.awayTeam.includes(`Ganador de ${finishedMatch.id}`) ||
                             match.awayTeam === `Ganador Match ${matchNumber}`;
        
        return isHomeWaiting || isAwayWaiting;
    });
    
    console.log(`🔍 Buscando partidos que esperan resultado del Match ${matchNumber}:`);
    console.log(`📋 Partidos encontrados:`, matchesToUpdate.map(m => ({ id: m.id, home: m.homeTeam, away: m.awayTeam })));
    
    // Actualizar los partidos que esperan este resultado
    matchesToUpdate.forEach(match => {
        const isHomeWaiting = match.homeTeam.includes(`Ganador Match ${matchNumber}`) || 
                            match.homeTeam.includes(`Ganador de ${finishedMatch.id}`) ||
                            match.homeTeam === `Ganador Match ${matchNumber}`;
        const isAwayWaiting = match.awayTeam.includes(`Ganador Match ${matchNumber}`) || 
                            match.awayTeam.includes(`Ganador de ${finishedMatch.id}`) ||
                            match.awayTeam === `Ganador Match ${matchNumber}`;
        
        if (isHomeWaiting) {
            console.log(`📝 Actualizando ${match.id} (local): ${match.homeTeam} → ${winner}`);
            match.homeTeam = winner;
            updated = true;
            
            // Si el otro equipo ya está definido, marcar como listo
            if (match.awayTeam && !match.awayTeam.includes('Ganador')) {
                console.log(`🔔 Partido ${match.id} listo para jugar: ${match.homeTeam} vs ${match.awayTeam}`);
            }
        }
        
        if (isAwayWaiting) {
            console.log(`📝 Actualizando ${match.id} (visitante): ${match.awayTeam} → ${winner}`);
            match.awayTeam = winner;
            updated = true;
            
            // Si el otro equipo ya está definido, marcar como listo
            if (match.homeTeam && !match.homeTeam.includes('Ganador')) {
                console.log(`🔔 Partido ${match.id} listo para jugar: ${match.homeTeam} vs ${match.awayTeam}`);
            }
        }
    });
    
    if (updated) {
        console.log(`✅ ${matchesToUpdate.length} partido(s) actualizado(s) con el ganador ${winner}`);
        
        // Guardar los cambios en el bracket
        saveData();
        
        // Notificar a los clientes sobre la actualización del bracket
        io.emit('bracketUpdate', currentBracket);
        console.log('🔔 Notificación de actualización de bracket enviada a los clientes');
    } else {
        console.log(`ℹ️ No se encontraron partidos que dependan del resultado del Match ${matchNumber}`);
    }
    
    return updated;
}

// Servir archivos de video (redirigir a Cloudinary)
app.get('/uploads/*', (req, res) => {
    const fullPath = req.params[0]; // Captura toda la ruta después de /uploads/
    console.log('Buscando video con ruta completa:', fullPath);
    console.log('Clips disponibles:', clips.map(c => ({ id: c.id, filename: c.filename, video_url: c.video_url })));
    
    // Buscar el clip por filename (puede ser el public_id completo o parte de él)
    const clip = clips.find(c => {
        if (!c.filename) return false;
        
        // Extraer el nombre del archivo sin la carpeta
        const clipBaseName = c.filename.split('/').pop();
        const searchBaseName = fullPath.split('/').pop();
        
        console.log('Comparando:', {
            clipFilename: c.filename,
            clipBaseName: clipBaseName,
            fullPath: fullPath,
            searchBaseName: searchBaseName
        });
        
        // Buscar por diferentes combinaciones
        return c.filename === fullPath || 
               c.filename.includes(searchBaseName) || 
               fullPath.includes(clipBaseName) ||
               clipBaseName === searchBaseName;
    });
    
    if (!clip) {
        console.log('Clip no encontrado para ruta:', fullPath);
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    if (!clip.video_url) {
        console.log('Clip encontrado pero sin video_url:', clip);
        return res.status(404).json({ error: 'URL de video no disponible' });
    }
    
    console.log('Redirigiendo a:', clip.video_url);
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

app.get('/admin.html', (req, res) => {
    // Redirigir a login para autenticación
    res.redirect('/login.html');
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Ruta protegida para el admin (solo accesible después de login)
app.get('/admin-panel.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/jugadores.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'jugadores.html'));
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

// Ruta para jugadores
app.get('/jugadores', (req, res) => {
    res.sendFile(path.join(__dirname, 'jugadores.html'));
});

// Función para inicializar equipos del torneo
function initializeTournamentTeams() {
    console.log('🔄 Inicializando tournament.teams...');
    
    // Limpiar tournament.teams
    tournament.teams = [];
    
    // Copiar todos los equipos existentes a tournament.teams
    teams.forEach(team => {
        const tournamentTeam = {
            id: team.id || `team_${Date.now()}_${Math.random()}`,
            name: team.name,
            shortName: team.name.substring(0, 3).toUpperCase(),
            logo: team.logo || 'img/default-team.png',
            coach: team.coach || '',
            stadium: team.stadium || '',
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0
        };
        tournament.teams.push(tournamentTeam);
    });
    
    console.log(`✅ Tournament.teams inicializado con ${tournament.teams.length} equipos`);
}

// Inicializar tournament.teams con equipos existentes
initializeTournamentTeams();

// Inicializar tabla de posiciones al arrancar
console.log('📊 Inicializando tabla de posiciones...');
updateStandingsFromMatches();
console.log(`✅ Tabla de posiciones inicializada con ${standings.length} equipos`);

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
