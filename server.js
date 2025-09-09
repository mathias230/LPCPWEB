require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "DELETE", "PUT"]
    }
});

const PORT = process.env.PORT || 3000;

// ==================== CONFIGURACIÓN MONGODB ====================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lpcp';

mongoose.connect(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
})
.then(() => {
    console.log('✅ Conectado a MongoDB exitosamente');
})
.catch((error) => {
    console.error('❌ Error conectando a MongoDB:', error.message);
});

// ==================== CONFIGURACIÓN CLOUDINARY ====================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ==================== CONFIGURACIÓN MULTER ====================
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
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

const uploadImage = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen'));
        }
    }
});

// ==================== MODELOS MONGODB ====================
const TeamSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    founded: { type: Number, required: true },
    stadium: { type: String, default: '' },
    logo: { type: String, default: 'img/default-team.png' },
    createdAt: { type: Date, default: Date.now }
});

const PlayerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    position: { type: String, required: true },
    number: { type: Number, required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    clubName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const ClubSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    stadium: { type: String, default: '' },
    founded: { type: Number, required: true },
    players: { type: Number, default: 0 },
    logo: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const MatchSchema = new mongoose.Schema({
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    homeScore: { type: Number, default: null },
    awayScore: { type: Number, default: null },
    date: { type: Date, required: true },
    status: { type: String, enum: ['scheduled', 'live', 'finished'], default: 'scheduled' },
    round: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const TournamentSettingsSchema = new mongoose.Schema({
    classificationZones: [{
        name: { type: String, required: true },
        color: { type: String, required: true },
        startPosition: { type: Number, required: true },
        endPosition: { type: Number, required: true }
    }],
    updatedAt: { type: Date, default: Date.now }
});

const Team = mongoose.model('Team', TeamSchema);
const Player = mongoose.model('Player', PlayerSchema);
const Club = mongoose.model('Club', ClubSchema);
const Match = mongoose.model('Match', MatchSchema);
const TournamentSettings = mongoose.model('TournamentSettings', TournamentSettingsSchema);

// ==================== CLIPS TEMPORALES ====================
let clips = [];
let stats = {
    total_clips: 0,
    total_views: 0,
    total_likes: 0
};

// Crear directorios necesarios
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Cargar clips desde archivos locales
function loadClips() {
    const clipsFile = path.join(dataDir, 'clips.json');
    const statsFile = path.join(dataDir, 'stats.json');
    
    if (fs.existsSync(clipsFile)) {
        try {
            clips = JSON.parse(fs.readFileSync(clipsFile, 'utf8'));
            console.log('✅ Clips cargados:', clips.length);
        } catch (error) {
            console.log('⚠️ Error cargando clips, iniciando con array vacío');
            clips = [];
        }
    }
    
    if (fs.existsSync(statsFile)) {
        try {
            stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
            console.log('✅ Estadísticas cargadas:', stats);
        } catch (error) {
            console.log('⚠️ Error cargando estadísticas');
        }
    }
}

// Guardar clips localmente
function saveClips() {
    try {
        const clipsFile = path.join(dataDir, 'clips.json');
        const statsFile = path.join(dataDir, 'stats.json');
        
        fs.writeFileSync(clipsFile, JSON.stringify(clips, null, 2));
        fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
        
        console.log('✅ Clips y estadísticas guardados');
        return true;
    } catch (error) {
        console.error('❌ Error guardando clips:', error);
        return false;
    }
}

// Cargar clips al iniciar
loadClips();

// ==================== ENDPOINTS MONGODB ====================

// Obtener todos los equipos
app.get('/api/teams', async (req, res) => {
    try {
        const teams = await Team.find().sort({ name: 1 });
        res.json(teams);
    } catch (error) {
        console.error('❌ Error obteniendo equipos:', error);
        res.status(500).json({ error: 'Error obteniendo equipos' });
    }
});

// Crear equipo
app.post('/api/teams', uploadImage.single('teamLogo'), async (req, res) => {
    try {
        const { name, founded, stadium } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'El nombre del equipo es requerido' });
        }
        
        // Verificar que no exista
        const existingTeam = await Team.findOne({ name: new RegExp(`^${name}$`, 'i') });
        if (existingTeam) {
            return res.status(400).json({ error: 'Ya existe un equipo con ese nombre' });
        }
        
        let logoUrl = 'img/default-team.png';
        
        // Subir logo a Cloudinary si se proporcionó
        if (req.file) {
            try {
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
            } catch (error) {
                console.warn('⚠️ Error subiendo logo:', error);
            }
        }
        
        // Crear equipo en MongoDB
        const newTeam = new Team({
            name: name.trim(),
            founded: founded ? parseInt(founded) : new Date().getFullYear(),
            stadium: stadium ? stadium.trim() : '',
            logo: logoUrl
        });
        
        await newTeam.save();
        
        // Crear club asociado
        const newClub = new Club({
            name: newTeam.name,
            founded: newTeam.founded,
            stadium: newTeam.stadium,
            logo: newTeam.logo,
            players: 0
        });
        
        await newClub.save();
        
        console.log('✅ Equipo creado:', newTeam.name);
        
        res.status(201).json({
            success: true,
            team: newTeam,
            club: newClub,
            message: `Equipo "${newTeam.name}" creado exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error creando equipo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar equipo
app.delete('/api/teams/:id', async (req, res) => {
    try {
        const teamId = req.params.id;
        
        const deletedTeam = await Team.findByIdAndDelete(teamId);
        if (!deletedTeam) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }
        
        // Eliminar jugadores asociados
        await Player.deleteMany({ team: teamId });
        
        // Eliminar club asociado
        await Club.findOneAndDelete({ name: deletedTeam.name });
        
        // Eliminar partidos asociados
        await Match.deleteMany({ 
            $or: [{ homeTeam: teamId }, { awayTeam: teamId }] 
        });
        
        console.log(`✅ Equipo "${deletedTeam.name}" eliminado`);
        
        res.json({ 
            success: true, 
            message: `Equipo "${deletedTeam.name}" eliminado exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error eliminando equipo:', error);
        res.status(500).json({ error: 'Error eliminando equipo' });
    }
});

// Obtener todos los clubes
app.get('/api/clubs', async (req, res) => {
    try {
        const clubs = await Club.find().sort({ name: 1 });
        res.json(clubs);
    } catch (error) {
        console.error('❌ Error obteniendo clubes:', error);
        res.status(500).json({ error: 'Error obteniendo clubes' });
    }
});

// Eliminar club
app.delete('/api/clubs/:id', async (req, res) => {
    try {
        const clubId = req.params.id;
        
        const deletedClub = await Club.findByIdAndDelete(clubId);
        if (!deletedClub) {
            return res.status(404).json({ error: 'Club no encontrado' });
        }
        
        console.log(`✅ Club "${deletedClub.name}" eliminado`);
        
        res.json({ 
            success: true, 
            message: `Club "${deletedClub.name}" eliminado exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error eliminando club:', error);
        res.status(500).json({ error: 'Error eliminando club' });
    }
});

// Obtener todos los jugadores
app.get('/api/players', async (req, res) => {
    try {
        const players = await Player.find().populate('team').sort({ name: 1 });
        res.json(players);
    } catch (error) {
        console.error('❌ Error obteniendo jugadores:', error);
        res.status(500).json({ error: 'Error obteniendo jugadores' });
    }
});

// Crear jugador
app.post('/api/players', async (req, res) => {
    try {
        const { name, position, number, clubName } = req.body;
        
        if (!name || !position || !number || !clubName) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        
        // Buscar el equipo/club
        const team = await Team.findOne({ name: clubName });
        if (!team) {
            return res.status(400).json({ error: 'Club no encontrado' });
        }
        
        // Crear jugador
        const newPlayer = new Player({
            name: name.trim(),
            position: position.trim(),
            number: parseInt(number),
            team: team._id,
            clubName: clubName
        });
        
        await newPlayer.save();
        
        // Actualizar contador de jugadores en el club
        await Club.findOneAndUpdate(
            { name: clubName },
            { $inc: { players: 1 } }
        );
        
        console.log('✅ Jugador creado:', newPlayer.name);
        
        res.status(201).json({
            success: true,
            player: newPlayer,
            message: `Jugador "${newPlayer.name}" creado exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error creando jugador:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Limpieza completa de MongoDB
app.delete('/api/admin/cleanup/all', async (req, res) => {
    try {
        console.log('🧹 Limpieza completa de MongoDB...');
        
        const teamsResult = await Team.deleteMany({});
        const clubsResult = await Club.deleteMany({});
        const playersResult = await Player.deleteMany({});
        const matchesResult = await Match.deleteMany({});
        
        const totalDeleted = teamsResult.deletedCount + clubsResult.deletedCount + 
                           playersResult.deletedCount + matchesResult.deletedCount;
        
        console.log(`✅ Limpieza completa: ${totalDeleted} registros eliminados`);
        
        res.json({ 
            success: true, 
            message: `Limpieza completa: ${totalDeleted} registros eliminados`,
            details: {
                teams: teamsResult.deletedCount,
                clubs: clubsResult.deletedCount,
                players: playersResult.deletedCount,
                matches: matchesResult.deletedCount,
                total: totalDeleted
            }
        });
    } catch (error) {
        console.error('❌ Error en limpieza:', error);
        res.status(500).json({ error: 'Error en limpieza de MongoDB' });
    }
});

// ==================== ENDPOINTS CLIPS ====================

// Obtener clips
app.get('/api/clips', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type;
    const club = req.query.club;
    
    let filteredClips = clips;
    
    if (type && type !== 'all') {
        filteredClips = filteredClips.filter(clip => clip.type === type);
    }
    
    if (club && club !== 'all') {
        filteredClips = filteredClips.filter(clip => clip.club === club);
    }
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedClips = filteredClips.slice(startIndex, endIndex);
    
    res.json({
        clips: paginatedClips,
        has_more: endIndex < filteredClips.length,
        total: filteredClips.length
    });
});

// Subir clip
app.post('/api/upload', upload.single('clipFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No se subió ningún archivo' });
        }
        
        if (req.file.size > 100 * 1024 * 1024) {
            return res.status(400).json({ success: false, error: 'Archivo demasiado grande (máximo 100MB)' });
        }
        
        const { clipTitle, clipDescription, clipType, clubSelect } = req.body;
        
        if (!clipTitle || !clipDescription || !clipType || !clubSelect) {
            return res.status(400).json({ 
                success: false, 
                error: 'Todos los campos son obligatorios' 
            });
        }
        
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            return res.status(500).json({ 
                success: false, 
                error: 'Cloudinary no está configurado' 
            });
        }
        
        console.log('☁️ Subiendo video a Cloudinary...');
        
        const uploadResult = await new Promise((resolve, reject) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const publicId = `clip-${uniqueSuffix}`;
            
            cloudinary.uploader.upload_stream(
                {
                    resource_type: 'video',
                    public_id: publicId,
                    folder: 'lpcp-clips',
                    quality: 'auto:good',
                    format: 'mp4',
                    timeout: 60000
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
        
        const newClip = {
            id: Date.now().toString(),
            title: clipTitle.trim(),
            description: clipDescription.trim(),
            type: clipType,
            club: clubSelect,
            filename: uploadResult.public_id,
            video_url: uploadResult.secure_url,
            thumbnail_url: uploadResult.secure_url.replace('/video/upload/', '/video/upload/w_640,h_360,c_pad,q_auto:good/'),
            duration: uploadResult.duration || 0,
            format: uploadResult.format || 'mp4',
            file_size: uploadResult.bytes || req.file.size,
            upload_date: new Date().toISOString(),
            views: 0,
            likes: 0,
            liked_by: []
        };
        
        clips.push(newClip);
        
        // Actualizar estadísticas
        stats.total_clips = clips.length;
        stats.total_views = clips.reduce((sum, clip) => sum + clip.views, 0);
        stats.total_likes = clips.reduce((sum, clip) => sum + clip.likes, 0);
        
        // Guardar clips localmente
        saveClips();
        
        // Emitir evento
        io.emit('new_clip', newClip);
        
        console.log(`✅ Clip "${clipTitle}" subido exitosamente`);
        
        res.json({ 
            success: true, 
            clip: newClip,
            message: 'Clip subido exitosamente' 
        });
        
    } catch (error) {
        console.error('❌ Error subiendo clip:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error interno del servidor' 
        });
    }
});

// Eliminar clip
app.delete('/api/clips/:id', async (req, res) => {
    try {
        const clipId = req.params.id;
        const clipIndex = clips.findIndex(c => c.id === clipId);
        
        if (clipIndex === -1) {
            return res.status(404).json({ success: false, error: 'Clip no encontrado' });
        }
        
        const clip = clips[clipIndex];
        
        // Eliminar de Cloudinary
        if (clip.filename) {
            try {
                await cloudinary.uploader.destroy(clip.filename, { resource_type: 'video' });
                console.log('✅ Video eliminado de Cloudinary');
            } catch (error) {
                console.warn('⚠️ Error eliminando de Cloudinary:', error);
            }
        }
        
        // Eliminar del array
        clips.splice(clipIndex, 1);
        
        // Actualizar estadísticas
        stats.total_clips = clips.length;
        stats.total_views = clips.reduce((sum, clip) => sum + clip.views, 0);
        stats.total_likes = clips.reduce((sum, clip) => sum + clip.likes, 0);
        
        // Guardar cambios
        saveClips();
        
        // Emitir evento
        io.emit('clip_deleted', clipId);
        
        res.json({ success: true, message: 'Clip eliminado exitosamente' });
        
    } catch (error) {
        console.error('❌ Error eliminando clip:', error);
        res.status(500).json({ success: false, error: 'Error eliminando clip' });
    }
});

// Obtener estadísticas
app.get('/api/stats', (req, res) => {
    res.json(stats);
});

// ==================== RUTAS HTML ====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin.html', (req, res) => {
    res.redirect('/login.html');
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/admin-panel.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/clips.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'clips.html'));
});

app.get('/jugadores.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'jugadores.html'));
});

// ==================== WEBSOCKETS ====================
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    
    socket.emit('statsUpdate', stats);
    
    socket.on('classificationZonesChanged', (zones) => {
        console.log('📡 Recibido evento classificationZonesChanged, broadcasting a todos los clientes');
        socket.broadcast.emit('classificationZonesUpdate', zones);
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

// ==================== CLASSIFICATION ZONES ENDPOINTS ====================

// Modelo de Zonas de Clasificación para MongoDB
const classificationZoneSchema = new mongoose.Schema({
    name: { type: String, required: true },
    color: { type: String, required: true },
    startPosition: { type: Number, required: true },
    endPosition: { type: Number, required: true },
    description: { type: String, required: true }
});

const ClassificationZone = mongoose.model('ClassificationZone', classificationZoneSchema);

// GET - Obtener zonas de clasificación
app.get('/api/classification-zones', async (req, res) => {
    try {
        let zones = await ClassificationZone.find().sort({ startPosition: 1 });
        
        // Si no hay zonas en MongoDB, crear las por defecto
        if (zones.length === 0) {
            const defaultZones = [
                { name: 'Clasificación Directa', color: '#00ff88', startPosition: 1, endPosition: 4, description: 'Clasifican directamente a playoffs' },
                { name: 'Repechaje', color: '#ffa502', startPosition: 5, endPosition: 8, description: 'Juegan repechaje para playoffs' },
                { name: 'Eliminados', color: '#ff4757', startPosition: 9, endPosition: 12, description: 'No clasifican a playoffs' }
            ];
            
            zones = await ClassificationZone.insertMany(defaultZones);
            console.log('✅ Zonas de clasificación por defecto creadas en MongoDB');
        }
        
        console.log('🏆 Datos cargados:', zones.length);
        res.json(zones);
        
    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        res.status(500).json({ error: 'Error cargando datos' });
    }
});

// PUT - Actualizar zonas de clasificación
app.put('/api/classification-zones', async (req, res) => {
    try {
        const { zones } = req.body;
        
        if (!zones || !Array.isArray(zones)) {
            return res.status(400).json({ error: 'Se requiere un array de zonas' });
        }
        
        console.log('🏆 Actualizando zonas de clasificación:', zones.length);
        
        // Eliminar zonas existentes
        await ClassificationZone.deleteMany({});
        
        // Crear nuevas zonas
        const savedZones = await ClassificationZone.insertMany(zones);
        
        console.log('✅ Zonas de clasificación actualizadas exitosamente');
        
        // Emitir evento WebSocket para actualizar frontend en tiempo real
        io.emit('classificationZonesUpdated', savedZones);
        
        res.json({ success: true, zones: savedZones });
        
    } catch (error) {
        console.error('❌ Error actualizando zonas de clasificación:', error);
        res.status(500).json({ error: 'Error actualizando zonas de clasificación' });
    }
});

// ==================== PLAYOFFS ENDPOINTS ====================

// Modelo de Bracket para MongoDB
const bracketSchema = new mongoose.Schema({
    format: { type: Number, required: true }, // 4, 8, 16
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    isRoundTrip: { type: Boolean, default: false }, // Nueva opción ida y vuelta
    matches: [{
        round: String, // 'semifinal', 'final', etc.
        homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
        awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
        homeScore: { type: Number, default: null },
        awayScore: { type: Number, default: null },
        status: { type: String, default: 'scheduled' }, // 'scheduled', 'finished'
        isFirstLeg: { type: Boolean, default: true }, // Para ida y vuelta
        legNumber: { type: Number, default: 1 }, // 1 para ida, 2 para vuelta
        date: Date
    }],
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Bracket = mongoose.model('Bracket', bracketSchema);

// GET - Obtener bracket actual
app.get('/api/playoffs/bracket', async (req, res) => {
    try {
        const bracket = await Bracket.findOne().sort({ createdAt: -1 }).populate('teams matches.homeTeam matches.awayTeam winner');
        
        if (!bracket) {
            return res.json({ bracket: null, message: 'No hay bracket generado' });
        }
        
        console.log('🏆 Bracket cargado:', {
            format: bracket.format,
            teams: bracket.teams.length,
            matches: bracket.matches.length,
            isRoundTrip: bracket.isRoundTrip
        });
        
        res.json({ bracket });
    } catch (error) {
        console.error('❌ Error cargando bracket:', error);
        res.status(500).json({ error: 'Error cargando bracket' });
    }
});

// POST - Crear nuevo bracket
app.post('/api/playoffs/bracket', async (req, res) => {
    try {
        const { format, selectedTeams, customPairings, isRoundTrip = false } = req.body;
        
        console.log('🏆 Creando bracket:', { format, teams: selectedTeams?.length, isRoundTrip, customPairings: !!customPairings });
        
        // Validaciones
        if (!format || ![4, 8, 16].includes(parseInt(format))) {
            return res.status(400).json({ error: 'Formato inválido. Debe ser 4, 8 o 16' });
        }
        
        if (!selectedTeams || selectedTeams.length !== parseInt(format)) {
            return res.status(400).json({ error: `Se requieren exactamente ${format} equipos` });
        }
        
        // Obtener equipos de la base de datos
        const teamIds = selectedTeams.map(team => team._id || team.id);
        const teams = await Team.find({ _id: { $in: teamIds } });
        
        if (teams.length !== parseInt(format)) {
            return res.status(400).json({ error: 'Algunos equipos no fueron encontrados' });
        }
        
        // Generar partidos según el formato
        const matches = generateBracketMatches(teams, parseInt(format), customPairings, isRoundTrip);
        
        // Crear bracket en MongoDB
        const bracket = new Bracket({
            format: parseInt(format),
            teams: teamIds,
            isRoundTrip,
            matches
        });
        
        await bracket.save();
        
        // Poblar datos para respuesta
        await bracket.populate('teams matches.homeTeam matches.awayTeam');
        
        console.log('✅ Bracket creado exitosamente:', {
            id: bracket._id,
            format: bracket.format,
            teams: bracket.teams.length,
            matches: bracket.matches.length,
            isRoundTrip: bracket.isRoundTrip
        });
        
        // Emitir evento WebSocket
        io.emit('bracketCreated', { bracket });
        
        res.json({ 
            success: true, 
            bracket,
            message: `Bracket de ${format} equipos creado ${isRoundTrip ? 'con modalidad ida y vuelta' : 'con partidos únicos'}` 
        });
        
    } catch (error) {
        console.error('❌ Error creando bracket:', error);
        res.status(500).json({ error: 'Error creando bracket' });
    }
});

// Función para generar partidos del bracket
function generateBracketMatches(teams, format, customPairings, isRoundTrip) {
    const matches = [];
    let matchDate = new Date();
    matchDate.setDate(matchDate.getDate() + 7); // Empezar en una semana
    
    if (format === 4) {
        // Semifinales
        const pairs = customPairings || [
            [teams[0], teams[3]],
            [teams[1], teams[2]]
        ];
        
        pairs.forEach((pair, index) => {
            if (isRoundTrip) {
                // Partido de ida
                matches.push({
                    round: 'semifinal',
                    homeTeam: pair[0]._id,
                    awayTeam: pair[1]._id,
                    isFirstLeg: true,
                    legNumber: 1,
                    date: new Date(matchDate.getTime() + (index * 24 * 60 * 60 * 1000))
                });
                
                // Partido de vuelta
                matches.push({
                    round: 'semifinal',
                    homeTeam: pair[1]._id, // Intercambiar local y visitante
                    awayTeam: pair[0]._id,
                    isFirstLeg: false,
                    legNumber: 2,
                    date: new Date(matchDate.getTime() + ((index + 2) * 24 * 60 * 60 * 1000))
                });
            } else {
                // Partido único
                matches.push({
                    round: 'semifinal',
                    homeTeam: pair[0]._id,
                    awayTeam: pair[1]._id,
                    isFirstLeg: true,
                    legNumber: 1,
                    date: new Date(matchDate.getTime() + (index * 24 * 60 * 60 * 1000))
                });
            }
        });
        
        // Final (se generará cuando se completen las semifinales)
        
    } else if (format === 8) {
        // Cuartos de final
        const pairs = customPairings || [
            [teams[0], teams[7]],
            [teams[1], teams[6]],
            [teams[2], teams[5]],
            [teams[3], teams[4]]
        ];
        
        pairs.forEach((pair, index) => {
            if (isRoundTrip) {
                matches.push({
                    round: 'quarterfinal',
                    homeTeam: pair[0]._id,
                    awayTeam: pair[1]._id,
                    isFirstLeg: true,
                    legNumber: 1,
                    date: new Date(matchDate.getTime() + (index * 24 * 60 * 60 * 1000))
                });
                
                matches.push({
                    round: 'quarterfinal',
                    homeTeam: pair[1]._id,
                    awayTeam: pair[0]._id,
                    isFirstLeg: false,
                    legNumber: 2,
                    date: new Date(matchDate.getTime() + ((index + 4) * 24 * 60 * 60 * 1000))
                });
            } else {
                matches.push({
                    round: 'quarterfinal',
                    homeTeam: pair[0]._id,
                    awayTeam: pair[1]._id,
                    isFirstLeg: true,
                    legNumber: 1,
                    date: new Date(matchDate.getTime() + (index * 24 * 60 * 60 * 1000))
                });
            }
        });
        
    } else if (format === 16) {
        // Octavos de final
        const pairs = customPairings || [
            [teams[0], teams[15]], [teams[1], teams[14]], [teams[2], teams[13]], [teams[3], teams[12]],
            [teams[4], teams[11]], [teams[5], teams[10]], [teams[6], teams[9]], [teams[7], teams[8]]
        ];
        
        pairs.forEach((pair, index) => {
            if (isRoundTrip) {
                matches.push({
                    round: 'round16',
                    homeTeam: pair[0]._id,
                    awayTeam: pair[1]._id,
                    isFirstLeg: true,
                    legNumber: 1,
                    date: new Date(matchDate.getTime() + (index * 24 * 60 * 60 * 1000))
                });
                
                matches.push({
                    round: 'round16',
                    homeTeam: pair[1]._id,
                    awayTeam: pair[0]._id,
                    isFirstLeg: false,
                    legNumber: 2,
                    date: new Date(matchDate.getTime() + ((index + 8) * 24 * 60 * 60 * 1000))
                });
            } else {
                matches.push({
                    round: 'round16',
                    homeTeam: pair[0]._id,
                    awayTeam: pair[1]._id,
                    isFirstLeg: true,
                    legNumber: 1,
                    date: new Date(matchDate.getTime() + (index * 24 * 60 * 60 * 1000))
                });
            }
        });
    }
    
    return matches;
}

// ==================== FUNCIONES AUXILIARES ====================

// Función para calcular tabla de posiciones
async function calculateStandings() {
    try {
        const teams = await Team.find();
        const matches = await Match.find({ status: 'finished' });
        
        const standings = teams.map(team => {
            const teamMatches = matches.filter(m => 
                m.homeTeam === team.name || m.awayTeam === team.name
            );
            
            let points = 0;
            let played = 0;
            let won = 0;
            let drawn = 0;
            let lost = 0;
            let goalsFor = 0;
            let goalsAgainst = 0;
            
            teamMatches.forEach(match => {
                played++;
                
                if (match.homeTeam === team.name) {
                    goalsFor += match.homeScore || 0;
                    goalsAgainst += match.awayScore || 0;
                    
                    if (match.homeScore > match.awayScore) {
                        won++;
                        points += 3;
                    } else if (match.homeScore === match.awayScore) {
                        drawn++;
                        points += 1;
                    } else {
                        lost++;
                    }
                } else {
                    goalsFor += match.awayScore || 0;
                    goalsAgainst += match.homeScore || 0;
                    
                    if (match.awayScore > match.homeScore) {
                        won++;
                        points += 3;
                    } else if (match.awayScore === match.homeScore) {
                        drawn++;
                        points += 1;
                    } else {
                        lost++;
                    }
                }
            });
            
            return {
                team: team,
                points: points,
                played: played,
                won: won,
                drawn: drawn,
                lost: lost,
                goalsFor: goalsFor,
                goalsAgainst: goalsAgainst,
                goalDifference: goalsFor - goalsAgainst
            };
        });
        
        // Ordenar por puntos, diferencia de goles, goles a favor
        standings.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            return b.goalsFor - a.goalsFor;
        });
        
        return standings;
        
    } catch (error) {
        console.error('❌ Error calculando tabla de posiciones:', error);
        return [];
    }
}

// ==================== ENDPOINTS PLAYOFFS ====================

// GET - Obtener bracket actual
app.get('/api/playoffs/bracket', async (req, res) => {
    try {
        const bracket = await Bracket.findOne().populate('matches.homeTeam matches.awayTeam').sort({ createdAt: -1 });
        
        if (!bracket) {
            return res.status(404).json({ error: 'No hay bracket generado' });
        }
        
        console.log('✅ Bracket cargado:', {
            format: bracket.format,
            isRoundTrip: bracket.isRoundTrip,
            matches: bracket.matches.length
        });
        
        res.json({ bracket });
        
    } catch (error) {
        console.error('❌ Error obteniendo bracket:', error);
        res.status(500).json({ error: 'Error obteniendo bracket' });
    }
});

// POST - Crear nuevo bracket
app.post('/api/playoffs/bracket', async (req, res) => {
    try {
        const { format, teams, isRoundTrip = false, type = 'automatic' } = req.body;
        
        console.log('🏆 Creando bracket:', { format, isRoundTrip, type, teamsCount: teams?.length });
        
        // Validar formato
        const validFormats = [4, 8, 16];
        if (!validFormats.includes(format)) {
            return res.status(400).json({ error: `Formato inválido: ${format}. Debe ser 4, 8 o 16 equipos.` });
        }
        
        let selectedTeams;
        
        if (type === 'custom' && teams && teams.length > 0) {
            // Bracket personalizado con equipos seleccionados
            if (teams.length !== format) {
                return res.status(400).json({ error: `Número de equipos (${teams.length}) no coincide con el formato (${format})` });
            }
            
            // Obtener equipos completos desde MongoDB
            const teamIds = teams.map(t => t.id || t._id);
            selectedTeams = await Team.find({ _id: { $in: teamIds } });
            
            if (selectedTeams.length !== format) {
                return res.status(400).json({ error: 'Algunos equipos seleccionados no existen' });
            }
            
        } else {
            // Bracket automático basado en tabla de posiciones
            const standings = await calculateStandings();
            
            if (standings.length < format) {
                return res.status(400).json({ error: `No hay suficientes equipos (${standings.length}) para el formato ${format}` });
            }
            
            // Tomar los mejores equipos según la tabla
            selectedTeams = standings.slice(0, format).map(s => s.team);
        }
        
        // Eliminar bracket anterior si existe
        await Bracket.deleteMany({});
        
        // Generar partidos
        const matches = generatePlayoffMatches(selectedTeams, format, isRoundTrip);
        
        // Crear nuevo bracket
        const newBracket = new Bracket({
            format: format,
            isRoundTrip: isRoundTrip,
            teams: selectedTeams.map(t => t._id),
            matches: matches,
            status: 'active'
        });
        
        await newBracket.save();
        
        // Poblar para respuesta
        await newBracket.populate('matches.homeTeam matches.awayTeam teams');
        
        console.log('✅ Bracket creado exitosamente:', {
            format: newBracket.format,
            isRoundTrip: newBracket.isRoundTrip,
            matches: newBracket.matches.length,
            teams: newBracket.teams.length
        });
        
        // Emitir evento WebSocket
        io.emit('bracketCreated', { bracket: newBracket });
        
        res.status(201).json({ 
            success: true, 
            bracket: newBracket,
            message: `Bracket de ${format} equipos creado exitosamente${isRoundTrip ? ' (ida y vuelta)' : ''}` 
        });
        
    } catch (error) {
        console.error('❌ Error creando bracket:', error);
        res.status(500).json({ error: 'Error creando bracket: ' + error.message });
    }
});

// PUT - Actualizar resultado de partido de playoff
app.put('/api/playoffs/bracket/match/:id', async (req, res) => {
    try {
        const { homeScore, awayScore } = req.body;
        const matchId = req.params.id;
        
        const bracket = await Bracket.findOne({ 'matches._id': matchId }).populate('matches.homeTeam matches.awayTeam');
        
        if (!bracket) {
            return res.status(404).json({ error: 'Partido no encontrado' });
        }
        
        const match = bracket.matches.id(matchId);
        if (!match) {
            return res.status(404).json({ error: 'Partido no encontrado en bracket' });
        }
        
        // Actualizar resultado
        match.homeScore = parseInt(homeScore);
        match.awayScore = parseInt(awayScore);
        match.status = 'finished';
        
        await bracket.save();
        
        console.log('✅ Resultado de playoff actualizado:', {
            match: `${match.homeTeam.name} ${homeScore}-${awayScore} ${match.awayTeam.name}`,
            round: match.round,
            isRoundTrip: bracket.isRoundTrip,
            leg: match.legNumber
        });
        
        // Si es modalidad ida y vuelta, verificar si ambos partidos están terminados
        if (bracket.isRoundTrip) {
            await checkRoundTripAdvancement(bracket, match);
        } else {
            // Avance automático para partidos únicos
            await advanceWinnerToNextRound(bracket, match);
        }
        
        // Emitir evento WebSocket
        io.emit('playoffMatchUpdated', { bracket, match });
        
        res.json({ success: true, bracket, match });
        
    } catch (error) {
        console.error('❌ Error actualizando partido de playoff:', error);
        res.status(500).json({ error: 'Error actualizando partido' });
    }
});

// Función para verificar avance en modalidad ida y vuelta
async function checkRoundTripAdvancement(bracket, completedMatch) {
    // Buscar el partido de vuelta/ida correspondiente
    const relatedMatch = bracket.matches.find(m => 
        m.round === completedMatch.round &&
        m.homeTeam.toString() === completedMatch.awayTeam.toString() &&
        m.awayTeam.toString() === completedMatch.homeTeam.toString() &&
        m.legNumber !== completedMatch.legNumber
    );
    
    // Si ambos partidos están terminados, determinar ganador por marcador global
    if (relatedMatch && relatedMatch.status === 'finished') {
        const team1Goals = completedMatch.homeScore + relatedMatch.awayScore;
        const team2Goals = completedMatch.awayScore + relatedMatch.homeScore;
        
        let winner;
        if (team1Goals > team2Goals) {
            winner = completedMatch.homeTeam;
        } else if (team2Goals > team1Goals) {
            winner = completedMatch.awayTeam;
        } else {
            // En caso de empate, gana quien hizo más goles de visitante
            const team1AwayGoals = relatedMatch.awayScore;
            const team2AwayGoals = completedMatch.awayScore;
            
            if (team1AwayGoals > team2AwayGoals) {
                winner = completedMatch.homeTeam;
            } else {
                winner = completedMatch.awayTeam;
            }
        }
        
        console.log('🏆 Ganador ida y vuelta determinado:', {
            winner: winner.name,
            globalScore: `${team1Goals}-${team2Goals}`,
            round: completedMatch.round
        });
        
        // Avanzar ganador a siguiente ronda
        await advanceWinnerToNextRound(bracket, completedMatch, winner);
    }
}

// Función para avanzar ganador a siguiente ronda
async function advanceWinnerToNextRound(bracket, match, winner = null) {
    if (!winner) {
        // Determinar ganador para partido único
        winner = match.homeScore > match.awayScore ? match.homeTeam : match.awayTeam;
    }
    
    if (match.round === 'semifinal') {
        // Crear o actualizar final
        let finalMatch = bracket.matches.find(m => m.round === 'final');
        
        if (!finalMatch) {
            // Crear final
            const finalDate = new Date();
            finalDate.setDate(finalDate.getDate() + 14);
            
            bracket.matches.push({
                round: 'final',
                homeTeam: winner._id,
                awayTeam: null, // Se llenará cuando termine la otra semifinal
                isFirstLeg: true,
                legNumber: 1,
                date: finalDate
            });
        } else if (!finalMatch.awayTeam) {
            // Completar final con segundo finalista
            finalMatch.awayTeam = winner._id;
            
            // Determinar local según tabla de posiciones
            const standings = await calculateStandings();
            const homeTeamPosition = standings.findIndex(s => s.team.toString() === finalMatch.homeTeam.toString());
            const awayTeamPosition = standings.findIndex(s => s.team.toString() === winner._id.toString());
            
            if (awayTeamPosition < homeTeamPosition) {
                // Intercambiar si el nuevo equipo está mejor posicionado
                const temp = finalMatch.homeTeam;
                finalMatch.homeTeam = winner._id;
                finalMatch.awayTeam = temp;
            }
        }
        
        await bracket.save();
        
        console.log('🏆 Finalista avanzado:', {
            winner: winner.name,
            round: 'final'
        });
    }
    
    // Agregar lógica similar para cuartos -> semifinales y octavos -> cuartos si es necesario
}

// ==================== INICIAR SERVIDOR ====================
console.log('🚀 Iniciando servidor LPCP limpio...');
console.log('💾 MongoDB: Equipos, jugadores, clubes, partidos, playoffs');
console.log('🎥 Cloudinary: Videos de clips');
console.log('📝 Archivos locales: Solo metadatos de clips');

server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Panel admin: http://localhost:${PORT}/admin.html`);
    console.log(`🌐 Sitio web: http://localhost:${PORT}`);
});
