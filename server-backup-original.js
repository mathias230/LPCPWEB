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

// Configuración de MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lpcp';

// Conectar a MongoDB con reconexión automática
mongoose.connect(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
})
    .then(() => {
        console.log('✅ Conectado a MongoDB exitosamente');
        useDatabase = true;
        console.log('💾 Usando MongoDB para persistencia de datos');
    })
    .catch((error) => {
        console.error('❌ Error conectando a MongoDB:', error.message);
        console.log('⚠️ Continuando con archivos locales como fallback');
        useDatabase = false;
    });

// Manejar eventos de conexión MongoDB
mongoose.connection.on('connected', () => {
    console.log('🔗 MongoDB conectado');
    useDatabase = true;
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Error de conexión MongoDB:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB desconectado');
    // En producción, mantener useDatabase = true para intentar reconectar
    // En desarrollo, cambiar a archivos locales
    if (!(process.env.NODE_ENV === 'production' || process.env.RENDER)) {
        useDatabase = false;
    }
});

// Configuración de Cloudinary (SOLO PARA CLIPS)
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

// Estadísticas de clips (solo para compatibilidad, se cargan desde archivos)
let stats = {
    total_clips: 0,
    total_views: 0,
    total_likes: 0
};

// ==================== MODELOS DE MONGODB ====================

// Modelo para Equipos
const TeamSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    logo: { type: String, default: 'img/default-team.png' },
    founded: { type: Number },
    stadium: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Modelo para Jugadores
const PlayerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    clubId: { type: String, required: true },
    clubName: { type: String, required: true },
    position: { type: String, default: 'Jugador' },
    age: { type: Number },
    number: { type: Number },
    nationality: { type: String, default: 'Panamá' },
    photo: { type: String, default: '' },
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    registeredAt: { type: Date, default: Date.now }
});

// Modelo para Clubes
const ClubSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    founded: { type: Number, required: true },
    players: { type: Number, required: true },
    logo: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

// Modelo para Partidos
const MatchSchema = new mongoose.Schema({
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    homeScore: { type: Number, default: null },
    awayScore: { type: Number, default: null },
    matchday: { type: Number, required: true },
    status: { type: String, enum: ['scheduled', 'finished'], default: 'scheduled' },
    date: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

// Modelo para Configuración del Torneo
const TournamentSettingsSchema = new mongoose.Schema({
    seasonName: { type: String, default: 'Temporada 2025' },
    pointsWin: { type: Number, default: 3 },
    pointsDraw: { type: Number, default: 1 },
    pointsLoss: { type: Number, default: 0 },
    currentBracket: { type: mongoose.Schema.Types.Mixed },
    updatedAt: { type: Date, default: Date.now }
});

// Crear modelos
const Team = mongoose.model('Team', TeamSchema);
const Player = mongoose.model('Player', PlayerSchema);
const Club = mongoose.model('Club', ClubSchema);
const Match = mongoose.model('Match', MatchSchema);
const TournamentSettings = mongoose.model('TournamentSettings', TournamentSettingsSchema);

// ==================== CONFIGURACIÓN DE PERSISTENCIA ====================
// IMPORTANTE: NO usar arrays globales - todo se guarda/carga desde MongoDB

let useDatabase = false; // Flag para saber si usar MongoDB

// SOLO para compatibilidad con funciones legacy - NO se usan para persistencia
let settings = {
    seasonName: 'Temporada 2025',
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0
};

// Variable temporal para bracket actual (se carga desde MongoDB)
let currentBracket = null;

// ⚠️ ÚNICO array temporal restante (solo para clips/videos)
let clips = [];
// stats ya declarado anteriormente en línea 128

// ⚠️ NOTA CRÍTICA: Los datos reales (equipos, jugadores, partidos, etc.)
// se obtienen SIEMPRE desde MongoDB usando los modelos definidos arriba.
// NO se mantienen en arrays globales para evitar pérdida de datos.





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

// ⚠️ FUNCIÓN OBSOLETA - AHORA TODO ES 100% MONGODB
// Esta función ya no es necesaria porque no usamos arrays globales
async function loadTournamentData() {
    console.log('🔄 Verificando conexión a MongoDB...');
    
    if (!useDatabase) {
        console.log('❌ MongoDB no está disponible');
        return false;
    }
    
    try {
        // Solo verificar que MongoDB esté conectado
        const teamCount = await Team.countDocuments();
        const playerCount = await Player.countDocuments();
        const clubCount = await Club.countDocuments();
        
        console.log('✅ MongoDB conectado correctamente:');
        console.log(`   - Equipos en MongoDB: ${teamCount}`);
        console.log(`   - Jugadores en MongoDB: ${playerCount}`);
        console.log(`   - Clubes en MongoDB: ${clubCount}`);
        
        return true;
    } catch (error) {
        console.error('❌ Error verificando MongoDB:', error);
        return false;
    }
    
    console.log('✅ MongoDB verificado correctamente');
}

// ==================== TODAS LAS FUNCIONES DE ARRAYS GLOBALES ELIMINADAS ====================
// ❌ FUNCIONES OBSOLETAS ELIMINADAS:
// - loadFromLocalFiles() → usaba arrays globales teams, matches, standings, clubs
// - loadFromMongoDB() → usaba arrays globales teams, players, clubs, matches
// - saveToMongoDB() → guardaba arrays globales en MongoDB
// - saveData() → guardaba arrays globales en archivos locales
//
// ✅ NUEVA ARQUITECTURA 100% MONGODB:
// - Equipos: Team.find() desde MongoDB directamente
// - Jugadores: Player.find() desde MongoDB directamente
// - Clubes: Club.find() desde MongoDB directamente
// - Partidos: Match.find() desde MongoDB directamente
// - Clips: Solo metadatos en archivos locales + videos en Cloudinary
//
// 🚀 BENEFICIOS:
// - Persistencia real: Los datos nunca se pierden al reiniciar servidor
// - Sin dependencia de archivos locales: Funciona en entornos efímeros (Render)
// - Consistencia garantizada: Una sola fuente de verdad (MongoDB)
// - Escalabilidad: Preparado para múltiples instancias de servidor

// ==================== SOLO CLIPS LOCALES (TEMPORALES) ====================
// Solo mantenemos clips en memoria temporalmente hasta migrar a MongoDB
// clips ya declarado al inicio del archivo

// Función para cargar solo clips desde archivos locales
async function loadClipsFromLocal() {
    const tournamentFile = path.join(dataDir, 'tournament.json');
    
    if (fs.existsSync(tournamentFile)) {
        try {
            const tournamentData = fs.readFileSync(tournamentFile, 'utf8');
            const data = JSON.parse(tournamentData);
            
            // Solo cargar clips (los demás datos vienen de MongoDB)
            if (data.clips && data.clips.length > 0) {
                clips = data.clips;
                console.log('✅ Clips cargados desde archivos locales:', clips.length);
            }
            
            // Solo cargar estadísticas de clips
            if (data.stats) {
                stats = { ...stats, ...data.stats };
                console.log('✅ Estadísticas de clips cargadas');
            }
            
        } catch (error) {
            console.error('❌ Error cargando clips locales:', error);
            clips = [];
            console.log('🔄 Usando clips vacíos por defecto');
        }
    } else {
        console.log('📝 Archivo tournament.json no encontrado, clips vacíos por defecto');
        clips = [];
    }
}

// ==================== INICIALIZACIÓN SIMPLE ====================
// Solo cargar clips al iniciar (equipos, jugadores, clubes vienen de MongoDB)
console.log('🚀 Iniciando servidor LPCP...');
console.log('💾 MongoDB: Equipos, jugadores, clubes, partidos');
console.log('🎥 Cloudinary: Videos e imágenes de clips');
console.log('📝 Archivos locales: Solo metadatos de clips temporalmente');

// Cargar solo clips al iniciar
loadClipsFromLocal();

// ==================== FUNCIONES DE CLIPS (TEMPORALES) ====================

// Función simple para guardar solo clips localmente
async function saveClipsData() {
    try {
        console.log('💾 Guardando clips y estadísticas...');
        
        // Solo guardar clips y stats (NO equipos, jugadores, clubes, partidos)
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const tournamentFile = path.join(dataDir, 'tournament.json');
        const clipData = {
            clips: clips,
            stats: stats,
            lastSaved: new Date().toISOString()
        };
        
        fs.writeFileSync(tournamentFile, JSON.stringify(clipData, null, 2));
        console.log('✅ Clips y estadísticas guardados localmente');
        
        return true;
    } catch (error) {
        console.error('❌ Error guardando clips:', error);
        return false;
    }
}

// Función async para sincronizar datos con MongoDB
async function syncDataWithMongoDB() {
    try {
        console.log('🔄 Sincronizando datos con MongoDB...');
        
        // Guardar configuración del torneo en MongoDB
        await TournamentSettings.findOneAndUpdate(
            {},
            {
                seasonName: 'Temporada 2025',
                pointsWin: 3,
                pointsDraw: 1,
                pointsLoss: 0
            },
            { upsert: true, new: true }
        );
        
        console.log('✅ Configuración sincronizada con MongoDB');
        
    } catch (error) {
        console.error('❌ Error en sincronización MongoDB:', error);
        throw error;
    }
}

// Función async para backup completo (LEGACY - mantenida por compatibilidad)
async function saveDataAsync() {
    try {
        console.log('🔄 BACKUP COMPLETO INICIADO...');
        
        const tournamentFile = path.join(dataDir, 'tournament.json');
        const tournamentData = {
            teams: teams,
            matches: matches,
            standings: standings,
            settings: settings,
            bracket: currentBracket,
            clubs: clubs,
            players: players,
            clips: clips,
            stats: stats,
            lastSaved: new Date().toISOString()
        };
        
        // Guardado local
        fs.writeFileSync(clipsFile, JSON.stringify(clips, null, 2));
        fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
        fs.writeFileSync(tournamentFile, JSON.stringify(tournamentData, null, 2));
        
        // Backup a Cloudinary con timeout
        await backupToCloudinaryAsync(tournamentData);
        
        console.log('✅ BACKUP COMPLETO EXITOSO');
    } catch (error) {
        console.error('❌ ERROR EN BACKUP COMPLETO:', error);
    }
}

// Función OPTIMIZADA para backup en Cloudinary con timeout y compresión
async function backupToCloudinaryAsync(data) {
    return new Promise((resolve, reject) => {
        // Timeout de 10 segundos para evitar bloqueos
        const timeout = setTimeout(() => {
            console.warn('⏰ Backup a Cloudinary cancelado por timeout (10s)');
            resolve(false);
        }, 10000);
        
        (async () => {
            try {
                if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
                    console.log('⚠️ Cloudinary no configurado, saltando backup');
                    clearTimeout(timeout);
                    resolve(false);
                    return;
                }
                
                console.log('☁️ Iniciando backup optimizado a Cloudinary...');
                
                // Comprimir datos para upload más rápido
                const compressedData = {
                    teams: data.teams || [],
                    matches: data.matches || [],
                    standings: data.standings || [],
                    settings: data.settings || {},
                    bracket: data.bracket,
                    clubs: data.clubs || [],
                    players: data.players || [],
                    clips: (data.clips || []).map(clip => ({
                        id: clip.id,
                        title: clip.title,
                        type: clip.type,
                        club: clip.club,
                        likes: clip.likes,
                        views: clip.views,
                        url: clip.url,
                        created_at: clip.created_at
                    })),
                    stats: data.stats || {},
                    lastSaved: new Date().toISOString(),
                    version: '2.0'
                };
                
                const jsonString = JSON.stringify(compressedData);
                const buffer = Buffer.from(jsonString, 'utf8');
                
                console.log(`📦 Tamaño del backup: ${(buffer.length / 1024).toFixed(2)} KB`);
                
                const result = await new Promise((uploadResolve, uploadReject) => {
                    cloudinary.uploader.upload_stream(
                        { 
                            resource_type: 'raw',
                            folder: 'lpcp/backups',
                            public_id: `tournament_data_${Date.now()}`,
                            format: 'json',
                            timeout: 8000 // 8 segundos de timeout interno
                        },
                        (error, result) => {
                            if (error) uploadReject(error);
                            else uploadResolve(result);
                        }
                    ).end(buffer);
                });
                
                clearTimeout(timeout);
                console.log(`✅ Backup rápido completado: ${result.public_id}`);
                resolve(true);
                
            } catch (error) {
                clearTimeout(timeout);
                console.warn(`⚠️ Error en backup optimizado: ${error.message}`);
                resolve(false);
            }
        })();
    });
}

// Función legacy mantenida por compatibilidad
async function backupToCloudinary(data) {
    return backupToCloudinaryAsync(data);
}

// AUTO-BACKUP: Función que se ejecuta automáticamente cuando hay cambios críticos
function autoBackup(changeType = 'unknown') {
    console.log(`🔄 AUTO-BACKUP activado por: ${changeType}`);
    
    // Ejecutar backup inmediato sin bloquear
    setImmediate(() => {
        const success = saveData();
        if (success) {
            console.log(`✅ Auto-backup completado para: ${changeType}`);
        } else {
            console.warn(`⚠️ Auto-backup falló para: ${changeType}`);
        }
    });
}

// Función para forzar backup completo (para casos críticos)
async function forceBackup(reason = 'manual') {
    console.log(`🚨 BACKUP FORZADO iniciado por: ${reason}`);
    try {
        const success = saveData();
        if (success) {
            // También intentar backup completo async
            await saveDataAsync();
            console.log(`✅ Backup forzado completado: ${reason}`);
            return true;
        }
    } catch (error) {
        console.error(`❌ Error en backup forzado: ${error.message}`);
    }
    return false;
}

// VERIFICACIÓN DE INTEGRIDAD: Verificar que los datos estén consistentes
function verifyDataIntegrity() {
    try {
        console.log('🔍 Verificando integridad de datos...');
        
        const issues = [];
        
        // Verificar que arrays críticos existan
        if (!Array.isArray(teams)) {
            issues.push('teams no es un array');
            teams = [];
        }
        
        if (!Array.isArray(players)) {
            issues.push('players no es un array');
            players = [];
        }
        
        if (!Array.isArray(clips)) {
            issues.push('clips no es un array');
            clips = [];
        }
        
        if (!Array.isArray(clubs)) {
            issues.push('clubs no es un array');
            clubs = [];
        }
        
        // Verificar tournament.teams
        if (!tournament.teams || !Array.isArray(tournament.teams)) {
            issues.push('tournament.teams no es un array');
            tournament.teams = [];
        }
        
        // Sincronizar teams con tournament.teams si hay discrepancias
        if (teams.length !== tournament.teams.length) {
            issues.push(`Discrepancia: teams(${teams.length}) vs tournament.teams(${tournament.teams.length})`);
            initializeTournamentTeams();
        }
        
        if (issues.length > 0) {
            console.warn('⚠️ Problemas de integridad detectados:', issues);
            // Auto-backup después de correcciones
            autoBackup('integrity_fix');
        } else {
            console.log('✅ Integridad de datos verificada correctamente');
        }
        
        return issues.length === 0;
    } catch (error) {
        console.error('❌ Error verificando integridad:', error);
        return false;
    }
}

// BACKUP AUTOMÁTICO PERIÓDICO: Cada 5 minutos
setInterval(() => {
    console.log('⏰ Backup automático periódico iniciado...');
    verifyDataIntegrity();
    autoBackup('periodic_5min');
}, 5 * 60 * 1000); // 5 minutos

// SISTEMA DE DIAGNÓSTICO COMPLETO
function diagnosticReport() {
    const timestamp = new Date().toISOString();
    console.log('\n🔍 ==================== DIAGNÓSTICO COMPLETO ====================');
    console.log(`⏰ Timestamp: ${timestamp}`);
    console.log('\n📊 ESTADO DE VARIABLES:');
    console.log(`   - teams: ${teams ? teams.length : 'undefined'} elementos`);
    console.log(`   - players: ${players ? players.length : 'undefined'} elementos`);
    console.log(`   - clubs: ${clubs ? clubs.length : 'undefined'} elementos`);
    console.log(`   - clips: ${clips ? clips.length : 'undefined'} elementos`);
    console.log(`   - tournament.teams: ${tournament.teams ? tournament.teams.length : 'undefined'} elementos`);
    
    console.log('\n🏆 EQUIPOS ACTUALES:');
    if (teams && teams.length > 0) {
        teams.forEach((team, index) => {
            console.log(`   ${index + 1}. ${team.name} (ID: ${team.id})`);
        });
    } else {
        console.log('   ❌ No hay equipos');
    }
    
    console.log('\n👥 JUGADORES ACTUALES:');
    if (players && players.length > 0) {
        players.forEach((player, index) => {
            console.log(`   ${index + 1}. ${player.name} - ${player.clubName} (ID: ${player.id})`);
        });
    } else {
        console.log('   ❌ No hay jugadores');
    }
    
    console.log('\n🏢 CLUBES ACTUALES:');
    if (clubs && clubs.length > 0) {
        clubs.forEach((club, index) => {
            console.log(`   ${index + 1}. ${club.name} (ID: ${club.id})`);
        });
    } else {
        console.log('   ❌ No hay clubes');
    }
    
    // Verificar archivos en disco
    console.log('\n💾 ARCHIVOS EN DISCO:');
    const tournamentFile = path.join(dataDir, 'tournament.json');
    if (fs.existsSync(tournamentFile)) {
        try {
            const fileData = JSON.parse(fs.readFileSync(tournamentFile, 'utf8'));
            console.log(`   ✅ tournament.json existe`);
            console.log(`   - teams en archivo: ${fileData.teams ? fileData.teams.length : 'undefined'}`);
            console.log(`   - players en archivo: ${fileData.players ? fileData.players.length : 'undefined'}`);
            console.log(`   - clubs en archivo: ${fileData.clubs ? fileData.clubs.length : 'undefined'}`);
        } catch (error) {
            console.log(`   ❌ Error leyendo tournament.json: ${error.message}`);
        }
    } else {
        console.log('   ❌ tournament.json NO existe');
    }
    
    console.log('🔍 ==================== FIN DIAGNÓSTICO ====================\n');
}

// DIAGNÓSTICO AUTOMÁTICO cada 60 segundos
setInterval(() => {
    console.log('\n⏰ DIAGNÓSTICO AUTOMÁTICO:');
    diagnosticReport();
}, 60 * 1000); // 60 segundos

// BACKUP AUTOMÁTICO FRECUENTE: Cada 30 segundos (solo local, sin Cloudinary)
setInterval(() => {
    try {
        const tournamentFile = path.join(dataDir, 'tournament.json');
        const quickData = {
            teams: teams,
            tournament: tournament,
            players: players,
            clubs: clubs,
            clips: clips,
            stats: stats,
            lastQuickSave: new Date().toISOString()
        };
        
        fs.writeFileSync(tournamentFile, JSON.stringify(quickData, null, 2));
        console.log('💾 Quick-save local completado');
        
        // Mini diagnóstico después del quick-save
        console.log(`📊 Quick-save: teams=${teams.length}, players=${players.length}, clubs=${clubs.length}`);
    } catch (error) {
        console.warn('⚠️ Error en quick-save:', error.message);
    }
}, 30 * 1000); // 30 segundos

// Función para restaurar datos desde Cloudinary
async function restoreFromCloudinary() {
    console.log('☁️ Intentando restaurar desde Cloudinary...');
    
    try {
        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
            console.log('🔑 Credenciales de Cloudinary encontradas');
            
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
                if (data.clips) clips = data.clips;
                if (data.stats) stats = data.stats;
                
                console.log('☁️ Datos restaurados desde Cloudinary exitosamente');
                console.log('📊 Equipos restaurados:', teams?.length || 0);
                console.log('🏆 Clubes restaurados:', clubs?.length || 0);
                console.log('👥 Jugadores restaurados:', players?.length || 0);
                console.log('🎬 Clips restaurados:', clips?.length || 0);
                return true;
            } else {
                console.log('⚠️ No se encontró backup en Cloudinary o no es accesible');
            }
        } else {
            console.log('❌ Credenciales de Cloudinary no encontradas');
        }
    } catch (error) {
        console.warn('⚠️ Error en restauración desde Cloudinary:', error.message);
    }
    
    console.log('📁 Continuando con carga local...');
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

// ENDPOINT DE DIAGNÓSTICO MANUAL
app.get('/api/diagnostic', (req, res) => {
    try {
        console.log('🔍 DIAGNÓSTICO MANUAL SOLICITADO');
        
        const diagnosticData = {
            timestamp: new Date().toISOString(),
            variables: {
                teams: teams ? teams.length : 0,
                players: players ? players.length : 0,
                clubs: clubs ? clubs.length : 0,
                clips: clips ? clips.length : 0,
                tournamentTeams: tournament.teams ? tournament.teams.length : 0
            },
            teams: teams || [],
            players: players || [],
            clubs: clubs || [],
            clips: (clips || []).map(c => ({ id: c.id, title: c.title })),
            tournamentTeams: tournament.teams || []
        };
        
        // También ejecutar diagnóstico en consola
        diagnosticReport();
        
        res.json({
            success: true,
            diagnostic: diagnosticData,
            message: 'Diagnóstico completado - revisa los logs del servidor'
        });
    } catch (error) {
        console.error('❌ Error en diagnóstico manual:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error ejecutando diagnóstico',
            details: error.message 
        });
    }
});

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

// ✅ SUBIR CLIPS A CLOUDINARY - CONFIGURACIÓN OPTIMIZADA
app.post('/api/upload', upload.single('clipFile'), async (req, res) => {
    try {
        console.log('🎥 Iniciando subida de clip a Cloudinary...');
        
        // Validar archivo
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No se subió ningún archivo' });
        }
        
        // Validar tamaño (100MB máximo)
        if (req.file.size > 100 * 1024 * 1024) {
            return res.status(400).json({ success: false, error: 'El archivo es demasiado grande (máximo 100MB)' });
        }
        
        console.log(`📁 Archivo recibido: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

        const { clipTitle, clipDescription, clipType, clubSelect } = req.body;

        // Validar campos obligatorios
        if (!clipTitle || !clipDescription || !clipType || !clubSelect) {
            return res.status(400).json({ 
                success: false, 
                error: 'Todos los campos son obligatorios' 
            });
        }
        
        // Verificar configuración de Cloudinary
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            return res.status(500).json({ 
                success: false, 
                error: 'Cloudinary no está configurado correctamente' 
            });
        }

        console.log('☁️ Subiendo video a Cloudinary...');
        
        // Subir video a Cloudinary con configuración optimizada
        const uploadResult = await new Promise((resolve, reject) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const publicId = `clip-${uniqueSuffix}`;
            
            cloudinary.uploader.upload_stream(
                {
                    resource_type: 'video',
                    public_id: publicId,
                    folder: 'lpcp-clips',
                    quality: 'auto:good', // Calidad optimizada
                    format: 'mp4',
                    video_codec: 'h264', // Codec eficiente
                    audio_codec: 'aac',
                    transformation: [
                        { quality: 'auto:good' },
                        { fetch_format: 'auto' }
                    ],
                    eager: [
                        { width: 640, height: 360, crop: 'pad', quality: 'auto:good' }, // Preview
                        { width: 1280, height: 720, crop: 'pad', quality: 'auto:good' } // HD
                    ],
                    eager_async: true, // Generar transformaciones en segundo plano
                    timeout: 60000 // 60 segundos de timeout
                },
                (error, result) => {
                    if (error) {
                        console.error('❌ Error subiendo a Cloudinary:', error);
                        reject(error);
                    } else {
                        console.log('✅ Video subido exitosamente a Cloudinary:', result.public_id);
                        resolve(result);
                    }
                }
            ).end(req.file.buffer);
        });

        // Crear nuevo clip con datos optimizados
        const newClip = {
            id: Date.now().toString(),
            title: clipTitle.trim(),
            description: clipDescription.trim(),
            type: clipType,
            club: clubSelect,
            filename: uploadResult.public_id, // Public ID para eliminación
            video_url: uploadResult.secure_url, // URL principal
            thumbnail_url: uploadResult.secure_url.replace('/video/upload/', '/video/upload/w_640,h_360,c_pad,q_auto:good/'), // Thumbnail optimizado
            duration: uploadResult.duration || 0, // Duración del video
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
        
        // Guardar clips localmente como backup
        await saveClipsLocally();
        
        // Emitir evento de nuevo clip
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
            error: 'Error interno del servidor al subir el clip' 
        });
    }
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
        console.log('🗑️ INICIANDO ELIMINACIÓN DE CLIP:', clipId);
        console.log('📊 Estado inicial - clips totales:', clips.length);
        
        const clipIndex = clips.findIndex(c => c.id === clipId);
        
        if (clipIndex === -1) {
            console.log('❌ Clip no encontrado con ID:', clipId);
            return res.status(404).json({ success: false, error: 'Clip no encontrado' });
        }
        
        const clip = clips[clipIndex];
        console.log('🎬 Clip encontrado:', {
            title: clip.title,
            id: clipId,
            index: clipIndex,
            filename: clip.filename
        });
        
        // Si el clip está en Cloudinary, intentar eliminarlo
        if (clip.filename) {
            try {
                console.log('☁️ Eliminando de Cloudinary:', clip.filename);
                await cloudinary.uploader.destroy(clip.filename, { resource_type: 'video' });
                console.log('✅ Clip eliminado de Cloudinary exitosamente');
            } catch (cloudinaryError) {
                console.warn('⚠️ Error eliminando de Cloudinary (continuando):', cloudinaryError.message);
            }
        }
        
        // Eliminar de la base de datos local
        console.log('🗂️ Eliminando del array local...');
        clips.splice(clipIndex, 1);
        console.log('📊 Clips restantes después de eliminación:', clips.length);
        
        // Actualizar estadísticas
        console.log('📈 Actualizando estadísticas...');
        const oldStats = { ...stats };
        stats.total_clips = clips.length;
        stats.total_views = clips.reduce((sum, c) => sum + (c.views || 0), 0);
        stats.total_likes = clips.reduce((sum, c) => sum + (c.likes || 0), 0);
        console.log('📊 Estadísticas actualizadas:', {
            antes: oldStats,
            después: stats
        });
        
        // Guardar cambios
        console.log('💾 Llamando a saveData() tras eliminación de clip...');
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

// Obtener equipos - USAR MONGODB DIRECTAMENTE
app.get('/api/teams', async (req, res) => {
    try {
        if (useDatabase) {
            const teams = await Team.find().sort({ name: 1 });
            console.log('✅ Equipos obtenidos desde MongoDB:', teams.length);
            res.json(teams);
        } else {
            console.log('⚠️ MongoDB no disponible, devolviendo array vacío');
            res.json([]);
        }
    } catch (error) {
        console.error('❌ Error obteniendo equipos desde MongoDB:', error);
        res.status(500).json({ error: 'Error obteniendo equipos' });
    }
});

// Obtener jugadores - USAR MONGODB DIRECTAMENTE
app.get('/api/players', async (req, res) => {
    try {
        if (useDatabase) {
            const players = await Player.find().sort({ name: 1 });
            console.log('✅ Jugadores obtenidos desde MongoDB:', players.length);
            res.json(players);
        } else {
            console.log('⚠️ MongoDB no disponible, devolviendo array vacío');
            res.json([]);
        }
    } catch (error) {
        console.error('❌ Error obteniendo jugadores desde MongoDB:', error);
        res.status(500).json({ error: 'Error obteniendo jugadores' });
    }
});

// Obtener clubes - USAR MONGODB DIRECTAMENTE
app.get('/api/clubs', async (req, res) => {
    try {
        if (useDatabase) {
            const clubs = await Club.find().sort({ name: 1 });
            console.log('✅ Clubes obtenidos desde MongoDB:', clubs.length);
            res.json(clubs);
        } else {
            console.log('⚠️ MongoDB no disponible, devolviendo array vacío');
            res.json([]);
        }
    } catch (error) {
        console.error('❌ Error obteniendo clubes desde MongoDB:', error);
        res.status(500).json({ error: 'Error obteniendo clubes' });
    }
});

// Eliminar equipo - USAR MONGODB DIRECTAMENTE
app.delete('/api/teams/:id', async (req, res) => {
    try {
        if (!useDatabase) {
            return res.status(400).json({ error: 'MongoDB no está disponible' });
        }
        
        const teamId = req.params.id;
        console.log('🗑️ Eliminando equipo con ID:', teamId);
        
        // Buscar y eliminar de MongoDB
        const deletedTeam = await Team.findByIdAndDelete(teamId);
        
        if (!deletedTeam) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }
        
        console.log('✅ Equipo eliminado de MongoDB:', deletedTeam.name);
        
        // También eliminar jugadores asociados
        const deletedPlayers = await Player.deleteMany({ clubName: deletedTeam.name });
        console.log('🏃 Jugadores eliminados:', deletedPlayers.deletedCount);
        
        // También eliminar club asociado
        const deletedClub = await Club.deleteOne({ name: deletedTeam.name });
        console.log('🏛️ Club eliminado:', deletedClub.deletedCount);
        
        // Emitir actualizaciones en tiempo real
        const remainingTeams = await Team.find().sort({ name: 1 });
        const remainingPlayers = await Player.find().sort({ name: 1 });
        const remainingClubs = await Club.find().sort({ name: 1 });
        
        io.emit('teamsUpdate', remainingTeams);
        io.emit('playersUpdate', remainingPlayers);
        io.emit('clubsUpdate', remainingClubs);
        
        res.json({ 
            success: true, 
            message: `Equipo '${deletedTeam.name}' eliminado exitosamente`,
            deletedPlayers: deletedPlayers.deletedCount,
            deletedClubs: deletedClub.deletedCount
        });
        
    } catch (error) {
        console.error('❌ Error eliminando equipo:', error);
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
        
        // AUTO-BACKUP inmediato para cambios críticos
        autoBackup('match_updated');
        
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
        
        // AUTO-BACKUP inmediato para cambios críticos
        autoBackup('match_deleted');
        
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
        
        if (!useDatabase) {
            return res.status(400).json({ error: 'MongoDB no está disponible' });
        }
        
        // Verificar si el equipo ya existe en MongoDB
        const existingTeam = await Team.findOne({ name: { $regex: new RegExp(`^${cleanName}$`, 'i') } });
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
        
        // Crear equipo en MongoDB
        const newTeam = new Team({
            name: cleanName,
            logo: logoUrl,
            founded: new Date().getFullYear(),
            stadium: ''
        });
        
        // Guardar en MongoDB
        const savedTeam = await newTeam.save();
        console.log('✅ Equipo guardado en MongoDB:', savedTeam.name);
        
        // Crear club asociado automáticamente
        const newClub = new Club({
            name: cleanName,
            description: `Club de fútbol ${cleanName}`,
            founded: new Date().getFullYear(),
            players: 0,
            logo: logoUrl
        });
        
        const savedClub = await newClub.save();
        console.log('✅ Club asociado creado:', savedClub.name)
        
        res.json({ success: true, team: savedTeam });
        
        // Recalcular tabla de posiciones
        updateStandingsFromMatches();
        saveData();
        
        // Emitir actualizaciones en tiempo real
        io.emit('teamsUpdate', teams);
        io.emit('standingsUpdate', standings);
        // Nota: Ya no emitimos clubsUpdate porque equipos y clubes son independientes
        
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

// Variables movidas al inicio del archivo para evitar problemas de inicialización
// (Ver líneas ~95 donde se declaran players y clubs)

// FUNCIÓN ELIMINADA: initializeClubs() - Equipos y clubes son ahora completamente independientes

// ==================== ANTI-SYNC BLOCKER ====================
// MECANISMO DE BLOQUEO PARA EVITAR SINCRONIZACIÓN AUTOMÁTICA
let BLOCK_AUTO_CLUB_CREATION = true;
let TEAMS_CLUBS_INDEPENDENT = true;

// Función para verificar si se debe bloquear la creación automática de clubes
function shouldBlockAutoClubCreation() {
    if (BLOCK_AUTO_CLUB_CREATION) {
        console.log('🚫 BLOQUEANDO creación automática de clubes - Equipos y clubes son independientes');
        return true;
    }
    return false;
}

// Función para prevenir cualquier sincronización automática
function preventAutoSync(operation, data) {
    if (TEAMS_CLUBS_INDEPENDENT) {
        console.log(`🚫 BLOQUEANDO sincronización automática para operación: ${operation}`);
        console.log('📋 Equipos y clubes son entidades completamente independientes');
        return true;
    }
    return false;
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
        
        // initializeClubs() ELIMINADO - equipos y clubes son independientes
        
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

// Clubes y equipos son ahora independientes - no se inicializan automáticamente
// initializeClubs(); // DESHABILITADO - equipos y clubes son independientes

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
        const { 
            playerName, name, 
            teamId, clubId, 
            playerAge, age, 
            playerPosition, position, 
            playerNumber, number, 
            playerNationality, nationality,
            goals, assists 
        } = req.body;
        
        console.log(`🔧 Actualizando jugador ${playerId}:`, req.body);
        
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
        const finalClubId = clubId || teamId;
        if (finalClubId) {
            const club = clubs.find(c => c.id === parseInt(finalClubId));
            if (club) {
                clubName = club.name;
            }
        }
        
        // Actualizar datos del jugador
        players[playerIndex] = {
            ...players[playerIndex],
            name: (playerName || name) ? (playerName || name).trim() : players[playerIndex].name,
            age: (playerAge || age) ? parseInt(playerAge || age) : players[playerIndex].age,
            position: (playerPosition || position) ? (playerPosition || position).trim() : players[playerIndex].position,
            number: (playerNumber || number) ? parseInt(playerNumber || number) : players[playerIndex].number,
            clubId: finalClubId ? parseInt(finalClubId) : players[playerIndex].clubId,
            clubName: clubName,
            nationality: (playerNationality || nationality) ? (playerNationality || nationality).trim() : players[playerIndex].nationality,
            goals: goals !== undefined ? parseInt(goals) || 0 : players[playerIndex].goals || 0,
            assists: assists !== undefined ? parseInt(assists) || 0 : players[playerIndex].assists || 0,
            photo: photoUrl,
            updatedAt: new Date().toISOString()
        };
        
        console.log(`✅ Jugador actualizado:`, {
            id: players[playerIndex].id,
            name: players[playerIndex].name,
            goals: players[playerIndex].goals,
            assists: players[playerIndex].assists
        });
        
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

// ==================== FUNCIONES OBSOLETAS ELIMINADAS ====================
// ❌ FUNCIONES ELIMINADAS que usaban arrays globales:
// - initializeTournamentTeams() → usaba tournament.teams (obsoleto)
// - updateStandingsFromMatches() → usaba standings array (obsoleto)
//
// ✅ NUEVA ARQUITECTURA:
// - Los equipos se obtienen directamente desde MongoDB con Team.find()
// - Las estadísticas se calculan desde los partidos en MongoDB con Match.find()
// - No hay inicialización de arrays globales porque no existen

console.log('✅ Inicialización completada - usando 100% MongoDB para datos');
console.log('🎥 Solo clips se mantienen temporalmente en memoria');

// ==================== MONGODB API ENDPOINTS ====================
// ✅ NUEVA ARQUITECTURA: Todos los endpoints usan MongoDB directamente
// ❌ ENDPOINTS OBSOLETOS ELIMINADOS que usaban arrays globales

// ✅ Eliminar un equipo (MongoDB)
app.delete('/api/teams/:id', async (req, res) => {
    try {
        const teamId = req.params.id;
        console.log('🗑️ Eliminando equipo desde MongoDB:', teamId);
        
        // Buscar y eliminar equipo en MongoDB
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
        
        console.log(`✅ Equipo "${deletedTeam.name}" eliminado de MongoDB`);
        
        res.json({ 
            success: true, 
            message: `Equipo "${deletedTeam.name}" eliminado exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error eliminando equipo:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor al eliminar equipo'
        });
    }
});

// ✅ Crear un nuevo equipo (MongoDB)
app.post('/api/teams', uploadImage.single('teamLogo'), async (req, res) => {
    try {
        const { name, founded, stadium } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'El nombre del equipo es requerido' });
        }
        
        // Verificar que no exista un equipo con el mismo nombre en MongoDB
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
                console.log('✅ Logo subido a Cloudinary:', logoUrl);
            } catch (error) {
                console.warn('⚠️ Error subiendo logo a Cloudinary:', error);
                // Continuar con logo por defecto si falla la subida
            }
        }
        
        // Crear nuevo equipo en MongoDB
        const newTeam = new Team({
            name: name.trim(),
            founded: founded ? parseInt(founded) : new Date().getFullYear(),
            stadium: stadium ? stadium.trim() : '',
            logo: logoUrl
        });
        
        // Guardar en MongoDB
        await newTeam.save();
        
        // Crear club asociado automáticamente en MongoDB
        const newClub = new Club({
            name: newTeam.name,
            founded: newTeam.founded,
            stadium: newTeam.stadium,
            logo: newTeam.logo,
            players: 0
        });
        
        await newClub.save();
        
        // Emitir actualizaciones WebSocket
        io.emit('teamsUpdate', { action: 'created', team: newTeam });
        io.emit('clubsUpdate', { action: 'created', club: newClub });
        
        console.log('✅ Equipo creado exitosamente:', newTeam.name);
        
        res.status(201).json({
            success: true,
            team: newTeam,
            club: newClub,
            message: `Equipo "${newTeam.name}" creado exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error creando equipo:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor al crear equipo',
            details: error.message 
        });
    }
});

// Actualizar un equipo
app.put('/api/teams/:id', uploadImage.single('teamLogo'), async (req, res) => {
    try {
        const teamId = req.params.id;
        const { name, founded, stadium } = req.body;
        
        // Buscar equipo
        const teamIndex = teams.findIndex(t => 
            t.id == teamId || 
            t.id === parseInt(teamId) || 
            t.id?.toString() === teamId
        );
        
        if (teamIndex === -1) {
            return res.status(404).json({ error: 'Equipo no encontrado' });
        }
        
        const team = teams[teamIndex];
        const oldName = team.name;
        
        // Verificar nombre único (excluyendo el equipo actual)
        if (name && name !== oldName) {
            const existingTeam = teams.find(t => t.id != teamId && t.name.toLowerCase() === name.toLowerCase());
            if (existingTeam) {
                return res.status(400).json({ error: 'Ya existe un equipo con ese nombre' });
            }
        }
        
        let logoUrl = team.logo;
        
        // Subir nuevo logo si se proporcionó
        if (req.file) {
            try {
                // Eliminar logo anterior de Cloudinary si existe
                if (team.logo && team.logo.includes('cloudinary')) {
                    const publicId = team.logo.split('/').pop().split('.')[0];
                    await cloudinary.uploader.destroy(`lpcp/teams/${publicId}`);
                }
                
                // Subir nuevo logo
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
                console.warn('⚠️ Error actualizando logo:', error);
            }
        }
        
        // Actualizar datos del equipo
        if (name) team.name = name.trim();
        if (founded) team.founded = parseInt(founded);
        if (stadium !== undefined) team.stadium = stadium.trim();
        team.logo = logoUrl;
        
        // Actualizar en tournament.teams
        const tournamentTeamIndex = tournament.teams.findIndex(t => t.id == teamId);
        if (tournamentTeamIndex !== -1) {
            const tournamentTeam = tournament.teams[tournamentTeamIndex];
            tournamentTeam.name = team.name;
            tournamentTeam.shortName = team.name.substring(0, 3).toUpperCase();
            tournamentTeam.logo = team.logo;
            tournamentTeam.stadium = team.stadium;
        }
        
        // Actualizar club asociado
        const clubIndex = clubs.findIndex(c => c.id == teamId);
        if (clubIndex !== -1) {
            clubs[clubIndex].name = team.name;
            clubs[clubIndex].founded = team.founded;
            clubs[clubIndex].stadium = team.stadium;
            clubs[clubIndex].logo = team.logo;
        }
        
        // Actualizar jugadores si cambió el nombre del equipo
        if (name && name !== oldName) {
            players.forEach(player => {
                if (player.clubName === oldName) {
                    player.clubName = team.name;
                }
            });
        }
        
        // Guardar cambios
        await saveData();
        
        // Emitir actualizaciones WebSocket
        io.emit('teamsUpdate', teams);
        io.emit('clubsUpdate', clubs);
        io.emit('playersUpdate', players);
        
        res.json({
            success: true,
            team: team,
            message: `Equipo actualizado exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error actualizando equipo:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor al actualizar equipo',
            details: error.message 
        });
    }
});

// ==================== CLUBS API ENDPOINTS ====================

// Eliminar un club
app.delete('/api/clubs/:id', async (req, res) => {
    try {
        const clubId = req.params.id;
        console.log('🗑️ Intentando eliminar club con ID:', clubId);
        
        // Buscar club
        const clubIndex = clubs.findIndex(c => 
            c.id == clubId || 
            c.id === parseInt(clubId) || 
            c.id?.toString() === clubId
        );
        
        if (clubIndex === -1) {
            return res.status(404).json({ error: 'Club no encontrado' });
        }
        
        const club = clubs[clubIndex];
        const clubName = club.name;
        
        // Eliminar club
        clubs.splice(clubIndex, 1);
        
        // Eliminar jugadores asociados
        const playersToRemove = players.filter(p => p.clubName === clubName);
        players = players.filter(p => p.clubName !== clubName);
        
        // Guardar cambios
        await saveData();
        
        // Emitir actualizaciones WebSocket
        io.emit('clubsUpdate', clubs);
        io.emit('playersUpdate', players);
        
        res.json({ 
            success: true, 
            message: `Club "${clubName}" eliminado exitosamente`,
            playersRemoved: playersToRemove.length
        });
        
    } catch (error) {
        console.error('❌ Error eliminando club:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor al eliminar club',
            details: error.message 
        });
    }
});

// ==================== PLAYERS API ENDPOINTS ====================

// Eliminar un jugador
app.delete('/api/players/:id', async (req, res) => {
    try {
        const playerId = req.params.id;
        console.log('🗑️ Intentando eliminar jugador con ID:', playerId);
        
        // Buscar jugador
        const playerIndex = players.findIndex(p => 
            p.id == playerId || 
            p.id === parseInt(playerId) || 
            p.id?.toString() === playerId
        );
        
        if (playerIndex === -1) {
            return res.status(404).json({ error: 'Jugador no encontrado' });
        }
        
        const player = players[playerIndex];
        const playerName = player.name;
        
        // Eliminar foto de Cloudinary si existe
        if (player.photo && player.photo.includes('cloudinary')) {
            try {
                const publicId = player.photo.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`lpcp/players/${publicId}`);
                console.log('🗑️ Foto eliminada de Cloudinary');
            } catch (error) {
                console.warn('⚠️ No se pudo eliminar la foto del jugador:', error);
            }
        }
        
        // Eliminar jugador
        players.splice(playerIndex, 1);
        
        // Guardar cambios
        await saveData();
        
        // Emitir actualizaciones WebSocket
        io.emit('playersUpdate', players);
        
        res.json({ 
            success: true, 
            message: `Jugador "${playerName}" eliminado exitosamente`
        });
        
    } catch (error) {
        console.error('❌ Error eliminando jugador:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor al eliminar jugador',
            details: error.message 
        });
    }
});

// ==================== WEBSOCKET CONFIGURATION ====================

// Configuración de WebSocket para actualizaciones en tiempo real
io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);
    
    // Manejar actualización de estadísticas de jugadores
    socket.on('playerStatsUpdated', (data) => {
        console.log(`📊 Estadísticas actualizadas - ${data.playerName}: ${data.statType} = ${data.value}`);
        
        // Emitir actualización a todos los clientes conectados
        io.emit('playersUpdate', players);
        
        // También emitir evento específico para estadísticas
        io.emit('playerStatsChanged', {
            playerId: data.playerId,
            playerName: data.playerName,
            statType: data.statType,
            value: data.value,
            timestamp: new Date().toISOString()
        });
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
    });
});

// ==================== ENDPOINTS DE LIMPIEZA MONGODB ====================

// Limpiar todos los equipos de MongoDB
app.delete('/api/admin/cleanup/teams', async (req, res) => {
    try {
        if (!useDatabase) {
            return res.status(400).json({ error: 'MongoDB no está disponible' });
        }
        
        console.log('🧹 Limpiando todos los equipos de MongoDB...');
        const result = await Team.deleteMany({});
        console.log(`✅ ${result.deletedCount} equipos eliminados de MongoDB`);
        
        // Limpiar también arrays locales
        teams.length = 0;
        tournament.teams.length = 0;
        
        // Emitir actualización
        io.emit('teamsUpdate', teams.length);
        
        res.json({ 
            success: true, 
            message: `${result.deletedCount} equipos eliminados de MongoDB`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('❌ Error limpiando equipos de MongoDB:', error);
        res.status(500).json({ error: 'Error limpiando equipos de MongoDB' });
    }
});

// Limpiar todos los clubes de MongoDB
app.delete('/api/admin/cleanup/clubs', async (req, res) => {
    try {
        if (!useDatabase) {
            return res.status(400).json({ error: 'MongoDB no está disponible' });
        }
        
        console.log('🧹 Limpiando todos los clubes de MongoDB...');
        const result = await Club.deleteMany({});
        console.log(`✅ ${result.deletedCount} clubes eliminados de MongoDB`);
        
        // Limpiar también array local
        clubs.length = 0;
        
        // Emitir actualización
        io.emit('clubsUpdate', clubs.length);
        
        res.json({ 
            success: true, 
            message: `${result.deletedCount} clubes eliminados de MongoDB`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('❌ Error limpiando clubes de MongoDB:', error);
        res.status(500).json({ error: 'Error limpiando clubes de MongoDB' });
    }
});

// Limpiar todos los jugadores de MongoDB
app.delete('/api/admin/cleanup/players', async (req, res) => {
    try {
        if (!useDatabase) {
            return res.status(400).json({ error: 'MongoDB no está disponible' });
        }
        
        console.log('🧹 Limpiando todos los jugadores de MongoDB...');
        const result = await Player.deleteMany({});
        console.log(`✅ ${result.deletedCount} jugadores eliminados de MongoDB`);
        
        // Limpiar también array local
        players.length = 0;
        
        // Emitir actualización
        io.emit('playersUpdate', players.length);
        
        res.json({ 
            success: true, 
            message: `${result.deletedCount} jugadores eliminados de MongoDB`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('❌ Error limpiando jugadores de MongoDB:', error);
        res.status(500).json({ error: 'Error limpiando jugadores de MongoDB' });
    }
});

// Limpiar todos los partidos de MongoDB
app.delete('/api/admin/cleanup/matches', async (req, res) => {
    try {
        if (!useDatabase) {
            return res.status(400).json({ error: 'MongoDB no está disponible' });
        }
        
        console.log('🧹 Limpiando todos los partidos de MongoDB...');
        const result = await Match.deleteMany({});
        console.log(`✅ ${result.deletedCount} partidos eliminados de MongoDB`);
        
        // Limpiar también array local
        matches.length = 0;
        
        res.json({ 
            success: true, 
            message: `${result.deletedCount} partidos eliminados de MongoDB`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('❌ Error limpiando partidos de MongoDB:', error);
        res.status(500).json({ error: 'Error limpiando partidos de MongoDB' });
    }
});

// Limpiar TODA la base de datos MongoDB (PELIGROSO - usar con cuidado)
app.delete('/api/admin/cleanup/all', async (req, res) => {
    try {
        if (!useDatabase) {
            return res.status(400).json({ error: 'MongoDB no está disponible' });
        }
        
        console.log('🧹 LIMPIEZA TOTAL DE MONGODB - ELIMINANDO TODO...');
        
        const teamsResult = await Team.deleteMany({});
        const clubsResult = await Club.deleteMany({});
        const playersResult = await Player.deleteMany({});
        const matchesResult = await Match.deleteMany({});
        
        console.log(`✅ LIMPIEZA COMPLETA:`);
        console.log(`   - ${teamsResult.deletedCount} equipos eliminados`);
        console.log(`   - ${clubsResult.deletedCount} clubes eliminados`);
        console.log(`   - ${playersResult.deletedCount} jugadores eliminados`);
        console.log(`   - ${matchesResult.deletedCount} partidos eliminados`);
        
        // Limpiar también arrays locales
        teams.length = 0;
        clubs.length = 0;
        players.length = 0;
        matches.length = 0;
        tournament.teams.length = 0;
        
        // Emitir actualizaciones
        io.emit('teamsUpdate', teams.length);
        io.emit('clubsUpdate', clubs.length);
        io.emit('playersUpdate', players.length);
        
        const totalDeleted = teamsResult.deletedCount + clubsResult.deletedCount + 
                           playersResult.deletedCount + matchesResult.deletedCount;
        
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
        console.error('❌ Error en limpieza total de MongoDB:', error);
        res.status(500).json({ error: 'Error en limpieza total de MongoDB' });
    }
});

// ==================== ENDPOINT DE LIMPIEZA MONGODB ====================

// Limpiar TODA la base de datos MongoDB (PELIGROSO - usar con cuidado)
app.delete('/api/admin/cleanup/all', async (req, res) => {
    try {
        if (!useDatabase) {
            return res.status(400).json({ error: 'MongoDB no está disponible' });
        }
        
        console.log('🧹 LIMPIEZA TOTAL DE MONGODB - ELIMINANDO TODO...');
        
        const teamsResult = await Team.deleteMany({});
        const clubsResult = await Club.deleteMany({});
        const playersResult = await Player.deleteMany({});
        const matchesResult = await Match.deleteMany({});
        
        console.log(`✅ LIMPIEZA COMPLETA:`);
        console.log(`   - ${teamsResult.deletedCount} equipos eliminados`);
        console.log(`   - ${clubsResult.deletedCount} clubes eliminados`);
        console.log(`   - ${playersResult.deletedCount} jugadores eliminados`);
        console.log(`   - ${matchesResult.deletedCount} partidos eliminados`);
        
        // Limpiar también arrays locales
        teams.length = 0;
        clubs.length = 0;
        players.length = 0;
        matches.length = 0;
        tournament.teams.length = 0;
        
        // Emitir actualizaciones
        io.emit('teamsUpdate', teams.length);
        io.emit('clubsUpdate', clubs.length);
        io.emit('playersUpdate', players.length);
        
        const totalDeleted = teamsResult.deletedCount + clubsResult.deletedCount + 
                           playersResult.deletedCount + matchesResult.deletedCount;
        
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
        console.error('❌ Error en limpieza total de MongoDB:', error);
        res.status(500).json({ error: 'Error en limpieza total de MongoDB' });
    }
});

// Inicializar datos al arrancar el servidor
loadTournamentData();

// Iniciar servidor
server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Panel admin: http://localhost:${PORT}/admin.html`);
    console.log(`🌐 Sitio web: http://localhost:${PORT}`);
});

// BACKUP DE EMERGENCIA: Ejecutar antes de cerrar el servidor
process.on('SIGTERM', async () => {
    console.log('🚨 SIGTERM recibido - Ejecutando backup de emergencia...');
    try {
        await forceBackup('SIGTERM_shutdown');
        console.log('✅ Backup de emergencia completado');
    } catch (error) {
        console.error('❌ Error en backup de emergencia:', error);
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🚨 SIGINT recibido - Ejecutando backup de emergencia...');
    try {
        await forceBackup('SIGINT_shutdown');
        console.log('✅ Backup de emergencia completado');
    } catch (error) {
        console.error('❌ Error en backup de emergencia:', error);
    }
    process.exit(0);
});

// Backup de emergencia antes de que Render reinicie el servidor
process.on('beforeExit', async () => {
    console.log('🚨 Proceso a punto de terminar - Backup final...');
    try {
        await forceBackup('before_exit');
    } catch (error) {
        console.error('❌ Error en backup final:', error);
    }
});

// Manejo de errores
process.on('uncaughtException', async (error) => {
    console.error('❌ Error no capturado:', error);
    // Backup de emergencia antes de crash
    try {
        await forceBackup('uncaught_exception');
    } catch (backupError) {
        console.error('❌ Error en backup de emergencia:', backupError);
    }
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    // Backup de emergencia
    try {
        await forceBackup('unhandled_rejection');
    } catch (backupError) {
        console.error('❌ Error en backup de emergencia:', backupError);
    }
});
