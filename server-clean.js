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

// Debug: Verificar configuración de Cloudinary
console.log('🔧 Configuración Cloudinary:');
console.log('  - Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Configurado' : '❌ No configurado');
console.log('  - API Key:', process.env.CLOUDINARY_API_KEY ? '✅ Configurado' : '❌ No configurado');
console.log('  - API Secret:', process.env.CLOUDINARY_API_SECRET ? '✅ Configurado' : '❌ No configurado');

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
    logo: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

const PlayerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    position: { type: String, required: true },
    number: { type: Number, required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    clubName: { type: String, required: true },
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    age: { type: Number, default: null },
    nationality: { type: String, default: '' },
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
    matchday: { type: Number, default: 1 },
    status: { type: String, enum: ['scheduled', 'live', 'finished'], default: 'scheduled' },
    round: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const TournamentSettingsSchema = new mongoose.Schema({
    seasonName: { type: String, default: 'Temporada 2025' },
    pointsWin: { type: Number, default: 3 },
    pointsDraw: { type: Number, default: 1 },
    pointsLoss: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const SettingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now }
});

// Crear modelos
const Team = mongoose.model('Team', TeamSchema);
const Player = mongoose.model('Player', PlayerSchema);
const Club = mongoose.model('Club', ClubSchema);
const Match = mongoose.model('Match', MatchSchema);
const TournamentSettings = mongoose.model('TournamentSettings', TournamentSettingsSchema);
const Settings = mongoose.model('Settings', SettingsSchema);

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

// ==================== MATCHES ENDPOINTS ====================

// Obtener todos los partidos
app.get('/api/matches', async (req, res) => {
    try {
        const matches = await Match.find().sort({ date: 1 });
        res.json(matches);
    } catch (error) {
        console.error('❌ Error obteniendo partidos:', error);
        res.status(500).json({ error: 'Error obteniendo partidos' });
    }
});

// Crear partido
app.post('/api/matches', async (req, res) => {
    try {
        const { homeTeam, awayTeam, date, time, matchday } = req.body;
        
        if (!homeTeam || !awayTeam || !date || !time) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        
        if (homeTeam === awayTeam) {
            return res.status(400).json({ error: 'Un equipo no puede jugar contra sí mismo' });
        }
        
        // Combinar fecha y hora
        const matchDateTime = new Date(`${date}T${time}:00`);
        
        // Crear partido
        const newMatch = new Match({
            homeTeam,
            awayTeam,
            date: matchDateTime,
            matchday: matchday || 1,
            status: 'scheduled'
        });
        
        await newMatch.save();
        
        console.log('✅ Partido creado:', `${homeTeam} vs ${awayTeam}`);
        
        // Emitir eventos WebSocket para actualización en tiempo real
        io.emit('matchesUpdate', await Match.find().sort({ date: 1 }));
        io.emit('matchCreated', newMatch);
        
        res.status(201).json({
            success: true,
            match: newMatch,
            message: `Partido "${homeTeam} vs ${awayTeam}" creado exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error creando partido:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

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

// Obtener equipos para dropdown (solo ID y nombre)
app.get('/api/teams/dropdown', async (req, res) => {
    try {
        const teams = await Team.find({}, 'name').sort({ name: 1 });
        const teamsForDropdown = teams.map(team => ({
            id: team._id,
            name: team.name
        }));
        res.json(teamsForDropdown);
    } catch (error) {
        console.error('❌ Error obteniendo equipos para dropdown:', error);
        res.status(500).json({ error: 'Error obteniendo equipos' });
    }
});

// Crear equipo
app.post('/api/teams', uploadImage.single('logo'), async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'El nombre del equipo es requerido' });
        }
        
        // Verificar si ya existe un equipo con ese nombre
        const existingTeam = await Team.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingTeam) {
            return res.status(400).json({ error: 'Ya existe un equipo con ese nombre' });
        }
        
        let logoUrl = null;
        
        // Procesar logo si se subió
        if (req.file) {
            console.log('📁 Procesando archivo:', {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            });
            
            if (cloudinary.config().cloud_name) {
                try {
                    console.log('☁️ Subiendo imagen a Cloudinary...');
                    
                    // Convertir buffer a base64 para Cloudinary
                    const b64 = Buffer.from(req.file.buffer).toString('base64');
                    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
                    
                    const result = await cloudinary.uploader.upload(dataURI, {
                        folder: 'lpcp/teams',
                        public_id: `team_${Date.now()}`,
                        overwrite: true,
                        resource_type: 'image'
                    });
                    
                    logoUrl = result.secure_url;
                    console.log('✅ Logo subido exitosamente a Cloudinary:', logoUrl);
                    
                } catch (cloudinaryError) {
                    console.error('❌ Error detallado subiendo a Cloudinary:');
                    console.error('  - Mensaje:', cloudinaryError.message);
                    console.error('  - Código:', cloudinaryError.http_code);
                    console.error('  - Error completo:', cloudinaryError);
                    
                    // Devolver error específico al frontend
                    return res.status(500).json({ 
                        error: 'Error subiendo imagen a Cloudinary: ' + cloudinaryError.message,
                        details: 'Verifica la configuración de Cloudinary en las variables de entorno'
                    });
                }
            } else {
                console.warn('⚠️ Cloudinary no configurado correctamente');
                return res.status(500).json({ 
                    error: 'Cloudinary no está configurado',
                    details: 'Faltan variables de entorno: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET'
                });
            }
        }
        
        // Crear equipo en MongoDB
        const newTeam = new Team({
            name,
            logo: logoUrl,
            createdAt: new Date()
        });
        
        await newTeam.save();
        
        console.log('✅ Equipo creado:', newTeam.name);
        
        // Emitir eventos WebSocket para actualización en tiempo real
        io.emit('teamsUpdate', await Team.find().sort({ name: 1 }));
        io.emit('teamCreated', newTeam);
        
        res.status(201).json({
            success: true,
            team: newTeam,
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
        console.log('🗑️ Eliminando equipo con ID:', teamId);
        
        // Buscar el equipo
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }
        
        console.log('🔍 Equipo encontrado:', team.name);
        
        // Eliminar jugadores del equipo
        const deletedPlayers = await Player.deleteMany({ team: teamId });
        console.log(`🗑️ Eliminados ${deletedPlayers.deletedCount} jugadores del equipo`);
        
        // Eliminar partidos donde participa el equipo
        const deletedMatches = await Match.deleteMany({
            $or: [
                { homeTeam: teamId },
                { awayTeam: teamId }
            ]
        });
        console.log(`🗑️ Eliminados ${deletedMatches.deletedCount} partidos del equipo`);
        
        // Finalmente eliminar el equipo
        await Team.findByIdAndDelete(teamId);
        console.log('✅ Equipo eliminado exitosamente');
        
        // Emitir eventos WebSocket para actualización en tiempo real
        io.emit('teamsUpdate', await Team.find().sort({ name: 1 }));
        io.emit('teamDeleted', teamId);
        io.emit('playersUpdate', await Player.find().populate('team'));
        io.emit('matchesUpdate', await Match.find().sort({ date: 1 }));
        
        res.json({
            success: true,
            message: `Equipo "${team.name}" eliminado exitosamente`,
            deletedPlayers: deletedPlayers.deletedCount,
            deletedMatches: deletedMatches.deletedCount
        });
        
    } catch (error) {
        console.error('❌ Error eliminando equipo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
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

// Crear club
app.post('/api/clubs', uploadImage.single('logo'), async (req, res) => {
    try {
        const { name, description, founded, players } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'El nombre del club es requerido' });
        }
        
        // Verificar si ya existe un club con ese nombre
        const existingClub = await Club.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingClub) {
            return res.status(400).json({ error: 'Ya existe un club con ese nombre' });
        }
        
        let logoUrl = null;
        
        // Procesar logo si se subió
        if (req.file) {
            if (cloudinary.config().cloud_name) {
                try {
                    const result = await cloudinary.uploader.upload(req.file.path, {
                        folder: 'lpcp/clubs',
                        public_id: `club_${Date.now()}`,
                        overwrite: true
                    });
                    logoUrl = result.secure_url;
                    console.log('✅ Logo de club subido a Cloudinary:', logoUrl);
                } catch (cloudinaryError) {
                    console.error('❌ Error subiendo logo de club a Cloudinary:', cloudinaryError);
                    logoUrl = `/uploads/${req.file.filename}`;
                }
            } else {
                logoUrl = `/uploads/${req.file.filename}`;
            }
        }
        
        // Crear club en MongoDB
        const newClub = new Club({
            name,
            description: description || `Club ${name}`,
            founded: founded ? parseInt(founded) : new Date().getFullYear(),
            players: players ? parseInt(players) : 0,
            logo: logoUrl
        });
        
        await newClub.save();
        
        console.log('✅ Club creado:', newClub.name);
        
        // Emitir eventos WebSocket para actualización en tiempo real
        io.emit('clubsUpdate', await Club.find().sort({ name: 1 }));
        io.emit('clubCreated', newClub);
        
        res.status(201).json({
            success: true,
            club: newClub,
            message: 'Club creado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error creando club:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
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
        
        // Emitir eventos WebSocket para actualización en tiempo real
        io.emit('clubsUpdate', await Club.find().sort({ name: 1 }));
        io.emit('clubDeleted', clubId);
        
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
        const { name, position, number, clubName, teamId } = req.body;
        
        if (!name || !position || !number || (!clubName && !teamId)) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        
        let team;
        
        // Buscar el equipo por ID o por nombre (más flexible)
        if (teamId) {
            team = await Team.findById(teamId);
        } else if (clubName) {
            // Buscar por nombre exacto o similar
            team = await Team.findOne({ 
                $or: [
                    { name: clubName },
                    { name: new RegExp(`^${clubName}$`, 'i') }
                ]
            });
        }
        
        if (!team) {
            console.log('❌ Equipo no encontrado. Datos recibidos:', { teamId, clubName });
            const availableTeams = await Team.find({}, 'name').sort({ name: 1 });
            console.log('ℹ️ Equipos disponibles:', availableTeams.map(t => t.name));
            return res.status(400).json({ 
                error: 'Equipo no encontrado', 
                availableTeams: availableTeams.map(t => ({ id: t._id, name: t.name }))
            });
        }
        
        // Verificar que el número no esté ocupado en el mismo equipo
        const existingPlayer = await Player.findOne({ 
            team: team._id, 
            number: parseInt(number) 
        });
        
        if (existingPlayer) {
            return res.status(400).json({ 
                error: `El número ${number} ya está ocupado por ${existingPlayer.name}` 
            });
        }
        
        // Crear jugador
        const newPlayer = new Player({
            name: name.trim(),
            position: position.trim(),
            number: parseInt(number),
            team: team._id,
            clubName: team.name // Usar el nombre real del equipo
        });
        
        await newPlayer.save();
        
        // Actualizar contador de jugadores en el club
        await Club.findOneAndUpdate(
            { name: team.name },
            { $inc: { players: 1 } }
        );
        
        console.log(`✅ Jugador creado: ${newPlayer.name} (#${newPlayer.number}) - ${team.name}`);
        
        // Emitir eventos WebSocket para actualización en tiempo real
        const populatedPlayer = await Player.findById(newPlayer._id).populate('team');
        io.emit('playersUpdate', await Player.find().populate('team'));
        io.emit('playerCreated', populatedPlayer);
        
        res.status(201).json({
            success: true,
            player: newPlayer,
            team: team,
            message: `Jugador "${newPlayer.name}" creado exitosamente en ${team.name}`
        });
        
    } catch (error) {
        console.error('❌ Error creando jugador:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Actualizar jugador
app.put('/api/players/:id', async (req, res) => {
    try {
        const playerId = req.params.id;
        const updates = req.body;
        
        console.log('🔄 Actualizando jugador:', playerId, updates);
        
        // Buscar jugador por ID (flexible con string/ObjectId)
        const player = await Player.findById(playerId);
        if (!player) {
            console.error('❌ Jugador no encontrado con ID:', playerId);
            return res.status(404).json({ error: 'Jugador no encontrado' });
        }
        
        // Actualizar campos permitidos
        const allowedFields = ['name', 'position', 'number', 'goals', 'assists', 'age', 'nationality'];
        const updateData = {};
        
        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        });
        
        // Validar número único si se está actualizando
        if (updates.number && updates.number !== player.number) {
            const existingPlayer = await Player.findOne({ 
                team: player.team, 
                number: parseInt(updates.number),
                _id: { $ne: playerId } // Excluir el jugador actual
            });
            
            if (existingPlayer) {
                return res.status(400).json({ 
                    error: `El número ${updates.number} ya está ocupado por ${existingPlayer.name}` 
                });
            }
        }
        
        const updatedPlayer = await Player.findByIdAndUpdate(
            playerId, 
            updateData, 
            { new: true, runValidators: true }
        ).populate('team');
        
        console.log('✅ Jugador actualizado:', updatedPlayer.name);
        
        // Emitir evento WebSocket
        io.emit('playersUpdate', await Player.find().populate('team'));
        io.emit('playerStatsChanged', { playerId, updates: updateData });
        
        res.json({
            success: true,
            player: updatedPlayer,
            message: `Jugador "${updatedPlayer.name}" actualizado exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error actualizando jugador:', error);
        res.status(500).json({ error: 'Error actualizando jugador' });
    }
});

// Eliminar jugador
app.delete('/api/players/:id', async (req, res) => {
    try {
        const playerId = req.params.id;
        
        console.log('🗑️ Eliminando jugador con ID:', playerId);
        
        // Buscar y eliminar jugador
        const deletedPlayer = await Player.findByIdAndDelete(playerId);
        if (!deletedPlayer) {
            console.error('❌ Jugador no encontrado con ID:', playerId);
            return res.status(404).json({ error: 'Jugador no encontrado' });
        }
        
        console.log(`✅ Jugador "${deletedPlayer.name}" eliminado exitosamente`);
        
        // Actualizar contador de jugadores en el club
        if (deletedPlayer.clubName) {
            await Club.findOneAndUpdate(
                { name: deletedPlayer.clubName },
                { $inc: { players: -1 } }
            );
        }
        
        // Emitir evento WebSocket
        io.emit('playersUpdate', await Player.find().populate('team'));
        
        res.json({ 
            success: true, 
            message: `Jugador "${deletedPlayer.name}" eliminado exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error eliminando jugador:', error);
        res.status(500).json({ error: 'Error eliminando jugador' });
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

// ==================== FUNCIÓN DE CÁLCULO DE TABLA DE POSICIONES ====================

async function calculateStandings() {
    try {
        console.log('🏆 Iniciando cálculo de tabla de posiciones...');
        
        // Obtener todos los equipos y partidos terminados
        const teams = await Team.find();
        const finishedMatches = await Match.find({ status: 'finished' });
        
        console.log(`📊 Equipos: ${teams.length}, Partidos terminados: ${finishedMatches.length}`);
        
        // Inicializar estadísticas para cada equipo
        const standings = teams.map(team => ({
            teamId: team._id,
            teamName: team.name,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0
        }));
        
        // Procesar cada partido terminado
        finishedMatches.forEach(match => {
            const homeTeamStats = standings.find(s => s.teamName === match.homeTeam);
            const awayTeamStats = standings.find(s => s.teamName === match.awayTeam);
            
            if (homeTeamStats && awayTeamStats) {
                // Actualizar partidos jugados
                homeTeamStats.played++;
                awayTeamStats.played++;
                
                // Actualizar goles
                homeTeamStats.goalsFor += match.homeScore || 0;
                homeTeamStats.goalsAgainst += match.awayScore || 0;
                awayTeamStats.goalsFor += match.awayScore || 0;
                awayTeamStats.goalsAgainst += match.homeScore || 0;
                
                // Determinar resultado y actualizar estadísticas
                if (match.homeScore > match.awayScore) {
                    // Victoria local
                    homeTeamStats.won++;
                    homeTeamStats.points += 3;
                    awayTeamStats.lost++;
                } else if (match.homeScore < match.awayScore) {
                    // Victoria visitante
                    awayTeamStats.won++;
                    awayTeamStats.points += 3;
                    homeTeamStats.lost++;
                } else {
                    // Empate
                    homeTeamStats.drawn++;
                    homeTeamStats.points += 1;
                    awayTeamStats.drawn++;
                    awayTeamStats.points += 1;
                }
            }
        });
        
        // Calcular diferencia de goles
        standings.forEach(team => {
            team.goalDifference = team.goalsFor - team.goalsAgainst;
        });
        
        // Ordenar tabla por puntos, diferencia de goles, goles a favor
        standings.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            return b.goalsFor - a.goalsFor;
        });
        
        // Agregar posición
        standings.forEach((team, index) => {
            team.position = index + 1;
        });
        
        console.log('✅ Tabla de posiciones calculada:', standings.length, 'equipos');
        
        return standings;
        
    } catch (error) {
        console.error('❌ Error calculando tabla de posiciones:', error);
        return [];
    }
}

// Endpoint para obtener tabla de posiciones
app.get('/api/standings', async (req, res) => {
    try {
        const standings = await calculateStandings();
        res.json(standings);
    } catch (error) {
        console.error('❌ Error obteniendo tabla de posiciones:', error);
        res.status(500).json({ error: 'Error obteniendo tabla de posiciones' });
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

// Obtener configuración del torneo
app.get('/api/settings', (req, res) => {
    res.json({
        seasonName: 'Temporada 2025',
        classificationZones: [
            { id: 1, name: 'Clasificación Directa', positions: '1-4', color: '#00ff88' },
            { id: 2, name: 'Repechaje', positions: '5-8', color: '#ffa500' },
            { id: 3, name: 'Eliminación', positions: '9-12', color: '#ff4757' }
        ]
    });
});

// Endpoint para partidos del torneo (compatibilidad con admin.js)
app.get('/api/tournament/matches', async (req, res) => {
    try {
        const matches = await Match.find().sort({ date: 1 });
        res.json(matches);
    } catch (error) {
        console.error('❌ Error obteniendo partidos:', error);
        res.status(500).json({ error: 'Error obteniendo partidos' });
    }
});

// Crear partido
app.post('/api/matches', async (req, res) => {
    try {
        const { homeTeam, awayTeam, date, round, matchday } = req.body;
        
        if (!homeTeam || !awayTeam || !date) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }
        
        const newMatch = new Match({
            homeTeam,
            awayTeam,
            date: new Date(date),
            round: round || 'Regular',
            matchday: matchday || 1, // Por defecto jornada 1 si no se especifica
            status: 'scheduled'
        });
        
        await newMatch.save();
        
        res.status(201).json({
            success: true,
            match: newMatch,
            message: 'Partido creado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error creando partido:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener todos los partidos
app.get('/api/matches', async (req, res) => {
    try {
        const matches = await Match.find().sort({ date: 1 });
        res.json(matches);
    } catch (error) {
        console.error('❌ Error obteniendo partidos:', error);
        res.status(500).json({ error: 'Error obteniendo partidos' });
    }
});

// Actualizar partido (PUT /api/matches/:id)
app.put('/api/matches/:id', async (req, res) => {
    try {
        const matchId = req.params.id;
        const updates = req.body;
        
        console.log(`🔄 Actualizando partido ${matchId}:`, updates);
        
        const updatedMatch = await Match.findByIdAndUpdate(
            matchId,
            updates,
            { new: true, runValidators: true }
        );
        
        if (!updatedMatch) {
            return res.status(404).json({ error: 'Partido no encontrado' });
        }
        
        console.log(`✅ Partido actualizado: ${updatedMatch.homeTeam} vs ${updatedMatch.awayTeam}`);
        
        // 🏆 CALCULAR TABLA DE POSICIONES AUTOMÁTICAMENTE
        if (updatedMatch.status === 'finished' && updatedMatch.homeScore !== null && updatedMatch.awayScore !== null) {
            console.log('🏆 Calculando tabla de posiciones automáticamente...');
            await calculateStandings();
        }
        
        // Emitir eventos WebSocket para actualización en tiempo real
        io.emit('matchesUpdate', await Match.find().sort({ date: 1 }));
        io.emit('matchUpdated', updatedMatch);
        
        // Emitir actualización de standings si el partido está terminado
        if (updatedMatch.status === 'finished') {
            const standings = await calculateStandings();
            io.emit('standingsUpdate', standings);
        }
        
        res.json({
            success: true,
            match: updatedMatch,
            message: 'Partido actualizado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error actualizando partido:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar partido (DELETE /api/matches/:id)
app.delete('/api/matches/:id', async (req, res) => {
    try {
        const matchId = req.params.id;
        
        console.log(`🗑️ Eliminando partido ${matchId}`);
        
        const deletedMatch = await Match.findByIdAndDelete(matchId);
        
        if (!deletedMatch) {
            return res.status(404).json({ error: 'Partido no encontrado' });
        }
        
        console.log(`✅ Partido eliminado: ${deletedMatch.homeTeam} vs ${deletedMatch.awayTeam}`);
        
        // Emitir eventos WebSocket para actualización en tiempo real
        io.emit('matchesUpdate', await Match.find().sort({ date: 1 }));
        io.emit('matchDeleted', { matchId, match: deletedMatch });
        
        res.json({
            success: true,
            message: `Partido "${deletedMatch.homeTeam} vs ${deletedMatch.awayTeam}" eliminado exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error eliminando partido:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ==================== CONFIGURATION API ====================

// Endpoint para obtener configuración de zonas de clasificación
app.get('/api/settings/classification-zones', async (req, res) => {
    try {
        // Buscar configuración existente en MongoDB
        let savedSettings = await Settings.findOne({ key: 'classificationZones' });
        
        let classificationZones;
        if (savedSettings) {
            classificationZones = savedSettings.value;
            console.log('✅ Zonas de clasificación cargadas desde MongoDB:', classificationZones.length);
        } else {
            // Zonas de clasificación por defecto
            classificationZones = [
                { id: 1, name: 'Clasificación Directa', positions: '1-4', color: '#00ff88' },
                { id: 2, name: 'Repechaje', positions: '5-8', color: '#ffa500' },
                { id: 3, name: 'Eliminación', positions: '9-12', color: '#ff4757' }
            ];
            console.log('⚠️ Usando zonas de clasificación por defecto');
        }
        
        res.json({
            success: true,
            classificationZones: classificationZones
        });
    } catch (error) {
        console.error('Error loading classification zones:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Endpoint para actualizar zonas de clasificación
app.post('/api/settings/classification-zones', async (req, res) => {
    try {
        const { classificationZones } = req.body;
        
        if (!classificationZones || !Array.isArray(classificationZones)) {
            return res.status(400).json({ error: 'Zonas de clasificación inválidas' });
        }
        
        // Validar estructura de cada zona
        for (const zone of classificationZones) {
            if (!zone.name || !zone.positions || !zone.color) {
                return res.status(400).json({ error: 'Estructura de zona inválida' });
            }
        }
        
        // Guardar en MongoDB usando upsert (actualizar si existe, crear si no existe)
        await Settings.findOneAndUpdate(
            { key: 'classificationZones' },
            { 
                key: 'classificationZones',
                value: classificationZones,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );
        
        console.log('✅ Zonas de clasificación guardadas en MongoDB:', classificationZones.length);
        
        // Emitir evento WebSocket para actualización en tiempo real
        io.emit('classificationZonesUpdate', classificationZones);
        
        res.json({ 
            success: true, 
            message: 'Zonas de clasificación guardadas correctamente en la base de datos',
            classificationZones: classificationZones
        });
    } catch (error) {
        console.error('Error saving classification zones to MongoDB:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ==================== PLAYOFFS ENDPOINTS ====================

// Función para generar partidos del bracket con soporte para ida y vuelta
function generateBracketMatches(format, teamNames, customPairings, isRoundTrip = false) {
    const matches = [];
    const numTeams = parseInt(format);
    let matchId = 1;
    
    console.log(`🏆 Generando partidos para ${numTeams} equipos, ida y vuelta: ${isRoundTrip}`);
    
    if (numTeams === 4) {
        // Semifinales
        let pairs;
        if (customPairings && customPairings.length >= 2) {
            pairs = customPairings;
        } else {
            pairs = [
                [teamNames[0], teamNames[3]],
                [teamNames[1], teamNames[2]]
            ];
        }
        
        pairs.forEach((pair, index) => {
            if (isRoundTrip) {
                // Partido de ida
                matches.push({
                    id: `semifinal-${index + 1}-ida`,
                    round: 1, // Semifinal
                    homeTeam: pair[0],
                    awayTeam: pair[1],
                    isFirstLeg: true,
                    legNumber: 1,
                    status: 'scheduled',
                    date: new Date(Date.now() + (index * 24 * 60 * 60 * 1000)) // Espaciar partidos por días
                });
                
                // Partido de vuelta
                matches.push({
                    id: `semifinal-${index + 1}-vuelta`,
                    round: 1, // Semifinal
                    homeTeam: pair[1], // Intercambiar local y visitante
                    awayTeam: pair[0],
                    isFirstLeg: false,
                    legNumber: 2,
                    status: 'scheduled',
                    date: new Date(Date.now() + ((index + 2) * 24 * 60 * 60 * 1000))
                });
            } else {
                // Partido único
                matches.push({
                    id: `semifinal-${index + 1}`,
                    round: 1, // Semifinal
                    homeTeam: pair[0],
                    awayTeam: pair[1],
                    isFirstLeg: true,
                    legNumber: 1,
                    status: 'scheduled',
                    date: new Date(Date.now() + (index * 24 * 60 * 60 * 1000))
                });
            }
        });
        
        // Final (se generará automáticamente cuando se completen las semifinales)
        
    } else if (numTeams === 8) {
        // Cuartos de final
        let pairs;
        if (customPairings && customPairings.length >= 4) {
            pairs = customPairings;
        } else {
            pairs = [
                [teamNames[0], teamNames[7]],
                [teamNames[1], teamNames[6]],
                [teamNames[2], teamNames[5]],
                [teamNames[3], teamNames[4]]
            ];
        }
        
        pairs.forEach((pair, index) => {
            if (isRoundTrip) {
                matches.push({
                    id: `quarterfinal-${index + 1}-ida`,
                    round: 1, // Cuartos
                    homeTeam: pair[0],
                    awayTeam: pair[1],
                    isFirstLeg: true,
                    legNumber: 1,
                    status: 'scheduled',
                    date: new Date(Date.now() + (index * 24 * 60 * 60 * 1000))
                });
                
                matches.push({
                    id: `quarterfinal-${index + 1}-vuelta`,
                    round: 1, // Cuartos
                    homeTeam: pair[1],
                    awayTeam: pair[0],
                    isFirstLeg: false,
                    legNumber: 2,
                    status: 'scheduled',
                    date: new Date(Date.now() + ((index + 4) * 24 * 60 * 60 * 1000))
                });
            } else {
                matches.push({
                    id: `quarterfinal-${index + 1}`,
                    round: 1, // Cuartos
                    homeTeam: pair[0],
                    awayTeam: pair[1],
                    isFirstLeg: true,
                    legNumber: 1,
                    status: 'scheduled',
                    date: new Date(Date.now() + (index * 24 * 60 * 60 * 1000))
                });
            }
        });
        
    } else if (numTeams === 16) {
        // Octavos de final
        let pairs;
        if (customPairings && customPairings.length >= 8) {
            pairs = customPairings;
        } else {
            pairs = [
                [teamNames[0], teamNames[15]], [teamNames[1], teamNames[14]],
                [teamNames[2], teamNames[13]], [teamNames[3], teamNames[12]],
                [teamNames[4], teamNames[11]], [teamNames[5], teamNames[10]],
                [teamNames[6], teamNames[9]], [teamNames[7], teamNames[8]]
            ];
        }
        
        pairs.forEach((pair, index) => {
            if (isRoundTrip) {
                matches.push({
                    id: `round16-${index + 1}-ida`,
                    round: 1, // Octavos
                    homeTeam: pair[0],
                    awayTeam: pair[1],
                    isFirstLeg: true,
                    legNumber: 1,
                    status: 'scheduled',
                    date: new Date(Date.now() + (index * 24 * 60 * 60 * 1000))
                });
                
                matches.push({
                    id: `round16-${index + 1}-vuelta`,
                    round: 1, // Octavos
                    homeTeam: pair[1],
                    awayTeam: pair[0],
                    isFirstLeg: false,
                    legNumber: 2,
                    status: 'scheduled',
                    date: new Date(Date.now() + ((index + 8) * 24 * 60 * 60 * 1000))
                });
            } else {
                matches.push({
                    id: `round16-${index + 1}`,
                    round: 1, // Octavos
                    homeTeam: pair[0],
                    awayTeam: pair[1],
                    isFirstLeg: true,
                    legNumber: 1,
                    status: 'scheduled',
                    date: new Date(Date.now() + (index * 24 * 60 * 60 * 1000))
                });
            }
        });
    }
    
    console.log(`✅ ${matches.length} partidos generados para bracket de ${numTeams} equipos`);
    return matches;
}

// Modelo para Bracket de Playoffs
const BracketSchema = new mongoose.Schema({
    format: { type: String, required: true }, // '4', '8', '16'
    teams: [{ type: String, required: true }],
    isRoundTrip: { type: Boolean, default: false }, // Nueva opción ida y vuelta
    matches: [{
        id: String,
        round: Number,
        homeTeam: String,
        awayTeam: String,
        homeScore: { type: Number, default: null },
        awayScore: { type: Number, default: null },
        status: { type: String, default: 'scheduled' },
        winner: { type: String, default: null },
        isFirstLeg: { type: Boolean, default: true }, // Para ida y vuelta
        legNumber: { type: Number, default: 1 }, // 1 para ida, 2 para vuelta
        date: Date
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Bracket = mongoose.model('Bracket', BracketSchema);

// GET /api/playoffs/bracket - Obtener bracket actual
app.get('/api/playoffs/bracket', async (req, res) => {
    try {
        console.log('🏆 Obteniendo bracket de playoffs...');
        
        const bracket = await Bracket.findOne().sort({ createdAt: -1 });
        
        if (!bracket) {
            console.log('❌ No hay bracket generado');
            return res.status(404).json({ error: 'No hay bracket generado' });
        }
        
        console.log(`✅ Bracket encontrado: ${bracket.format} equipos`);
        res.json(bracket);
        
    } catch (error) {
        console.error('❌ Error obteniendo bracket:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/playoffs/bracket - Crear nuevo bracket
app.post('/api/playoffs/bracket', async (req, res) => {
    try {
        const { format, selectedTeams, customPairings, isRoundTrip = false } = req.body;
        
        console.log(`🏆 Creando bracket de playoffs: ${format} equipos`);
        console.log('🏆 Equipos seleccionados:', selectedTeams);
        console.log('🎯 Emparejamientos personalizados:', customPairings);
        console.log('🔄 Modalidad ida y vuelta:', isRoundTrip ? 'Sí' : 'No');
        
        if (!format || !selectedTeams || !Array.isArray(selectedTeams)) {
            return res.status(400).json({ error: 'Formato y equipos son requeridos' });
        }
        
        const numTeams = parseInt(format);
        if (![4, 8, 16].includes(numTeams)) {
            return res.status(400).json({ error: 'Formato debe ser 4, 8 o 16 equipos' });
        }
        
        if (selectedTeams.length !== numTeams) {
            return res.status(400).json({ 
                error: `Se requieren exactamente ${numTeams} equipos, recibidos ${selectedTeams.length}` 
            });
        }
        
        // Extraer nombres de equipos (el frontend envía objetos, el modelo espera strings)
        const teamNames = selectedTeams.map(team => {
            // Si es un objeto con name, extraer el name; si es string, usar tal como está
            return typeof team === 'object' && team.name ? team.name : team;
        });
        
        console.log('🏆 Nombres de equipos extraídos:', teamNames);
        
        // Generar partidos del bracket usando los nombres y emparejamientos personalizados
        const matches = generateBracketMatches(format, teamNames, customPairings, isRoundTrip);
        
        // Eliminar bracket anterior si existe
        await Bracket.deleteMany({});
        
        // Crear nuevo bracket
        const newBracket = new Bracket({
            format: format,
            teams: teamNames,  // Usar nombres de equipos, no objetos completos
            isRoundTrip: isRoundTrip,  // Incluir opción de ida y vuelta
            matches: matches,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await newBracket.save();
        
        console.log(`✅ Bracket creado exitosamente: ${matches.length} partidos`);
        
        // Emitir evento WebSocket
        io.emit('bracketCreated', newBracket);
        
        res.json({
            success: true,
            message: 'Bracket creado exitosamente',
            bracket: newBracket
        });
        
    } catch (error) {
        console.error('❌ Error creando bracket:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE /api/playoffs/bracket - Eliminar bracket actual
app.delete('/api/playoffs/bracket', async (req, res) => {
    try {
        console.log('🗑️ Eliminando bracket de playoffs...');
        
        const result = await Bracket.deleteMany({});
        
        console.log(`✅ Brackets eliminados: ${result.deletedCount}`);
        
        // Emitir evento WebSocket
        io.emit('bracketDeleted');
        
        res.json({
            success: true,
            message: 'Bracket eliminado exitosamente',
            deletedCount: result.deletedCount
        });
        
    } catch (error) {
        console.error('❌ Error eliminando bracket:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/playoffs/matches/:id - Actualizar resultado de partido de playoffs
app.put('/api/playoffs/matches/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { homeScore, awayScore } = req.body;
        
        console.log(`🏆 Actualizando partido de playoffs: ${id}`);
        console.log('🏆 Marcador:', { homeScore, awayScore });
        
        // Validar que los marcadores sean números válidos
        if (homeScore === null || homeScore === undefined || 
            awayScore === null || awayScore === undefined) {
            return res.status(400).json({ error: 'Marcadores son requeridos' });
        }
        
        const homeScoreNum = parseInt(homeScore);
        const awayScoreNum = parseInt(awayScore);
        
        if (isNaN(homeScoreNum) || isNaN(awayScoreNum) || 
            homeScoreNum < 0 || awayScoreNum < 0) {
            return res.status(400).json({ error: 'Marcadores deben ser números válidos >= 0' });
        }
        
        // Buscar el bracket actual
        const bracket = await Bracket.findOne();
        if (!bracket) {
            return res.status(404).json({ error: 'No hay bracket activo' });
        }
        
        // Encontrar el partido a actualizar
        const matchIndex = bracket.matches.findIndex(match => match.id === id);
        if (matchIndex === -1) {
            return res.status(404).json({ error: 'Partido no encontrado' });
        }
        
        // Actualizar el partido
        bracket.matches[matchIndex].homeScore = homeScoreNum;
        bracket.matches[matchIndex].awayScore = awayScoreNum;
        bracket.matches[matchIndex].status = 'finished';
        
        // Determinar ganador
        if (homeScoreNum > awayScoreNum) {
            bracket.matches[matchIndex].winner = bracket.matches[matchIndex].homeTeam;
        } else if (awayScoreNum > homeScoreNum) {
            bracket.matches[matchIndex].winner = bracket.matches[matchIndex].awayTeam;
        } else {
            bracket.matches[matchIndex].winner = 'Empate';
        }
        
        // Actualizar fecha de modificación
        bracket.updatedAt = new Date();
        
        // Avanzar ganadores automáticamente a la siguiente ronda
        await advanceWinners(bracket, matchIndex);
        
        // Guardar cambios
        await bracket.save();
        
        console.log(`✅ Partido ${id} actualizado exitosamente`);
        
        // Emitir evento WebSocket
        io.emit('playoffMatchUpdated', {
            matchId: id,
            homeScore: homeScoreNum,
            awayScore: awayScoreNum,
            winner: bracket.matches[matchIndex].winner,
            status: 'finished'
        });
        
        // Emitir evento de bracket actualizado para refrescar la vista
        io.emit('bracketUpdated', bracket);
        
        res.json({
            success: true,
            message: 'Partido actualizado exitosamente',
            match: bracket.matches[matchIndex]
        });
        
    } catch (error) {
        console.error('❌ Error actualizando partido de playoffs:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Función para avanzar ganadores automáticamente a la siguiente ronda
async function advanceWinners(bracket, completedMatchIndex) {
    const completedMatch = bracket.matches[completedMatchIndex];
    const winner = completedMatch.winner;
    
    if (!winner || winner === 'Empate') {
        console.log('⚠️ No hay ganador definido o es empate, no se puede avanzar');
        return;
    }
    
    console.log(`🏆 Avanzando ganador: ${winner} del partido ${completedMatch.id}`);
    
    // Obtener tabla de posiciones para determinar orden de local/visitante
    let standings = [];
    try {
        // Usar el modelo de MongoDB directamente en lugar de fetch
        const standingsData = await Standing.find({}).lean();
        if (standingsData && standingsData.length > 0) {
            standings = standingsData;
        } else {
            // Fallback: generar standings desde partidos
            const matches = await Match.find({ status: 'finished' }).lean();
            standings = generateStandingsFromMatches(matches);
        }
        
        // Ordenar por posición
        standings.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
        });
        
        console.log('📈 Tabla de posiciones para avance:', standings.map(s => `${s.team || s.teamName} (${s.points}pts)`));
        
    } catch (error) {
        console.error('❌ Error obteniendo standings para avance:', error);
    }
    
    // Función para obtener posición de un equipo en la tabla
    const getTeamPosition = (teamName) => {
        const index = standings.findIndex(s => 
            (s.team === teamName || s.teamName === teamName)
        );
        return index >= 0 ? index + 1 : 999; // Si no se encuentra, posición muy baja
    };
    
    // Buscar partidos de la siguiente ronda que dependan de este resultado
    console.log(`🔍 Buscando partidos para avanzar ganador. Bracket format: ${bracket.format}`);
    console.log(`🔍 Partido completado: ${completedMatch.id}, round: ${completedMatch.round}`);
    console.log(`🔍 Total de partidos en bracket: ${bracket.matches.length}`);
    
    bracket.matches.forEach((match, index) => {
        console.log(`🔍 Revisando partido ${match.id}: ${match.homeTeam} vs ${match.awayTeam} (round ${match.round})`);
        let updated = false;
        
        // Lógica específica para brackets de 4 equipos (semifinales → final)
        if (bracket.format === '4' && completedMatch.round === 1 && match.round === 2) {
            console.log(`🎯 Partido de final encontrado: ${match.id}`);
            
            if (completedMatch.id === 'match-1') {
                // Primer semifinal completada
                console.log(`🏆 Primera semifinal completada. Estado actual de final: ${match.homeTeam} vs ${match.awayTeam}`);
                if (!match.homeTeam || match.homeTeam === 'TBD') {
                    match.homeTeam = winner;
                    updated = true;
                    console.log(`✅ Ganador ${winner} avanzó como local a la Final`);
                } else {
                    console.log(`⚠️ Local ya definido: ${match.homeTeam}`);
                }
            } else if (completedMatch.id === 'match-2') {
                // Segunda semifinal completada
                console.log(`🏆 Segunda semifinal completada. Estado actual de final: ${match.homeTeam} vs ${match.awayTeam}`);
                if (!match.awayTeam || match.awayTeam === 'TBD') {
                    match.awayTeam = winner;
                    updated = true;
                    console.log(`✅ Ganador ${winner} avanzó como visitante a la Final`);
                } else {
                    console.log(`⚠️ Visitante ya definido: ${match.awayTeam}`);
                }
            }
            
            // Si ambos equipos están definidos, ordenar por posición en tabla
            if (match.homeTeam !== 'TBD' && match.awayTeam !== 'TBD' && 
                match.homeTeam && match.awayTeam && 
                match.homeTeam !== match.awayTeam) {
                
                const homePos = getTeamPosition(match.homeTeam);
                const awayPos = getTeamPosition(match.awayTeam);
                
                console.log(`📈 Posiciones: ${match.homeTeam} (${homePos}) vs ${match.awayTeam} (${awayPos})`);
                
                // El equipo con mejor posición (menor número) debe ser local
                if (awayPos < homePos) {
                    const temp = match.homeTeam;
                    match.homeTeam = match.awayTeam;
                    match.awayTeam = temp;
                    console.log(`🔄 Intercambiado: ${match.homeTeam} (mejor posición) ahora es local`);
                    updated = true;
                }
            }
        }
        
        if (updated) {
            console.log(`🎯 Partido ${match.id} actualizado: ${match.homeTeam} vs ${match.awayTeam}`);
        }
    });
}

// Función para generar partidos del bracket
function generateBracketMatches(format, teams, customPairings = null) {
    const matches = [];
    const numTeams = parseInt(format);
    let matchId = 1;
    
    console.log('🎯 Generando partidos del bracket...');
    console.log('🎯 Formato:', format, 'Equipos:', teams.length);
    console.log('🎯 Emparejamientos personalizados:', customPairings);
    
    if (numTeams === 4) {
        // Determinar equipos para semifinales
        let homeTeam1, awayTeam1, homeTeam2, awayTeam2;
        
        if (customPairings && customPairings.length === 2) {
            // Usar emparejamientos personalizados
            console.log('✅ Usando emparejamientos personalizados para 4 equipos');
            homeTeam1 = customPairings[0].home.name || customPairings[0].home;
            awayTeam1 = customPairings[0].away.name || customPairings[0].away;
            homeTeam2 = customPairings[1].home.name || customPairings[1].home;
            awayTeam2 = customPairings[1].away.name || customPairings[1].away;
        } else {
            // Mezclar equipos aleatoriamente (comportamiento por defecto)
            console.log('🎲 Usando emparejamientos aleatorios para 4 equipos');
            const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
            homeTeam1 = shuffledTeams[0];
            awayTeam1 = shuffledTeams[1];
            homeTeam2 = shuffledTeams[2];
            awayTeam2 = shuffledTeams[3];
        }
        
        // Semifinales (2 partidos)
        matches.push({
            id: `match-${matchId++}`,
            round: 1,
            homeTeam: homeTeam1,
            awayTeam: awayTeam1,
            homeScore: null,
            awayScore: null,
            status: 'scheduled',
            winner: null,
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // +1 semana
        });
        
        matches.push({
            id: `match-${matchId++}`,
            round: 1,
            homeTeam: homeTeam2,
            awayTeam: awayTeam2,
            homeScore: null,
            awayScore: null,
            status: 'scheduled',
            winner: null,
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // +1 semana
        });
        
        // Final
        matches.push({
            id: `match-${matchId++}`,
            round: 2,
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            homeScore: null,
            awayScore: null,
            status: 'scheduled',
            winner: null,
            date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // +2 semanas
        });
        
    } else if (numTeams === 8) {
        // Cuartos de final (4 partidos)
        for (let i = 0; i < 4; i++) {
            matches.push({
                id: `match-${matchId++}`,
                round: 1,
                homeTeam: shuffledTeams[i * 2],
                awayTeam: shuffledTeams[i * 2 + 1],
                homeScore: null,
                awayScore: null,
                status: 'scheduled',
                winner: null,
                date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
        }
        
        // Semifinales (2 partidos)
        for (let i = 0; i < 2; i++) {
            matches.push({
                id: `match-${matchId++}`,
                round: 2,
                homeTeam: 'TBD',
                awayTeam: 'TBD',
                homeScore: null,
                awayScore: null,
                status: 'scheduled',
                winner: null,
                date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            });
        }
        
        // Final
        matches.push({
            id: `match-${matchId++}`,
            round: 3,
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            homeScore: null,
            awayScore: null,
            status: 'scheduled',
            winner: null,
            date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
        });
        
    } else if (numTeams === 16) {
        // Octavos de final (8 partidos)
        for (let i = 0; i < 8; i++) {
            matches.push({
                id: `match-${matchId++}`,
                round: 1,
                homeTeam: shuffledTeams[i * 2],
                awayTeam: shuffledTeams[i * 2 + 1],
                homeScore: null,
                awayScore: null,
                status: 'scheduled',
                winner: null,
                date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            });
        }
        
        // Cuartos de final (4 partidos)
        for (let i = 0; i < 4; i++) {
            matches.push({
                id: `match-${matchId++}`,
                round: 2,
                homeTeam: 'TBD',
                awayTeam: 'TBD',
                homeScore: null,
                awayScore: null,
                status: 'scheduled',
                winner: null,
                date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            });
        }
        
        // Semifinales (2 partidos)
        for (let i = 0; i < 2; i++) {
            matches.push({
                id: `match-${matchId++}`,
                round: 3,
                homeTeam: 'TBD',
                awayTeam: 'TBD',
                homeScore: null,
                awayScore: null,
                status: 'scheduled',
                winner: null,
                date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
            });
        }
        
        // Final
        matches.push({
            id: `match-${matchId++}`,
            round: 4,
            homeTeam: 'TBD',
            awayTeam: 'TBD',
            homeScore: null,
            awayScore: null,
            status: 'scheduled',
            winner: null,
            date: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)
        });
    }
    
    return matches;
}

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
    
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

// ==================== INICIAR SERVIDOR ====================
console.log('🚀 Iniciando servidor LPCP limpio...');
console.log('💾 MongoDB: Equipos, jugadores, clubes, partidos');
console.log('🎥 Cloudinary: Videos de clips');
console.log('📝 Archivos locales: Solo metadatos de clips');

server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Panel admin: http://localhost:${PORT}/admin.html`);
    console.log(`🌐 Sitio web: http://localhost:${PORT}`);
});
