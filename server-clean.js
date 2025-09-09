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

// Copa schema eliminado

// Esquema para Clips (solo metadatos, videos en Cloudinary)
const ClipSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, required: true }, // goles, atajadas, jugadas, etc.
    club: { type: String, required: true },
    cloudinaryUrl: { type: String, required: true }, // URL del video en Cloudinary
    cloudinaryPublicId: { type: String, required: true }, // ID público de Cloudinary
    thumbnailUrl: { type: String, default: '' }, // URL del thumbnail
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    duration: { type: Number, default: 0 }, // duración en segundos
    fileSize: { type: Number, default: 0 }, // tamaño en bytes
    uploaderIP: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

// Crear modelos
const Team = mongoose.model('Team', TeamSchema);
const Player = mongoose.model('Player', PlayerSchema);
const Club = mongoose.model('Club', ClubSchema);
const Match = mongoose.model('Match', MatchSchema);
const TournamentSettings = mongoose.model('TournamentSettings', TournamentSettingsSchema);
const Settings = mongoose.model('Settings', SettingsSchema);
const Clip = mongoose.model('Clip', ClipSchema);
// Modelo Copa eliminado

// ==================== FUNCIONES MONGODB PARA CLIPS ====================

// Función para obtener estadísticas de clips desde MongoDB
async function getClipsStats() {
    try {
        const totalClips = await Clip.countDocuments();
        const totalViews = await Clip.aggregate([
            { $group: { _id: null, total: { $sum: '$views' } } }
        ]);
        const totalLikes = await Clip.aggregate([
            { $group: { _id: null, total: { $sum: '$likes' } } }
        ]);
        
        return {
            total_clips: totalClips,
            total_views: totalViews[0]?.total || 0,
            total_likes: totalLikes[0]?.total || 0
        };
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        return { total_clips: 0, total_views: 0, total_likes: 0 };
    }
}

// Función para inicializar clips desde MongoDB
async function initializeClips() {
    try {
        const totalClips = await Clip.countDocuments();
        const stats = await getClipsStats();
        
        console.log(`✅ Clips en MongoDB: ${totalClips}`);
        console.log('✅ Estadísticas cargadas:', stats);
    } catch (error) {
        console.error('❌ Error inicializando clips:', error);
    }
}

// Inicializar clips al conectar a MongoDB
initializeClips();

// ==================== ENDPOINTS MONGODB ====================

// ==================== MATCH ROUTES ====================

// Delete all matches (debe ir ANTES del endpoint /:id)
app.delete('/api/matches/delete-all', async (req, res) => {
    try {
        console.log('🗑️ Eliminando todos los partidos...');
        
        const result = await Match.deleteMany({});
        console.log(`✅ ${result.deletedCount} partidos eliminados`);
        
        // Emit WebSocket event
        const allMatches = await Match.find().sort({ date: 1 });
        io.emit('matchesUpdate', allMatches);
        io.emit('matchesDeleted', { deleted: result.deletedCount });
        
        res.json({ 
            success: true, 
            deleted: result.deletedCount,
            message: `${result.deletedCount} partidos eliminados exitosamente`
        });
    } catch (error) {
        console.error('❌ Error eliminando partidos:', error);
        res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }
});

// Obtener todos los partidos
app.get('/api/matches', async (req, res) => {
    try {
        const matches = await Match.find().sort({ date: 1 });
        console.log(`📊 API /api/matches devolviendo ${matches.length} partidos`);
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
                        resource_type: 'image',
                        timeout: 60000, // 60 segundos timeout
                        chunk_size: 6000000 // 6MB chunks
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
            console.log('📁 Procesando logo de club:', {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            });
            
            if (cloudinary.config().cloud_name) {
                try {
                    console.log('☁️ Subiendo logo de club a Cloudinary...');
                    
                    // Convertir buffer a base64 para Cloudinary
                    const b64 = Buffer.from(req.file.buffer).toString('base64');
                    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
                    
                    const result = await cloudinary.uploader.upload(dataURI, {
                        folder: 'lpcp/clubs',
                        public_id: `club_${Date.now()}`,
                        overwrite: true,
                        resource_type: 'image',
                        timeout: 60000,
                        chunk_size: 6000000
                    });
                    
                    logoUrl = result.secure_url;
                    console.log('✅ Logo de club subido exitosamente a Cloudinary:', logoUrl);
                    
                } catch (cloudinaryError) {
                    console.error('❌ Error detallado subiendo logo de club a Cloudinary:');
                    console.error('  - Mensaje:', cloudinaryError.message);
                    console.error('  - Código:', cloudinaryError.http_code);
                    console.error('  - Error completo:', cloudinaryError);
                    
                    return res.status(500).json({ 
                        error: 'Error subiendo logo de club a Cloudinary: ' + cloudinaryError.message,
                        details: 'Verifica la configuración de Cloudinary en las variables de entorno'
                    });
                }
            } else {
                console.warn('⚠️ Cloudinary no configurado para clubes');
                return res.status(500).json({ 
                    error: 'Cloudinary no está configurado',
                    details: 'Faltan variables de entorno de Cloudinary'
                });
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
// NOTA: El endpoint /api/clips está definido más abajo con MongoDB

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
        
        // Crear clip en MongoDB
        const newClip = new Clip({
            title: clipTitle.trim(),
            description: clipDescription.trim(),
            type: clipType,
            club: clubSelect,
            cloudinaryUrl: uploadResult.secure_url,
            cloudinaryPublicId: uploadResult.public_id,
            thumbnailUrl: uploadResult.secure_url.replace('/video/upload/', '/video/upload/w_640,h_360,c_pad,q_auto:good/'),
            duration: uploadResult.duration || 0,
            fileSize: uploadResult.bytes || req.file.size,
            uploaderIP: req.ip || req.connection.remoteAddress || '',
            views: 0,
            likes: 0
        });
        
        // Guardar en MongoDB
        const savedClip = await newClip.save();
        
        // Convertir a formato compatible con frontend
        const clipResponse = {
            id: savedClip._id.toString(),
            title: savedClip.title,
            description: savedClip.description,
            type: savedClip.type,
            club: savedClip.club,
            video_url: savedClip.cloudinaryUrl,
            thumbnail_url: savedClip.thumbnailUrl,
            duration: savedClip.duration,
            file_size: savedClip.fileSize,
            upload_date: savedClip.createdAt.toISOString(),
            views: savedClip.views,
            likes: savedClip.likes
        };
        
        // Emitir evento
        io.emit('new_clip', clipResponse);
        
        console.log(`✅ Clip "${clipTitle}" guardado en MongoDB con ID: ${savedClip._id}`);
        
        res.json({ 
            success: true, 
            clip: clipResponse,
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
        
        // Buscar clip en MongoDB
        const clip = await Clip.findById(clipId);
        
        if (!clip) {
            return res.status(404).json({ success: false, error: 'Clip no encontrado' });
        }
        
        // Eliminar de Cloudinary
        if (clip.cloudinaryPublicId) {
            try {
                await cloudinary.uploader.destroy(clip.cloudinaryPublicId, { resource_type: 'video' });
                console.log('✅ Video eliminado de Cloudinary');
            } catch (error) {
                console.warn('⚠️ Error eliminando de Cloudinary:', error);
            }
        }
        
        // Eliminar de MongoDB
        await Clip.findByIdAndDelete(clipId);
        
        // Emitir evento
        io.emit('clip_deleted', clipId);
        
        console.log(`✅ Clip ${clipId} eliminado completamente`);
        
        res.json({ success: true, message: 'Clip eliminado exitosamente' });
        
    } catch (error) {
        console.error('❌ Error eliminando clip:', error);
        res.status(500).json({ success: false, error: 'Error eliminando clip' });
    }
});

// DEBUG: Endpoint simple para probar clips
app.get('/api/clips-debug', async (req, res) => {
    try {
        console.log('🔍 DEBUG: Probando endpoint clips...');
        
        // Probar conexión MongoDB
        if (mongoose.connection.readyState !== 1) {
            return res.json({ error: 'MongoDB no conectado', state: mongoose.connection.readyState });
        }
        
        // Probar modelo Clip
        const count = await Clip.countDocuments();
        console.log('🔍 DEBUG: Total clips:', count);
        
        return res.json({ 
            success: true, 
            clipCount: count,
            message: 'Endpoint funcionando'
        });
        
    } catch (error) {
        console.error('🔍 DEBUG ERROR:', error);
        return res.json({ 
            success: false, 
            error: error.message,
            stack: error.stack
        });
    }
});

// Obtener clips con paginación y filtros
app.get('/api/clips', async (req, res) => {
    console.log('🔴 INICIO ENDPOINT /api/clips');
    try {
        const page = parseInt(req.query.page) || 1;
        const category = req.query.category || 'all';
        const limit = 12; // Clips por página
        
        console.log(`🎦 Solicitando clips - Página: ${page}, Categoría: ${category}`);
        console.log('🔴 Verificando modelo Clip:', typeof Clip);
        
        // Verificar conexión a MongoDB
        if (mongoose.connection.readyState !== 1) {
            console.error('❌ MongoDB no conectado');
            return res.json({ 
                clips: [], 
                has_more: false, 
                total: 0,
                page: page,
                category: category,
                error: 'Base de datos no disponible' 
            });
        }
        
        // Crear filtro para MongoDB
        let filter = {};
        if (category !== 'all') {
            filter.club = new RegExp(category, 'i'); // Filtro case-insensitive
        }
        
        console.log('🔍 Filtro aplicado:', filter);
        
        // Contar total de clips que coinciden con el filtro
        console.log('📊 Contando clips...');
        const totalClips = await Clip.countDocuments(filter);
        console.log(`📊 Total clips encontrados: ${totalClips}`);
        
        // Obtener clips con paginación
        console.log('📄 Obteniendo clips con paginación...');
        const clips = await Clip.find(filter)
            .sort({ createdAt: -1 }) // Más recientes primero
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(); // Para mejor rendimiento
        
        console.log(`📄 Clips obtenidos de MongoDB: ${clips ? clips.length : 0}`);
        
        // Manejar caso cuando no hay clips
        if (!clips || clips.length === 0) {
            console.log('💭 Base de datos vacía, devolviendo array vacío');
            return res.json({
                clips: [],
                has_more: false,
                total: 0,
                page: page,
                category: category
            });
        }
        
        // Convertir a formato compatible con frontend
        console.log('🔄 Convirtiendo formato...');
        const formattedClips = clips.map(clip => {
            try {
                if (!clip || !clip._id) {
                    console.warn('⚠️ Clip inválido encontrado:', clip);
                    return null;
                }
                
                return {
                    id: clip._id.toString(),
                    title: clip.title || 'Sin título',
                    description: clip.description || 'Sin descripción',
                    type: clip.type || 'general',
                    club: clip.club || 'Sin club',
                    video_url: clip.cloudinaryUrl || '',
                    thumbnail_url: clip.thumbnailUrl || '',
                    duration: clip.duration || 0,
                    file_size: clip.fileSize || 0,
                    upload_date: clip.createdAt ? clip.createdAt.toISOString() : new Date().toISOString(),
                    views: clip.views || 0,
                    likes: clip.likes || 0
                };
            } catch (formatError) {
                console.error('❌ Error formateando clip:', formatError, clip);
                return null;
            }
        }).filter(clip => clip !== null);
        
        // Verificar si hay más páginas
        const hasMore = page * limit < totalClips;
        
        console.log(`✅ Enviando ${formattedClips.length} clips de ${totalClips} total`);
        
        res.json({
            clips: formattedClips,
            has_more: hasMore,
            total: totalClips,
            page: page,
            category: category
        });
        
    } catch (error) {
        console.error('❌ Error detallado obteniendo clips:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.json({ 
            clips: [], 
            has_more: false, 
            total: 0,
            page: parseInt(req.query.page) || 1,
            category: req.query.category || 'all',
            error: `Error obteniendo clips: ${error.message}` 
        });
    }
});

// Obtener clip individual por ID
app.get('/api/clips/:id', async (req, res) => {
    try {
        const clipId = req.params.id;
        const clip = await Clip.findById(clipId);
        
        if (!clip) {
            return res.status(404).json({ error: 'Clip no encontrado' });
        }
        
        // Convertir a formato compatible con frontend
        const clipResponse = {
            id: clip._id.toString(),
            title: clip.title,
            description: clip.description,
            type: clip.type,
            club: clip.club,
            video_url: clip.cloudinaryUrl,
            thumbnail_url: clip.thumbnailUrl,
            duration: clip.duration,
            file_size: clip.fileSize,
            upload_date: clip.createdAt.toISOString(),
            views: clip.views,
            likes: clip.likes
        };
        
        console.log(`📺 Clip ${clipId} obtenido`);
        
        res.json(clipResponse);
        
    } catch (error) {
        console.error('❌ Error obteniendo clip:', error);
        res.status(500).json({ error: 'Error obteniendo clip' });
    }
});

// Incrementar vistas de un clip
app.post('/api/clips/:id/view', async (req, res) => {
    try {
        const clipId = req.params.id;
        
        // Incrementar vistas en MongoDB
        const clip = await Clip.findByIdAndUpdate(
            clipId,
            { $inc: { views: 1 } },
            { new: true }
        );
        
        if (!clip) {
            return res.status(404).json({ error: 'Clip no encontrado' });
        }
        
        // Obtener estadísticas actualizadas
        const stats = await getClipsStats();
        
        console.log(`👁️ Vista incrementada para clip ${clipId}. Total vistas: ${clip.views}`);
        
        res.json({ 
            success: true, 
            views: clip.views,
            total_views: stats.total_views
        });
        
    } catch (error) {
        console.error('❌ Error incrementando vistas:', error);
        res.status(500).json({ error: 'Error incrementando vistas' });
    }
});

// Dar like a un clip
app.post('/api/clips/:id/like', async (req, res) => {
    try {
        const clipId = req.params.id;
        
        // Incrementar likes en MongoDB
        const clip = await Clip.findByIdAndUpdate(
            clipId,
            { $inc: { likes: 1 } },
            { new: true }
        );
        
        if (!clip) {
            return res.status(404).json({ error: 'Clip no encontrado' });
        }
        
        // Obtener estadísticas actualizadas
        const stats = await getClipsStats();
        
        console.log(`❤️ Like agregado al clip ${clipId}. Total likes: ${clip.likes}`);
        
        // Emitir evento en tiempo real
        io.emit('clip_liked', { clipId, likes: clip.likes });
        
        res.json({ 
            success: true, 
            likes: clip.likes,
            total_likes: stats.total_likes
        });
        
    } catch (error) {
        console.error('❌ Error dando like:', error);
        res.status(500).json({ error: 'Error dando like' });
    }
});

// Endpoint de prueba para MongoDB
app.get('/api/test-db', async (req, res) => {
    try {
        console.log('🧪 Probando conexión a MongoDB...');
        
        // Verificar estado de conexión
        const connectionState = mongoose.connection.readyState;
        console.log('📊 Estado de conexión MongoDB:', connectionState);
        
        // Probar consulta simple
        const clipCount = await Clip.countDocuments();
        console.log('📊 Total clips en base de datos:', clipCount);
        
        // Probar obtener un clip de ejemplo
        const sampleClip = await Clip.findOne().lean();
        console.log('📄 Clip de ejemplo:', sampleClip);
        
        res.json({
            success: true,
            connectionState,
            clipCount,
            sampleClip,
            message: 'MongoDB funcionando correctamente'
        });
        
    } catch (error) {
        console.error('❌ Error en prueba de MongoDB:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Obtener estadísticas
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await getClipsStats();
        res.json(stats);
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({ 
            total_clips: 0, 
            total_views: 0, 
            total_likes: 0,
            error: 'Error obteniendo estadísticas'
        });
    }
});

// Obtener configuración del torneo
app.get('/api/settings', (req, res) => {
    res.json({
        seasonName: 'Temporada 2025',
        // Zonas de clasificación eliminadas
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
        console.log(`📊 API /api/matches devolviendo ${matches.length} partidos`);
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

// Generar partidos automáticamente
app.post('/api/matches/generate', async (req, res) => {
    try {
        const { matches } = req.body;
        
        if (!matches || !Array.isArray(matches)) {
            return res.status(400).json({ error: 'Datos de partidos inválidos' });
        }
        
        console.log(`🎯 Generando ${matches.length} partidos automáticamente`);
        
        let created = 0;
        let skipped = 0;
        
        for (const matchData of matches) {
            const { homeTeam, awayTeam, date, time, matchday } = matchData;
            
            // Verificar si el partido ya existe
            const existingMatch = await Match.findOne({
                homeTeam,
                awayTeam,
                date,
                matchday
            });
            
            if (existingMatch) {
                console.log(`⚠️ Partido ya existe: ${homeTeam} vs ${awayTeam} - ${date}`);
                skipped++;
                continue;
            }
            
            // Crear nuevo partido
            const newMatch = new Match({
                homeTeam,
                awayTeam,
                date: date || null,
                time: time || null,
                matchday,
                homeScore: null,
                awayScore: null,
                status: 'scheduled'
            });
            
            const savedMatch = await newMatch.save();
            created++;
            
            console.log(`✅ Partido creado: ${homeTeam} vs ${awayTeam} - J${matchday} - ${date} ${time}`);
            console.log(`📊 Partido guardado en DB:`, savedMatch._id);
        }
        
        console.log(`📊 Resumen generación: ${created} creados, ${skipped} omitidos`);
        
        // Emitir eventos WebSocket para actualización en tiempo real
        const allMatches = await Match.find().sort({ date: 1 });
        io.emit('matchesUpdate', allMatches);
        io.emit('matchesGenerated', { created, skipped, total: matches.length });
        
        res.json({
            success: true,
            created,
            skipped,
            total: matches.length,
            message: `${created} partidos generados exitosamente${skipped > 0 ? `, ${skipped} omitidos por duplicados` : ''}`
        });
        
    } catch (error) {
        console.error('❌ Error generando partidos:', error);
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

// Copa endpoints eliminados





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

// ==================== ENDPOINTS DE EQUIPOS ====================

// GET - Obtener todos los equipos
app.get('/api/teams', async (req, res) => {
    try {
        const teams = await Team.find().sort({ name: 1 });
        res.json(teams);
    } catch (error) {
        console.error('❌ Error obteniendo equipos:', error);
        res.status(500).json({ error: 'Error obteniendo equipos' });
    }
});

// POST - Crear nuevo equipo
app.post('/api/teams', uploadImage.single('logo'), async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'El nombre del equipo es obligatorio' });
        }
        
        // Verificar si ya existe un equipo con ese nombre
        const existingTeam = await Team.findOne({ name: name.trim() });
        if (existingTeam) {
            return res.status(400).json({ error: 'Ya existe un equipo con ese nombre' });
        }
        
        let logoUrl = '/images/default-team-logo.png'; // Logo por defecto
        
        // Si se subió un archivo de logo
        if (req.file) {
            try {
                if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
                    // Subir a Cloudinary
                    const uploadResult = await new Promise((resolve, reject) => {
                        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                        const publicId = `team-logo-${uniqueSuffix}`;
                        
                        cloudinary.uploader.upload_stream(
                            {
                                resource_type: 'image',
                                public_id: publicId,
                                folder: 'lpcp-teams',
                                quality: 'auto:good',
                                format: 'png',
                                transformation: [
                                    { width: 200, height: 200, crop: 'fit', quality: 'auto:good' }
                                ]
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
                    
                    logoUrl = uploadResult.secure_url;
                    console.log('✅ Logo subido a Cloudinary:', logoUrl);
                } else {
                    // Fallback a almacenamiento local
                    const uploadsDir = path.join(__dirname, 'uploads');
                    if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    
                    const filename = `team-${Date.now()}-${Math.round(Math.random() * 1E9)}.${req.file.originalname.split('.').pop()}`;
                    const filepath = path.join(uploadsDir, filename);
                    
                    fs.writeFileSync(filepath, req.file.buffer);
                    logoUrl = `/uploads/${filename}`;
                    console.log('✅ Logo guardado localmente:', logoUrl);
                }
            } catch (uploadError) {
                console.error('❌ Error subiendo logo:', uploadError);
                // Continuar con logo por defecto
            }
        }
        
        // Crear nuevo equipo
        const newTeam = new Team({
            name: name.trim(),
            description: description?.trim() || '',
            logo: logoUrl,
            founded: new Date().getFullYear(),
            players: 0
        });
        
        const savedTeam = await newTeam.save();
        
        // Crear club asociado automáticamente
        const newClub = new Club({
            name: name.trim(),
            description: description?.trim() || `Club oficial del equipo ${name.trim()}`,
            image: logoUrl,
            founded: new Date().getFullYear()
        });
        
        await newClub.save();
        
        console.log(`✅ Equipo "${name}" creado con ID: ${savedTeam._id}`);
        console.log(`✅ Club "${name}" creado automáticamente`);
        
        // Emitir eventos WebSocket
        io.emit('teamsUpdate', await Team.find().sort({ name: 1 }));
        io.emit('clubsUpdate', await Club.find().sort({ name: 1 }));
        
        res.json({ 
            success: true, 
            team: savedTeam,
            message: 'Equipo creado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error creando equipo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT - Actualizar equipo
app.put('/api/teams/:id', uploadImage.single('logo'), async (req, res) => {
    try {
        const { name, description } = req.body;
        const teamId = req.params.id;
        
        if (!name) {
            return res.status(400).json({ error: 'El nombre del equipo es obligatorio' });
        }
        
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }
        
        // Verificar nombre duplicado (excluyendo el equipo actual)
        const existingTeam = await Team.findOne({ 
            name: name.trim(), 
            _id: { $ne: teamId } 
        });
        if (existingTeam) {
            return res.status(400).json({ error: 'Ya existe otro equipo con ese nombre' });
        }
        
        let logoUrl = team.logo; // Mantener logo actual por defecto
        
        // Si se debe eliminar el logo
        if (req.body.removeLogo === 'true') {
            logoUrl = null;
            console.log('🗑️ Logo eliminado del equipo');
        }
        // Si se subió un nuevo logo
        else if (req.file) {
            try {
                if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
                    // Subir a Cloudinary
                    const uploadResult = await new Promise((resolve, reject) => {
                        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                        const publicId = `team-logo-${uniqueSuffix}`;
                        
                        cloudinary.uploader.upload_stream(
                            {
                                resource_type: 'image',
                                public_id: publicId,
                                folder: 'lpcp-teams',
                                quality: 'auto:good',
                                format: 'png',
                                transformation: [
                                    { width: 200, height: 200, crop: 'fit', quality: 'auto:good' }
                                ]
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
                    
                    logoUrl = uploadResult.secure_url;
                    console.log('✅ Nuevo logo subido a Cloudinary:', logoUrl);
                }
            } catch (uploadError) {
                console.error('❌ Error subiendo nuevo logo:', uploadError);
                // Mantener logo actual
            }
        }
        
        // Actualizar equipo
        const updatedTeam = await Team.findByIdAndUpdate(
            teamId,
            {
                name: name.trim(),
                description: description?.trim() || '',
                logo: logoUrl,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        console.log(`✅ Equipo "${name}" actualizado`);
        
        // Emitir evento WebSocket
        io.emit('teamsUpdate', await Team.find().sort({ name: 1 }));
        
        res.json({ 
            success: true, 
            team: updatedTeam,
            message: 'Equipo actualizado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error actualizando equipo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE - Eliminar equipo
app.delete('/api/teams/:id', async (req, res) => {
    try {
        const teamId = req.params.id;
        
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }
        
        const teamName = team.name;
        
        // Eliminar equipo
        await Team.findByIdAndDelete(teamId);
        
        // Eliminar jugadores del equipo
        await Player.deleteMany({ clubName: teamName });
        
        // Eliminar club asociado
        await Club.deleteOne({ name: teamName });
        
        console.log(`✅ Equipo "${teamName}" eliminado junto con sus jugadores y club`);
        
        // Emitir eventos WebSocket
        io.emit('teamsUpdate', await Team.find().sort({ name: 1 }));
        io.emit('playersUpdate', await Player.find().sort({ name: 1 }));
        io.emit('clubsUpdate', await Club.find().sort({ name: 1 }));
        
        res.json({ 
            success: true, 
            message: 'Equipo eliminado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error eliminando equipo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ==================== ENDPOINTS DE JUGADORES ====================

// GET - Obtener todos los jugadores
app.get('/api/players', async (req, res) => {
    try {
        const players = await Player.find().sort({ clubName: 1, number: 1 });
        res.json(players);
    } catch (error) {
        console.error('❌ Error obteniendo jugadores:', error);
        res.status(500).json({ error: 'Error obteniendo jugadores' });
    }
});

// POST - Crear nuevo jugador
app.post('/api/players', uploadImage.single('photo'), async (req, res) => {
    try {
        const { name, age, position, number, clubName, nationality } = req.body;
        
        if (!name || !clubName) {
            return res.status(400).json({ error: 'Nombre y club son obligatorios' });
        }
        
        // Verificar que el equipo existe
        const team = await Team.findOne({ name: clubName });
        if (!team) {
            return res.status(400).json({ error: 'El equipo especificado no existe' });
        }
        
        // Verificar número único por equipo (si se especifica)
        if (number) {
            const existingPlayer = await Player.findOne({ 
                clubName: clubName, 
                number: parseInt(number) 
            });
            if (existingPlayer) {
                return res.status(400).json({ error: `El número ${number} ya está ocupado en ${clubName}` });
            }
        }
        
        let photoUrl = '/images/default-player.png'; // Foto por defecto
        
        // Si se subió una foto
        if (req.file) {
            try {
                if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
                    // Subir a Cloudinary
                    const uploadResult = await new Promise((resolve, reject) => {
                        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                        const publicId = `player-photo-${uniqueSuffix}`;
                        
                        cloudinary.uploader.upload_stream(
                            {
                                resource_type: 'image',
                                public_id: publicId,
                                folder: 'lpcp-players',
                                quality: 'auto:good',
                                format: 'jpg',
                                transformation: [
                                    { width: 300, height: 400, crop: 'fit', quality: 'auto:good' }
                                ]
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
                    
                    photoUrl = uploadResult.secure_url;
                    console.log('✅ Foto subida a Cloudinary:', photoUrl);
                }
            } catch (uploadError) {
                console.error('❌ Error subiendo foto:', uploadError);
                // Continuar con foto por defecto
            }
        }
        
        // Crear nuevo jugador
        const newPlayer = new Player({
            name: name.trim(),
            age: age ? parseInt(age) : null,
            position: position || 'Jugador',
            number: number ? parseInt(number) : null,
            clubName: clubName.trim(),
            nationality: nationality?.trim() || 'Panamá',
            photo: photoUrl,
            goals: 0,
            assists: 0
        });
        
        const savedPlayer = await newPlayer.save();
        
        // Actualizar contador de jugadores del equipo
        await Team.findOneAndUpdate(
            { name: clubName },
            { $inc: { players: 1 } }
        );
        
        console.log(`✅ Jugador "${name}" creado en ${clubName}`);
        
        // Emitir eventos WebSocket
        io.emit('playersUpdate', await Player.find().sort({ clubName: 1, number: 1 }));
        io.emit('teamsUpdate', await Team.find().sort({ name: 1 }));
        
        res.json({ 
            success: true, 
            player: savedPlayer,
            message: 'Jugador creado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error creando jugador:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT - Actualizar jugador
app.put('/api/players/:id', uploadImage.single('photo'), async (req, res) => {
    try {
        const { name, age, position, number, nationality, goals, assists } = req.body;
        const playerId = req.params.id;
        
        const player = await Player.findById(playerId);
        if (!player) {
            return res.status(404).json({ error: 'Jugador no encontrado' });
        }
        
        // Verificar número único por equipo (si se cambia)
        if (number && parseInt(number) !== player.number) {
            const existingPlayer = await Player.findOne({ 
                clubName: player.clubName, 
                number: parseInt(number),
                _id: { $ne: playerId }
            });
            if (existingPlayer) {
                return res.status(400).json({ error: `El número ${number} ya está ocupado en ${player.clubName}` });
            }
        }
        
        let photoUrl = player.photo; // Mantener foto actual
        
        // Si se subió una nueva foto
        if (req.file) {
            try {
                if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
                    // Subir a Cloudinary
                    const uploadResult = await new Promise((resolve, reject) => {
                        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                        const publicId = `player-photo-${uniqueSuffix}`;
                        
                        cloudinary.uploader.upload_stream(
                            {
                                resource_type: 'image',
                                public_id: publicId,
                                folder: 'lpcp-players',
                                quality: 'auto:good',
                                format: 'jpg',
                                transformation: [
                                    { width: 300, height: 400, crop: 'fit', quality: 'auto:good' }
                                ]
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
                    
                    photoUrl = uploadResult.secure_url;
                    console.log('✅ Nueva foto subida a Cloudinary:', photoUrl);
                }
            } catch (uploadError) {
                console.error('❌ Error subiendo nueva foto:', uploadError);
                // Mantener foto actual
            }
        }
        
        // Actualizar jugador
        const updatedPlayer = await Player.findByIdAndUpdate(
            playerId,
            {
                name: name?.trim() || player.name,
                age: age ? parseInt(age) : player.age,
                position: position || player.position,
                number: number ? parseInt(number) : player.number,
                nationality: nationality?.trim() || player.nationality,
                photo: photoUrl,
                goals: goals !== undefined ? parseInt(goals) || 0 : player.goals,
                assists: assists !== undefined ? parseInt(assists) || 0 : player.assists,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        console.log(`✅ Jugador "${updatedPlayer.name}" actualizado`);
        
        // Emitir eventos WebSocket
        io.emit('playersUpdate', await Player.find().sort({ clubName: 1, number: 1 }));
        io.emit('playerStatsUpdated', updatedPlayer);
        
        res.json({ 
            success: true, 
            player: updatedPlayer,
            message: 'Jugador actualizado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error actualizando jugador:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE - Eliminar jugador
app.delete('/api/players/:id', async (req, res) => {
    try {
        const playerId = req.params.id;
        
        const player = await Player.findById(playerId);
        if (!player) {
            return res.status(404).json({ error: 'Jugador no encontrado' });
        }
        
        const playerName = player.name;
        const clubName = player.clubName;
        
        // Eliminar jugador
        await Player.findByIdAndDelete(playerId);
        
        // Actualizar contador de jugadores del equipo
        await Team.findOneAndUpdate(
            { name: clubName },
            { $inc: { players: -1 } }
        );
        
        console.log(`✅ Jugador "${playerName}" eliminado de ${clubName}`);
        
        // Emitir eventos WebSocket
        io.emit('playersUpdate', await Player.find().sort({ clubName: 1, number: 1 }));
        io.emit('teamsUpdate', await Team.find().sort({ name: 1 }));
        
        res.json({ 
            success: true, 
            message: 'Jugador eliminado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error eliminando jugador:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ==================== ENDPOINTS DE CLUBES ====================

// GET - Obtener todos los clubes
app.get('/api/clubs', async (req, res) => {
    try {
        const clubs = await Club.find().sort({ name: 1 });
        res.json(clubs);
    } catch (error) {
        console.error('❌ Error obteniendo clubes:', error);
        res.status(500).json({ error: 'Error obteniendo clubes' });
    }
});

// POST - Crear nuevo club
app.post('/api/clubs', uploadImage.single('image'), async (req, res) => {
    try {
        const { name, description, founded } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'El nombre del club es obligatorio' });
        }
        
        // Verificar si ya existe un club con ese nombre
        const existingClub = await Club.findOne({ name: name.trim() });
        if (existingClub) {
            return res.status(400).json({ error: 'Ya existe un club con ese nombre' });
        }
        
        let imageUrl = '/images/default-club.png'; // Imagen por defecto
        
        // Si se subió una imagen
        if (req.file) {
            try {
                if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
                    // Subir a Cloudinary
                    const uploadResult = await new Promise((resolve, reject) => {
                        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                        const publicId = `club-image-${uniqueSuffix}`;
                        
                        cloudinary.uploader.upload_stream(
                            {
                                resource_type: 'image',
                                public_id: publicId,
                                folder: 'lpcp-clubs',
                                quality: 'auto:good',
                                format: 'jpg',
                                transformation: [
                                    { width: 400, height: 300, crop: 'fit', quality: 'auto:good' }
                                ]
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
                    
                    imageUrl = uploadResult.secure_url;
                    console.log('✅ Imagen subida a Cloudinary:', imageUrl);
                }
            } catch (uploadError) {
                console.error('❌ Error subiendo imagen:', uploadError);
                // Continuar con imagen por defecto
            }
        }
        
        // Crear nuevo club
        const newClub = new Club({
            name: name.trim(),
            description: description?.trim() || '',
            image: imageUrl,
            founded: founded ? parseInt(founded) : new Date().getFullYear()
        });
        
        const savedClub = await newClub.save();
        
        console.log(`✅ Club "${name}" creado con ID: ${savedClub._id}`);
        
        // Emitir evento WebSocket
        io.emit('clubsUpdate', await Club.find().sort({ name: 1 }));
        
        res.json({ 
            success: true, 
            club: savedClub,
            message: 'Club creado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error creando club:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT - Actualizar club
app.put('/api/clubs/:id', uploadImage.single('image'), async (req, res) => {
    try {
        const { name, description, founded } = req.body;
        const clubId = req.params.id;
        
        const club = await Club.findById(clubId);
        if (!club) {
            return res.status(404).json({ error: 'Club no encontrado' });
        }
        
        // Verificar nombre duplicado (excluyendo el club actual)
        if (name && name.trim() !== club.name) {
            const existingClub = await Club.findOne({ 
                name: name.trim(), 
                _id: { $ne: clubId } 
            });
            if (existingClub) {
                return res.status(400).json({ error: 'Ya existe otro club con ese nombre' });
            }
        }
        
        let imageUrl = club.image; // Mantener imagen actual
        
        // Si se subió una nueva imagen
        if (req.file) {
            try {
                if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
                    // Subir a Cloudinary
                    const uploadResult = await new Promise((resolve, reject) => {
                        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                        const publicId = `club-image-${uniqueSuffix}`;
                        
                        cloudinary.uploader.upload_stream(
                            {
                                resource_type: 'image',
                                public_id: publicId,
                                folder: 'lpcp-clubs',
                                quality: 'auto:good',
                                format: 'jpg',
                                transformation: [
                                    { width: 400, height: 300, crop: 'fit', quality: 'auto:good' }
                                ]
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
                    
                    imageUrl = uploadResult.secure_url;
                    console.log('✅ Nueva imagen subida a Cloudinary:', imageUrl);
                }
            } catch (uploadError) {
                console.error('❌ Error subiendo nueva imagen:', uploadError);
                // Mantener imagen actual
            }
        }
        
        // Actualizar club
        const updatedClub = await Club.findByIdAndUpdate(
            clubId,
            {
                name: name?.trim() || club.name,
                description: description?.trim() || club.description,
                image: imageUrl,
                founded: founded ? parseInt(founded) : club.founded,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        console.log(`✅ Club "${updatedClub.name}" actualizado`);
        
        // Emitir evento WebSocket
        io.emit('clubsUpdate', await Club.find().sort({ name: 1 }));
        
        res.json({ 
            success: true, 
            club: updatedClub,
            message: 'Club actualizado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error actualizando club:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// DELETE - Eliminar club
app.delete('/api/clubs/:id', async (req, res) => {
    try {
        const clubId = req.params.id;
        
        const club = await Club.findById(clubId);
        if (!club) {
            return res.status(404).json({ error: 'Club no encontrado' });
        }
        
        const clubName = club.name;
        
        // Eliminar club
        await Club.findByIdAndDelete(clubId);
        
        console.log(`✅ Club "${clubName}" eliminado`);
        
        // Emitir evento WebSocket
        io.emit('clubsUpdate', await Club.find().sort({ name: 1 }));
        
        res.json({ 
            success: true, 
            message: 'Club eliminado exitosamente'
        });
        
    } catch (error) {
        console.error('❌ Error eliminando club:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});






// ==================== WEBSOCKETS ====================
io.on('connection', async (socket) => {
    console.log('Usuario conectado:', socket.id);
    
    // Enviar estadísticas actualizadas desde MongoDB
    try {
        const stats = await getClipsStats();
        socket.emit('statsUpdate', stats);
    } catch (error) {
        console.error('❌ Error enviando estadísticas por WebSocket:', error);
        socket.emit('statsUpdate', { total_clips: 0, total_views: 0, total_likes: 0 });
    }
    
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
    });
});

// ==================== INICIAR SERVIDOR ====================
console.log('🚀 Iniciando servidor ASP limpio...');
console.log('💾 MongoDB: Equipos, jugadores, clubes, partidos');
console.log('🎥 Cloudinary: Videos de clips');
console.log('📝 Archivos locales: Solo metadatos de clips');

server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Panel admin: http://localhost:${PORT}/admin.html`);
    console.log(`🌐 Sitio web: http://localhost:${PORT}`);
});
