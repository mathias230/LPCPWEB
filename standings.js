// Standings page functionality - BACKEND CONNECTED VERSION
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando página de posiciones...');
    
    // Inicializar inmediatamente con datos básicos
    initializeStandings();
    setupEventListeners();
    
    // Cargar la pestaña por defecto (tabla de posiciones)
    switchTab('table');
    
    // Cargar datos del servidor de forma asíncrona
    loadAllData();
    createFloatingParticles();
    setupWebSocket();
    
    console.log('✅ Página de posiciones inicializada');
});

// WebSocket connection for real-time updates
function setupWebSocket() {
    console.log('🔌 Estableciendo conexión WebSocket...');
    
    const socket = io();
    
    socket.on('connect', () => {
        console.log('✅ Conectado al servidor WebSocket');
    });
    
    socket.on('standingsUpdate', (updatedStandings) => {
        console.log('📊 Actualizando tabla de posiciones...');
        standingsData = updatedStandings;
        if (document.querySelector('#table.active')) {
            loadStandingsTable();
        }
    });
    
    socket.on('matchesUpdate', (updatedMatches) => {
        console.log('⚽ Actualizando partidos...');
        
        // Separar partidos correctamente para evitar duplicados
        fixturesData = updatedMatches.filter(match => match.status === 'scheduled' || match.status === 'live');
        resultsData = updatedMatches.filter(match => match.status === 'finished');
        window.allMatchesForCalendar = updatedMatches;
        
        // Actualizar todas las pestañas que dependen de partidos
        if (document.querySelector('#fixtures.active')) {
            loadFixtures();
        }
        if (document.querySelector('#results.active')) {
            loadResults();
        }
        if (document.querySelector('#schedule.active')) {
            loadSchedule();
        }
        
        // IMPORTANTE: También actualizar la tabla de posiciones
        // ya que los partidos afectan las estadísticas de los equipos
        console.log('📊 Recalculando tabla de posiciones tras actualización de partidos...');
        loadStandingsData().then(() => {
            if (document.querySelector('#table.active')) {
                loadStandingsTable();
            }
        });
    });
    
    socket.on('teamsUpdate', (updatedTeams) => {
        console.log('👥 Actualizando equipos...');
        // Actualizar datos de equipos directamente
        teamsData = updatedTeams;
        console.log('✅ Equipos actualizados:', teamsData.length);
        
        // Si estamos en la pestaña de estadísticas, recargar
        if (document.querySelector('#stats.active')) {
            loadStats();
        }
        
        // Regenerar tabla de posiciones con nuevos equipos
        console.log('📊 Regenerando tabla de posiciones con nuevos equipos...');
        loadStandingsData();
        
        // Si estamos viendo la tabla, actualizarla inmediatamente
        if (document.querySelector('#table.active')) {
            loadStandingsTable();
        }
    });
    
    // Handler para actualizaciones de jugadores y estadísticas
    socket.on('playersUpdate', (updatedPlayers) => {
        console.log('🏃 Actualizando jugadores y estadísticas...');
        
        // Si estamos en la pestaña de estadísticas, recargar
        if (document.querySelector('#stats.active')) {
            console.log('📊 Recargando estadísticas tras actualización de jugadores...');
            loadStats();
        }
    });
    
    socket.on('playerStatsChanged', (data) => {
        console.log('⚽ Estadísticas de jugador actualizadas:', data);
        
        // Si estamos en la pestaña de estadísticas, recargar
        if (document.querySelector('#stats.active')) {
            console.log('📊 Recargando estadísticas tras cambio de stats...');
            loadStats();
        }
    });
    
    // Classification zones system removed
    
    socket.on('bracketUpdate', (updatedBracket) => {
        console.log('🏆 Actualizando bracket de playoffs vía WebSocket...');
        console.log('📋 Datos del bracket recibido:', updatedBracket);
        
        // Forzar actualización si estamos en la pestaña de playoffs
        if (document.querySelector('#playoffs.active')) {
            console.log('🔄 Recargando bracket dinámico...');
            renderDynamicBracket(updatedBracket);
        }
    });
    
    socket.on('playersUpdate', (updatedPlayers) => {
        console.log('👤 Actualizando estadísticas de jugadores...');
        playersStatsData = updatedPlayers;
        console.log('✅ Estadísticas de jugadores actualizadas:', playersStatsData.length);
        
        // Actualizar estadísticas rápidas (siempre visibles)
        displayQuickTopScorers(updatedPlayers);
        displayQuickTopAssisters(updatedPlayers);
        
        // Si estamos en la pestaña de estadísticas, recargar tablas principales
        if (document.querySelector('#stats.active')) {
            loadStats();
        } else {
            // Si no estamos en la pestaña de estadísticas, al menos actualizar el resumen
            updateStatsSummary(updatedPlayers);
        }
    });
    
    // Handlers específicos para eventos individuales de partidos
    socket.on('matchCreated', (newMatch) => {
        console.log('⚽ Nuevo partido creado:', newMatch);
        // Recargar datos de partidos y tabla de posiciones
        loadMatchesData().then(() => {
            // Actualizar pestañas activas
            if (document.querySelector('#fixtures.active')) {
                loadFixtures();
            }
            if (document.querySelector('#results.active')) {
                loadResults();
            }
            if (document.querySelector('#schedule.active')) {
                loadSchedule();
            }
        });
        
        // También actualizar tabla de posiciones
        loadStandingsData().then(() => {
            if (document.querySelector('#table.active')) {
                loadStandingsTable();
            }
        });
    });
    
    socket.on('matchUpdated', (updatedMatch) => {
        console.log('⚽ Partido actualizado:', updatedMatch);
        // Recargar datos de partidos y tabla de posiciones
        loadMatchesData().then(() => {
            // Actualizar pestañas activas
            if (document.querySelector('#fixtures.active')) {
                loadFixtures();
            }
            if (document.querySelector('#results.active')) {
                loadResults();
            }
            if (document.querySelector('#schedule.active')) {
                loadSchedule();
            }
        });
        
        // También actualizar tabla de posiciones
        loadStandingsData().then(() => {
            if (document.querySelector('#table.active')) {
                loadStandingsTable();
            }
        });
    });
    
    socket.on('matchDeleted', (data) => {
        console.log('⚽ Partido eliminado:', data);
        // Recargar datos de partidos y tabla de posiciones
        loadMatchesData().then(() => {
            // Actualizar pestañas activas
            if (document.querySelector('#fixtures.active')) {
                loadFixtures();
            }
            if (document.querySelector('#results.active')) {
                loadResults();
            }
            if (document.querySelector('#schedule.active')) {
                loadSchedule();
            }
        });
        
        // También actualizar tabla de posiciones
        loadStandingsData().then(() => {
            if (document.querySelector('#table.active')) {
                loadStandingsTable();
            }
        });
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Desconectado del servidor WebSocket');
    });
}

// Global variables
let currentMatchday = 1;
let maxMatchdays = 3; // Se actualiza dinámicamente basado en los partidos
let standingsData = [];
let fixturesData = [];
let resultsData = [];
// Classification zones variables removed
let tournamentSettings = {};
let teamsData = []; // Equipos dinámicos del backend
let playersStatsData = []; // Estadísticas de jugadores
let totalGoals = 0;
let totalAssists = 0;

// Función para obtener el número máximo de jornadas dinámicamente
function getMaxMatchdays() {
    if (!fixturesData || fixturesData.length === 0) {
        return 3; // Valor por defecto
    }
    
    // Encontrar la jornada más alta en los datos
    const maxMatchday = Math.max(...fixturesData.map(match => match.matchday || 1));
    maxMatchdays = Math.max(maxMatchday, 1); // Asegurar que sea al menos 1
    
    console.log(`📊 Jornadas detectadas dinámicamente: ${maxMatchdays}`);
    return maxMatchdays;
}

// Función para cargar equipos dinámicamente del backend
async function loadTeamsData() {
    try {
        console.log('👥 Cargando datos de equipos desde el backend...');
        const response = await fetch('/api/teams');
        if (response.ok) {
            teamsData = await response.json();
            console.log('✅ Equipos cargados:', teamsData.length);
            
            // Recargar tabla de posiciones si estamos en esa pestaña
            const tableTab = document.querySelector('#table');
            if (tableTab && tableTab.classList.contains('active')) {
                console.log('🔄 Recargando tabla de posiciones tras cargar equipos...');
                loadStandingsTable();
            }
        } else {
            console.warn('⚠️ No se pudieron cargar los equipos del backend, usando datos por defecto');
            teamsData = generateFallbackTeams();
            
            // Recargar tabla de posiciones si estamos en esa pestaña
            const tableTab = document.querySelector('#table');
            if (tableTab && tableTab.classList.contains('active')) {
                console.log('🔄 Recargando tabla de posiciones tras cargar equipos fallback...');
                loadStandingsTable();
            }
        }
    } catch (error) {
        console.error('❌ Error cargando equipos:', error);
        teamsData = generateFallbackTeams();
        
        // Recargar tabla de posiciones si estamos en esa pestaña
        const tableTab = document.querySelector('#table');
        if (tableTab && tableTab.classList.contains('active')) {
            console.log('🔄 Recargando tabla de posiciones tras error en equipos...');
            loadStandingsTable();
        }
    }
}

// Equipos por defecto como fallback
function generateFallbackTeams() {
    return [
        { name: 'ACP 507', logo: 'img/APC 507.png' },
        { name: 'BKS FC', logo: 'img/BKS FC.jpg' },
        { name: 'Coiner FC', logo: 'img/Coiner FC.jpg' },
        { name: 'FC WEST SIDE', logo: 'img/West side.jpg' },
        { name: 'Humacao FC', logo: 'img/Humacao fc.jpg' },
        { name: 'Jumpers FC', logo: 'img/Jumpers FC.jpg' },
        { name: 'LOS PLEBES Tk', logo: 'img/Los Plebes.jpg' },
        { name: 'Pura Vibra', logo: 'img/Pura vibra.png' },
        { name: 'Rayos X FC', logo: 'img/Rayos x FC.jpg' },
        { name: 'Tiki Taka FC', logo: 'img/Tiki taka FC.jpg' },
        { name: 'WEST SIDE PTY', logo: 'img/WEST SIDE PTY.jpg' }
    ];
}

function initializeStandings() {
    // Initialize typewriter effect
    typeWriter();
    
    // Initialize floating particles
    createFloatingParticles();
    
    // Set current season info
    updateSeasonInfo();
    
    // Force load standings immediately
    standingsData = generateFallbackStandings();
    loadStandingsTable();
}

function setupEventListeners() {
    console.log('🎯 Configurando event listeners...');
    
    // Tab navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    console.log('🔍 Botones encontrados:', tabBtns.length);
    
    tabBtns.forEach((btn, index) => {
        const tabId = btn.getAttribute('data-tab');
        console.log(`📌 Configurando botón ${index + 1}: ${tabId}`);
        
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Click en botón:', tabId);
            switchTab(tabId);
        });
    });

    // Matchday navigation
    const prevMatchday = document.getElementById('prevMatchday');
    const nextMatchday = document.getElementById('nextMatchday');
    const prevResultsMatchday = document.getElementById('prevResultsMatchday');
    const nextResultsMatchday = document.getElementById('nextResultsMatchday');
    
    if (prevMatchday) prevMatchday.addEventListener('click', () => changeMatchday(-1, 'fixtures'));
    if (nextMatchday) nextMatchday.addEventListener('click', () => changeMatchday(1, 'fixtures'));
    if (prevResultsMatchday) prevResultsMatchday.addEventListener('click', () => changeMatchday(-1, 'results'));
    if (nextResultsMatchday) nextResultsMatchday.addEventListener('click', () => changeMatchday(1, 'results'));

    // Modal functionality
    const modal = document.getElementById('matchModal');
    const closeBtn = document.getElementById('matchModalClose');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Mobile navigation
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }
}

function switchTab(tabId) {
    console.log('🔄 Cambiando a pestaña:', tabId);
    
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
    const tabContent = document.getElementById(tabId);
    
    if (tabBtn) {
        tabBtn.classList.add('active');
        console.log('✅ Botón activado:', tabId);
    } else {
        console.error('❌ No se encontró botón para:', tabId);
    }
    
    if (tabContent) {
        tabContent.classList.add('active');
        console.log('✅ Contenido activado:', tabId);
    } else {
        console.error('❌ No se encontró contenido para:', tabId);
    }
    
    // Load content based on tab
    switch(tabId) {
        case 'table':
            console.log('📊 Cargando tabla de posiciones...');
            loadStandingsTable();
            break;
        case 'fixtures':
            console.log('📅 Cargando partidos...');
            loadFixtures();
            break;
        case 'results':
            console.log('📋 Cargando resultados...');
            loadResults();
            break;
        case 'playoffs':
            console.log('🏆 Cargando playoffs...');
            loadPlayoffs();
            break;
        case 'copa':
            console.log('👑 Cargando copa...');
            loadCopa();
            break;
        case 'schedule':
            console.log('📆 Cargando calendario...');
            loadSchedule();
            break;
        case 'stats':
            console.log('📈 Cargando estadísticas...');
            loadStats();
            break;
        default:
            console.warn('⚠️ Pestaña desconocida:', tabId);
    }
    
    console.log('✅ Cambio de pestaña completado:', tabId);
}

// Función para cargar Copa de la Liga
function loadCopa() {
    console.log('👑 Iniciando loadCopa...');
    const copaContainer = document.getElementById('copa');
    
    if (!copaContainer) {
        console.error('❌ No se encontró contenedor de copa');
        return;
    }
    
    // El contenido ya existe en el HTML, solo asegurar que sea visible
    console.log('✅ Copa de la Liga cargada correctamente');
}

// Función para cargar resultados
function loadResults() {
    console.log('📋 Iniciando loadResults...');
    console.log('✅ Resultados cargados correctamente');
}

// Función para cargar calendario
function loadSchedule() {
    console.log('📆 Iniciando loadSchedule...');
    console.log('✅ Calendario cargado correctamente');
}

// Función para cargar Playoffs
function loadPlayoffs() {
    console.log('🏆 Iniciando loadPlayoffs...');
    // El contenido ya existe en el HTML con el bracket visual
    console.log('✅ Playoffs cargados correctamente');
}

async function loadAllData() {
    console.log('📥 Cargando todos los datos...');
    
    // Mostrar indicador de carga
    showLoadingIndicator();
    
    try {
        // Cargar configuración del torneo (síncrono, rápido)
        loadTournamentSettings();
        
        console.log('⏳ Cargando datos principales...');
        
        // Cargar datos principales en paralelo para mayor velocidad
        const [teamsResult, standingsResult, matchesResult] = await Promise.allSettled([
            retryAsync(() => loadTeamsData(), 3, 1000),
            retryAsync(() => loadStandingsData(), 3, 1000),
            retryAsync(() => loadMatchesData(), 3, 1000)
        ]);
        
        // Verificar resultados y usar fallbacks si es necesario
        if (teamsResult.status === 'rejected') {
            console.warn('⚠️ Error cargando equipos, usando fallback');
            teamsData = generateFallbackTeams();
        }
        
        if (standingsResult.status === 'rejected') {
            console.warn('⚠️ Error cargando posiciones, usando fallback');
            standingsData = generateFallbackStandings();
        }
        
        if (matchesResult.status === 'rejected') {
            console.warn('⚠️ Error cargando partidos, usando arrays vacíos');
            fixturesData = [];
            resultsData = [];
            window.allMatchesForCalendar = [];
        }
        
        // Actualizar jornadas máximas basado en partidos
        getMaxMatchdays();
        
        console.log('📊 Cargando estadísticas de jugadores...');
        
        // Cargar estadísticas (opcional, no bloquea la UI)
        try {
            // Usar la función de estadísticas que realmente existe
            await retryAsync(() => loadMainStatistics(), 2, 500);
        } catch (error) {
            console.warn('⚠️ Error cargando estadísticas de jugadores:', error.message);
            // Las estadísticas son opcionales, no afectan la funcionalidad principal
        }
        
        console.log('✅ Todos los datos cargados exitosamente');
        
    } catch (error) {
        console.error('❌ Error crítico cargando datos:', error);
        
        // Usar todos los datos de respaldo
        console.log('🔄 Usando todos los datos de respaldo...');
        standingsData = generateFallbackStandings();
        fixturesData = [];
        resultsData = [];
        window.allMatchesForCalendar = [];
        teamsData = generateFallbackTeams();
    } finally {
        // Ocultar indicador de carga
        hideLoadingIndicator();
        
        // Cargar la pestaña activa
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            const tabId = activeTab.getAttribute('data-tab');
            switchTab(tabId);
        } else {
            // Por defecto mostrar la tabla de posiciones
            switchTab('table');
        }
        
        console.log('🎯 Página de posiciones lista para usar');
    }
}

// ============ FUNCIONES AUXILIARES DE OPTIMIZACIÓN ============

// Función para reintentar operaciones asíncronas automáticamente
async function retryAsync(fn, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await fn();
            return result;
        } catch (error) {
            console.warn(`⚠️ Intento ${i + 1}/${retries} falló:`, error.message);
            
            if (i === retries - 1) {
                throw error; // Último intento, lanzar error
            }
            
            // Esperar antes del siguiente intento
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Mostrar indicador de carga global
function showLoadingIndicator() {
    // Crear indicador si no existe
    let indicator = document.getElementById('global-loading-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'global-loading-indicator';
        indicator.innerHTML = `
            <div class="loading-overlay">
                <div class="loading-spinner"></div>
                <div class="loading-text">Cargando datos...</div>
            </div>
        `;
        indicator.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            backdrop-filter: blur(3px);
        `;
        
        // Estilos para el contenido
        const style = document.createElement('style');
        style.textContent = `
            .loading-overlay {
                text-align: center;
                color: white;
                font-family: 'Roboto', sans-serif;
            }
            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 4px solid rgba(255, 255, 255, 0.3);
                border-top: 4px solid #00ff88;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            .loading-text {
                font-size: 18px;
                font-weight: 500;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(indicator);
    }
    
    indicator.style.display = 'flex';
    console.log('🔄 Indicador de carga mostrado');
}

// Ocultar indicador de carga global
function hideLoadingIndicator() {
    const indicator = document.getElementById('global-loading-indicator');
    if (indicator) {
        indicator.style.display = 'none';
        console.log('✅ Indicador de carga ocultado');
    }
}

// Función para hacer las llamadas API más robustas con timeout
async function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Timeout: La petición a ${url} tardó más de ${timeout}ms`);
        }
        throw error;
    }
}

// Cargar configuración del torneo
async function loadTournamentSettings() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            tournamentSettings = await response.json();
            
            // Classification zones system removed
        }
    } catch (error) {
        console.error('Error loading tournament settings:', error);
        // Classification zones system removed
    }
}

async function loadStandingsData() {
    try {
        console.log('📊 Cargando datos de posiciones...');
        const response = await fetchWithTimeout('/api/standings', {}, 3000);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Datos de posiciones cargados exitosamente:', data?.length || 0, 'equipos');
        standingsData = data || [];
        
        return data;
        
    } catch (error) {
        console.error('❌ Error cargando posiciones:', error.message);
        
        // Usar datos de respaldo si el servidor no está disponible
        standingsData = generateFallbackStandings();
        console.log('🔄 Usando datos de posiciones de respaldo');
        
        throw error; // Re-lanzar para que retryAsync pueda manejarlo
    }
}

// Función para cargar equipos desde el backend
async function loadTeamsData() {
    try {
        console.log('👥 Cargando datos de equipos...');
        const response = await fetchWithTimeout('/api/teams', {}, 3000);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Datos de equipos cargados exitosamente:', data?.length || 0, 'equipos');
        teamsData = data || [];
        
        return data;
        
    } catch (error) {
        console.error('❌ Error cargando equipos:', error.message);
        
        // Usar datos de respaldo si el servidor no está disponible
        teamsData = generateFallbackTeams();
        console.log('🔄 Usando datos de equipos de respaldo');
        
        throw error; // Re-lanzar para que retryAsync pueda manejarlo
    }
}

async function loadMatchesData() {
    try {
        console.log('⚽ Cargando datos de partidos...');
        const response = await fetch('/api/matches');
        const data = await response.json();
        
        console.log('🔍 DATOS RECIBIDOS DEL SERVIDOR:', data);
        console.log('🔍 CANTIDAD DE PARTIDOS RECIBIDOS:', data ? data.length : 0);
        
        if (data && data.length > 0) {
            // Guardar todos los partidos en una variable separada para el calendario
            const allMatchesData = data;
            
            // Separar partidos por estado para las otras pestañas
            fixturesData = data.filter(match => match.status === 'scheduled' || match.status === 'live');
            resultsData = data.filter(match => match.status === 'finished');
            
            console.log(`📊 Partidos programados: ${fixturesData.length}`);
            console.log(`📊 Partidos terminados: ${resultsData.length}`);
            console.log(`📊 Total de partidos: ${allMatchesData.length}`);
            
            // Para el calendario, usar todos los partidos
            window.allMatchesForCalendar = allMatchesData;
            
        } else {
            // Si no hay partidos en el servidor, usar arrays vacíos
            fixturesData = [];
            resultsData = [];
            window.allMatchesForCalendar = [];
            console.log('📋 No hay partidos en el servidor - usando arrays vacíos');
        }
        
        // Actualizar jornadas máximas dinámicamente
        getMaxMatchdays();
        
        return data;
        
    } catch (error) {
        console.error('❌ Error cargando partidos:', error.message);
        console.log('🔄 Usando arrays vacíos por error de conexión...');
        fixturesData = [];
        resultsData = [];
        window.allMatchesForCalendar = [];
        
        // Actualizar jornadas máximas dinámicamente
        getMaxMatchdays();
        
        throw error; // Re-lanzar para que retryAsync pueda manejarlo
    }
}

// Fallback standings if server is unavailable
function generateFallbackStandings() {
    // Si no hay equipos reales, retornar array vacío
    if (!teamsData || teamsData.length === 0) {
        console.log('⚠️ No hay equipos reales, retornando standings vacíos');
        return [];
    }
    
    console.log('🔧 Generando standings con equipos:', teamsData.map(t => t.name));
    
    // Solo usar equipos reales
    const fallbackTeams = teamsData;
    
    const standings = fallbackTeams.map((team, index) => ({
        position: index + 1,
        team: team.name || 'Equipo sin nombre', // Asegurar que siempre hay un nombre
        played: 0,       // Partidos jugados
        won: 0,          // Partidos ganados
        drawn: 0,        // Empates
        lost: 0,         // Partidos perdidos
        goalsFor: 0,     // Goles a favor
        goalsAgainst: 0,  // Goles en contra
        goalDifference: 0,// Diferencia de goles
        points: 0        // Puntos
    })).sort((a, b) => b.points - a.points).map((team, index) => ({ ...team, position: index + 1 }));
    
    console.log('✅ Standings generados:', standings.map(s => `${s.position}. ${s.team}`));
    return standings;
}

// Generate sample fixtures for demonstration - Updated for 3 matchdays with 6 matches each
function generateSampleFixtures() {
    // Usar una semilla fija para que los resultados sean consistentes
    const seed = 42;
    const random = (min, max) => {
        const x = Math.sin(seed + max + min) * 10000;
        return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
    };
    
    const teamNames = teamsData.map(team => team.name);
    const fixtures = [];
    const today = new Date();
    
    // Función para generar partidos de una jornada específica
    const generateMatchdayFixtures = (matchday) => {
        // Todos los partidos son el 27 de julio
        const matchDate = new Date('2025-07-27');
        // Jornada 1: 6:00 PM, Jornada 2: 6:30 PM, Jornada 3: 7:00 PM
        const horaBase = 18 + ((matchday - 1) * 0.5); // 18:00, 18:30, 19:00
        
        // Definir los partidos para cada jornada
        const partidosPorJornada = {
            1: [
                { home: 'BKS FC', away: 'Rayos X FC' },
                { home: 'Punta Coco FC', away: 'FC WEST SIDE' },
                { home: 'Coiner FC', away: 'ACP 507' },
                { home: 'WEST SIDE PTY', away: 'Humacao FC' },
                { home: 'LOS PLEBES Tk', away: 'Jumpers FC' },
                { home: 'Tiki Taka FC', away: 'Pura Vibra' }
            ],
            2: [
                { home: 'Humacao FC', away: 'LOS PLEBES Tk' },
                { home: 'Jumpers FC', away: 'Coiner FC' },
                { home: 'Rayos X FC', away: 'Punta Coco FC' },
                { home: 'Pura Vibra', away: 'ACP 507' },
                { home: 'FC WEST SIDE', away: 'WEST SIDE PTY' },
                { home: 'BKS FC', away: 'Tiki Taka FC' }
            ],
            3: [
                { home: 'Coiner FC', away: 'LOS PLEBES Tk' },
                { home: 'Humacao FC', away: 'Rayos X FC' },
                { home: 'ACP 507', away: 'BKS FC' },
                { home: 'Punta Coco FC', away: 'Pura Vibra' },
                { home: 'Tiki Taka FC', away: 'FC WEST SIDE' },
                { home: 'WEST SIDE PTY', away: 'Jumpers FC' }
            ]
        };
        
        // Obtener los partidos para la jornada actual
        const partidosJornada = partidosPorJornada[matchday] || [];
        
        // Estado basado en la jornada
        const estadosPorJornada = {
            1: { status: 'scheduled', statusText: 'Por jugar' },
            2: { status: 'scheduled', statusText: 'Por jugar' },
            3: { status: 'scheduled', statusText: 'Por jugar' }
        };
        
        // Agregar cada partido de la jornada
        partidosJornada.forEach((partido, index) => {
            // Todos los partidos de la misma jornada tienen la misma hora base
            const hora = Math.floor(horaBase);
            const minutos = (horaBase % 1) * 60;
            const matchTime = `${hora.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
            const estado = estadosPorJornada[matchday] || { status: 'scheduled', statusText: 'Por jugar' };
            
            fixtures.push({
                id: `match-${matchday}-${index + 1}`,
                matchday: matchday,
                date: matchDate.toISOString().split('T')[0],
                time: matchTime,
                homeTeam: partido.home,
                awayTeam: partido.away,
                homeScore: null,
                awayScore: null,
                status: estado.status,
                venue: 'Estadio ASP',
                competition: 'Liga ASP 2024',
                round: `Jornada ${matchday}`,
                statusText: estado.statusText
            });
        });
    };
    
    // Generar las 3 jornadas de partidos
    for (let matchday = 1; matchday <= 3; matchday++) {
        generateMatchdayFixtures(matchday);
    }
    
    console.log('📋 Generados', fixtures.length, 'partidos de ejemplo');
    return fixtures;
}

// Load and display standings table - FIXED VERSION
async function loadStandingsTable() {
    console.log('🔄 Loading standings table...');
    console.log('🔍 DEBUG: teamsData:', teamsData);
    console.log('🔍 DEBUG: teamsData.length:', teamsData ? teamsData.length : 'undefined');
    console.log('🔍 DEBUG: standingsData:', standingsData);
    console.log('🔍 DEBUG: standingsData.length:', standingsData ? standingsData.length : 'undefined');
    
    const tableBody = document.getElementById('standingsTableBody');
    if (!tableBody) {
        console.error('❌ No se encontró standingsTableBody');
        return;
    }
    
    // Classification zones system removed
    
    // Siempre generar equipos de ejemplo para evitar pantalla en negro
    if (!teamsData || teamsData.length === 0) {
        console.log('⚠️ No hay equipos en el sistema, generando equipos de ejemplo');
        teamsData = generateFallbackTeams();
    }
    
    // Siempre generar datos de clasificación para evitar pantalla en negro
    if (!standingsData || standingsData.length === 0) {
        console.log('No hay datos de clasificación disponibles, generando datos base para equipos existentes...');
        standingsData = generateFallbackStandings();
        console.log(`✅ Generados datos base para ${standingsData.length} equipos`);
    }
    
    // Classification zones styles removed
    
    // Ordenar los datos por posición
    const sortedStandings = [...standingsData].sort((a, b) => a.position - b.position);
    
    tableBody.innerHTML = sortedStandings.map(teamData => {
        // Debug: mostrar datos del equipo
        console.log('🔍 Procesando equipo:', teamData);
        
        // Asegurarse de que teamData.team sea un string y no un objeto
        // Los datos pueden venir como 'team' o 'teamName' dependiendo del endpoint
        const teamName = teamData.teamName || teamData.team || (typeof teamData.team === 'object' ? teamData.team.name : teamData.team);
        console.log('🔍 Nombre del equipo extraído:', teamName);
        
        // Encontrar el equipo en los datos dinámicos para obtener el logo
        const teamInfo = teamsData.find(t => t.name === teamName) || { 
            name: teamName || 'Equipo desconocido', 
            logo: 'img/default-team.png' 
        };
        
        console.log('🔍 Info del equipo encontrada:', teamInfo);
        
        // Si el logo no se encuentra, usar una imagen por defecto
        const logoPath = teamInfo.logo || 'img/default-team.png';
        
        return `
        <tr>
            <td class="position">${teamData.position}</td>
            <td class="team">
                <div class="team-info">
                    <img src="${logoPath}" alt="${teamInfo.name}" class="team-logo" onerror="this.onerror=null; this.src='img/default-team.png'">
                    <span class="team-name">${teamInfo.name}</span>
                </div>
            </td>
            <td>${teamData.played || 0}</td>
            <td>${teamData.won || 0}</td>
            <td>${teamData.drawn || 0}</td>
            <td>${teamData.lost || 0}</td>
            <td>${teamData.goalsFor || 0}</td>
            <td>${teamData.goalsAgainst || 0}</td>
            <td class="${(teamData.goalDifference || 0) >= 0 ? 'positive' : 'negative'}">
                ${(teamData.goalDifference || 0) >= 0 ? '+' : ''}${teamData.goalDifference || 0}
            </td>
            <td class="points">${teamData.points || 0}</td>
        </tr>
        `;
    }).join('');
    
    // Classification zones colors removed
    
    console.log('✅ Tabla de posiciones cargada con', standingsData.length, 'equipos');
}

// Función de estilos dinámicos eliminada

// Función de leyenda eliminada

// Show notification to user
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
    }
    
    notification.className = `notification ${type} show`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
    `;
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// Load fixtures tab with matchday navigation
function loadFixtures() {
    console.log('🎯 Iniciando loadFixtures...');
    const fixturesContainer = document.getElementById('fixturesContainer');
    if (!fixturesContainer) {
        console.error('❌ No se encontró fixturesContainer');
        return;
    }
    
    console.log('📊 fixturesData disponible:', fixturesData);
    console.log('📊 Cantidad de partidos:', fixturesData ? fixturesData.length : 0);
    console.log('📊 teamsData disponible:', teamsData);
    console.log('📊 Cantidad de equipos:', teamsData ? teamsData.length : 0);
    
    // Siempre mostrar contenido para evitar pantalla negra
    if (!fixturesData || fixturesData.length === 0) {
        console.warn('⚠️ No hay datos de partidos disponibles, mostrando contenido placeholder');
        fixturesContainer.innerHTML = `
            <div class="fixtures-container">
                <h2 class="section-title">
                    <i class="fas fa-calendar-check"></i>
                    Próximos Partidos
                </h2>
                <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.7);">
                    <i class="fas fa-futbol" style="font-size: 48px; margin-bottom: 20px; display: block; color: var(--accent-cyan);"></i>
                    <p>Los partidos aparecerán aquí una vez que se programen.</p>
                    <button onclick="loadAllData()" style="background: var(--accent-green); color: #000; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 10px;">
                        Recargar datos
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    // Actualizar número máximo de jornadas dinámicamente
    const maxJornadas = getMaxMatchdays();
    
    // Get current matchday fixtures (up to 6 matches)
    console.log('🔍 DEBUG FIXTURES: currentMatchday =', currentMatchday);
    console.log('🔍 DEBUG FIXTURES: fixturesData =', fixturesData);
    console.log('🔍 DEBUG FIXTURES: primer partido =', fixturesData[0]);
    
    const matchdayFixtures = fixturesData
        .filter(match => {
            console.log('🔍 FILTRO: match.matchday =', match.matchday, 'vs currentMatchday =', currentMatchday);
            // Si matchday es undefined, asumimos que es jornada 1
            const matchMatchday = match.matchday || 1;
            return matchMatchday === currentMatchday;
        })
        .slice(0, 6); // Ensure we only show 6 matches per matchday
        
    console.log('🔍 DEBUG FIXTURES: matchdayFixtures filtrados =', matchdayFixtures);
    console.log('🔍 DEBUG FIXTURES: cantidad filtrada =', matchdayFixtures.length);
    
    // Create matchday navigation controls
    const navigationHTML = `
        <div class="matchday-navigation">
            <button class="nav-arrow" onclick="changeMatchday('prev', 'fixtures')" ${currentMatchday === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
            
            <div class="matchday-info">
                <h3>Jornada ${currentMatchday}</h3>
                <span>${matchdayFixtures.length} partidos | ${currentMatchday}/${maxJornadas}</span>
            </div>
            
            <button class="nav-arrow" onclick="changeMatchday('next', 'fixtures')" ${currentMatchday >= maxJornadas ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;
    
    // Update fixtures container with navigation
    fixturesContainer.innerHTML = navigationHTML;
    
    const fixturesGrid = document.getElementById('fixturesGrid');
    if (!fixturesGrid) return;
    
    if (matchdayFixtures.length === 0) {
        fixturesGrid.innerHTML = `
            <div class="no-matches">
                <i class="fas fa-calendar-times"></i>
                <p>No hay partidos programados para la Jornada ${currentMatchday}</p>
            </div>
        `;
        return;
    }
    
    // Display matches in the grid
    fixturesGrid.innerHTML = matchdayFixtures.map(match => createMatchCard(match)).join('');
    
    // Add click handlers to match cards
    document.querySelectorAll('.match-card').forEach(card => {
        card.addEventListener('click', () => {
            const matchId = card.dataset.matchId;
            const match = matchdayFixtures.find(m => m.id === matchId);
            if (match) {
                showMatchDetails(match);
            }
        });
    });
}

// Load results tab
function loadResults() {
    console.log('📋 Iniciando loadResults...');
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsGrid = document.getElementById('resultsGrid');

    if (!resultsGrid && !resultsContainer) {
        console.error('❌ No se encontró contenedor de resultados');
        return;
    }

    // Si no hay contenedor específico, usar el general
    const container = resultsGrid || resultsContainer;

    // Actualizar número máximo de jornadas dinámicamente
    const maxJornadas = getMaxMatchdays();

    // Filtrar partidos terminados de la jornada actual desde fixturesData
    const matchdayResults = fixturesData.filter(match => {
        // Si matchday es undefined, asumimos que es jornada 1
        const matchMatchday = match.matchday || 1;
        // Solo mostrar partidos terminados en la pestaña de resultados
        return matchMatchday === currentMatchday && match.status === 'finished';
    });
    
    // Create matchday navigation controls for results
    if (resultsContainer) {
        const navigationHTML = `
            <div class="matchday-navigation">
                <button class="nav-arrow" onclick="changeMatchday('prev', 'results')" ${currentMatchday === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
                
                <div class="matchday-info">
                    <h3>Jornada ${currentMatchday}</h3>
                    <span>${matchdayResults.length} resultados | ${currentMatchday}/${maxJornadas}</span>
                </div>
                
                <button class="nav-arrow" onclick="changeMatchday('next', 'results')" ${currentMatchday >= maxJornadas ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
        
        // Update results container with navigation
        resultsContainer.innerHTML = navigationHTML;
    }
    
    if (matchdayResults.length === 0) {
        container.innerHTML = `
            <div class="results-container">
                <h2 class="section-title">
                    <i class="fas fa-history"></i>
                    Resultados Recientes
                </h2>
                <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.7);">
                    <i class="fas fa-trophy" style="font-size: 48px; margin-bottom: 20px; display: block; color: var(--accent-purple);"></i>
                    <p>Los resultados aparecerán aquí después de los partidos.</p>
                </div>
            </div>
        `;
        return;
    }
    
    resultsGrid.innerHTML = matchdayResults.map(match => createResultCard(match)).join('');
    
    // Update matchday display (fallback for legacy elements)
    const matchdaySpan = document.getElementById('resultsMatchday');
    if (matchdaySpan) {
        matchdaySpan.textContent = `Jornada ${currentMatchday}`;
    }
}

// Load schedule tab
function loadSchedule() {
    const scheduleTimeline = document.getElementById('scheduleTimeline');
    if (!scheduleTimeline) return;
    
    // Usar exactamente los mismos datos que usa la pestaña "Partidos"
    // Combinar fixturesData (programados) y resultsData (terminados)
    const scheduledMatches = fixturesData || [];
    const finishedMatches = resultsData || [];
    const allMatches = [...scheduledMatches, ...finishedMatches];
    const matchdayGroups = {};
    
    console.log('📅 Cargando calendario con', allMatches.length, 'partidos');
    console.log('📅 Partidos programados:', scheduledMatches.length);
    console.log('📅 Partidos terminados:', finishedMatches.length);
    
    allMatches.forEach(match => {
        if (!matchdayGroups[match.matchday]) {
            matchdayGroups[match.matchday] = [];
        }
        matchdayGroups[match.matchday].push(match);
    });
    
    const sortedMatchdays = Object.keys(matchdayGroups).sort((a, b) => parseInt(a) - parseInt(b));
    
    scheduleTimeline.innerHTML = sortedMatchdays.map(matchday => 
        createMatchdayElement(parseInt(matchday), matchdayGroups[matchday])
    ).join('');
    
    // Update schedule stats
    updateScheduleStats(allMatches);
}

// Create match card for fixtures
function createMatchCard(match) {
    // Base64 encoded transparent 1x1 pixel as fallback
    const transparentPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    
    // Get team info with fallback to default values
    const homeTeamInfo = teamsData.find(t => t.name === match.homeTeam) || { 
        name: match.homeTeam, 
        logo: transparentPixel 
    };
    
    const awayTeamInfo = teamsData.find(t => t.name === match.awayTeam) || { 
        name: match.awayTeam, 
        logo: transparentPixel 
    };
    
    // Determine match status class
    const statusClass = match.status === 'finished' ? 'finished' : 
                       match.status === 'live' ? 'live' : 'upcoming';
    
    // Format date
    const matchDate = match.date ? 
        new Date(match.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 
        'Fecha por definir';
    
    // Create image with error handling
    const createTeamLogo = (teamInfo) => {
        return `
            <div class="team-logo-container">
                <img 
                    src="${teamInfo.logo}" 
                    alt="${teamInfo.name}" 
                    class="team-logo" 
                    onerror="this.onerror=null; this.src='${transparentPixel}';"
                    loading="lazy"
                >
            </div>
            <span class="team-name">${teamInfo.name}</span>
        `;
    };
    
    return `
        <div class="match-card ${statusClass}" data-match-id="${match.id}">
            <div class="match-header">
                <span class="match-date">${matchDate}</span>
                <span class="match-time">${match.time || '--:--'}</span>
                ${match.status === 'live' ? '<span class="live-badge">EN VIVO</span>' : ''}
            </div>
            <div class="match-teams">
                <div class="team home-team">
                    ${createTeamLogo(homeTeamInfo)}
                </div>
                <div class="match-score">
                    ${match.status === 'scheduled' ? 'VS' : 
                      match.status === 'live' || match.status === 'finished' ? 
                      `<div class="score">${match.homeScore || '0'} - ${match.awayScore || '0'}</div>` : 
                      'VS'}
                </div>
                <div class="team away-team">
                    ${createTeamLogo(awayTeamInfo)}
                </div>
            </div>
            <div class="match-footer">
                <span class="match-venue">
                    <i class="fas fa-map-marker-alt"></i> ${match.venue || 'Por confirmar'}
                </span>
                <span class="match-status">${
                    match.status === 'finished' ? 'Finalizado' : 
                    match.status === 'live' ? 'En juego' : 'Próximamente'}
                </span>
            </div>
        </div>
    `;
}

// Create result card for finished matches
function createResultCard(match) {
    return `
        <div class="match-card finished" onclick="showMatchDetails(${JSON.stringify(match).replace(/"/g, '&quot;')})">
            <div class="match-header">
                <span class="match-date">${new Date(match.date).toLocaleDateString('es-ES')}</span>
                <span class="match-status">Finalizado</span>
            </div>
            <div class="match-teams">
                <div class="team home">
                    <i class="fas fa-shield-alt"></i>
                    <span>${match.homeTeam}</span>
                    <span class="score">${match.homeScore}</span>
                </div>
                <div class="vs">-</div>
                <div class="team away">
                    <span class="score">${match.awayScore}</span>
                    <span>${match.awayTeam}</span>
                    <i class="fas fa-shield-alt"></i>
                </div>
            </div>
            <div class="match-info">
                <i class="fas fa-map-marker-alt"></i>
                <span>${match.venue || 'Estadio'}</span>
            </div>
        </div>
    `;
}

// Create matchday element for schedule
function createMatchdayElement(matchday, matches) {
    return `
        <div class="matchday-group">
            <div class="matchday-header">
                <h3>Jornada ${matchday}</h3>
                <span class="matchday-date">${matches[0] ? new Date(matches[0].date).toLocaleDateString('es-ES') : ''}</span>
            </div>
            <div class="matchday-matches">
                ${matches.map(match => `
                    <div class="mini-match ${match.status}">
                        <span class="mini-team">${match.homeTeam}</span>
                        <span class="mini-score">
                            ${match.status === 'finished' ? `${match.homeScore}-${match.awayScore}` : 'vs'}
                        </span>
                        <span class="mini-team">${match.awayTeam}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Cambia la jornada actual y recarga el contenido correspondiente
 * @param {string|number} direction - Dirección del cambio ('prev', 'next') o número de jornada
 * @param {string} type - Tipo de contenido a actualizar ('fixtures' o 'results')
 */
function changeMatchday(direction, type) {
    // Obtener el número máximo de jornadas dinámicamente
    const maxJornadas = getMaxMatchdays();
    
    // Actualizar el número de jornada según la dirección
    if (direction === 'prev' && currentMatchday > 1) {
        currentMatchday--;
    } else if (direction === 'next' && currentMatchday < maxJornadas) {
        currentMatchday++;
    } else if (typeof direction === 'number' && direction >= 1 && direction <= maxJornadas) {
        // Si se pasa un número de jornada directamente
        currentMatchday = direction;
    }
    
    console.log(`🔄 Cambiando a jornada ${currentMatchday} de ${maxJornadas} jornadas disponibles`);
    
    // Recargar el contenido correspondiente
    if (type === 'fixtures') {
        loadFixtures();
    } else if (type === 'results') {
        loadResults();
    }
    
    // Scroll automático eliminado - mantener posición actual
}

function showMatchDetails(match) {
    const modal = document.getElementById('matchModal');
    const title = document.getElementById('matchModalTitle');
    const details = document.getElementById('matchDetails');
    
    if (!modal || !title || !details) return;
    
    title.textContent = `${match.homeTeam} vs ${match.awayTeam}`;
    
    details.innerHTML = `
        <div class="match-detail-content">
            <div class="match-detail-header">
                <div class="detail-teams">
                    <div class="detail-team">
                        <i class="fas fa-shield-alt"></i>
                        <span>${match.homeTeam}</span>
                    </div>
                    ${match.status === 'finished' ? `
                        <div class="detail-score">
                            <span>${match.homeScore} - ${match.awayScore}</span>
                        </div>
                    ` : `
                        <div class="detail-vs">VS</div>
                    `}
                    <div class="detail-team">
                        <i class="fas fa-shield-alt"></i>
                        <span>${match.awayTeam}</span>
                    </div>
                </div>
            </div>
            <div class="match-detail-info">
                <div class="detail-item">
                    <i class="fas fa-calendar"></i>
                    <span>Fecha: ${match.date}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-clock"></i>
                    <span>Hora: ${match.time}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-futbol"></i>
                    <span>Jornada: ${match.matchday}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-info-circle"></i>
                    <span>Estado: ${match.status === 'finished' ? 'Finalizado' : 'Por Jugar'}</span>
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

function updateSeasonInfo() {
    const currentMatchdaySpan = document.getElementById('currentMatchday');
    if (currentMatchdaySpan) {
        currentMatchdaySpan.textContent = `Jornada ${currentMatchday}`;
    }
}

function updateScheduleStats(matches) {
    const totalMatches = matches.length;
    const playedMatches = matches.filter(m => m.status === 'finished').length;
    const remainingMatches = totalMatches - playedMatches;
    
    const totalElement = document.getElementById('totalMatches');
    const playedElement = document.getElementById('playedMatches');
    const remainingElement = document.getElementById('remainingMatches');
    
    if (totalElement) totalElement.textContent = totalMatches;
    if (playedElement) playedElement.textContent = playedMatches;
    if (remainingElement) remainingElement.textContent = remainingMatches;
}

// Load playoffs tab
async function loadPlayoffs() {
    console.log('🏆 Loading playoffs bracket...');
    
    try {
        // Cargar bracket actual desde el backend
        const response = await fetch('/api/playoffs/bracket');
        if (response.ok) {
            const bracket = await response.json();
            console.log('📋 Bracket data received:', bracket);
            
            if (bracket && bracket.teams && bracket.matches) {
                console.log('✅ Rendering bracket with', bracket.matches.length, 'matches');
                renderDynamicBracket(bracket);
                console.log('✅ Bracket dinámico cargado:', bracket.format);
            } else {
                console.log('❌ No bracket data available');
                showEmptyBracketMessage();
            }
        } else {
            console.log('❌ Failed to fetch bracket, status:', response.status);
            showEmptyBracketMessage();
        }
    } catch (error) {
        console.error('Error loading bracket:', error);
        showEmptyBracketMessage();
    }
}

// Mostrar mensaje cuando no hay bracket generado
function showEmptyBracketMessage() {
    const playoffsContainer = document.querySelector('#playoffs .playoffs-bracket-visual');
    if (playoffsContainer) {
        playoffsContainer.innerHTML = `
            <div class="empty-bracket-message">
                <i class="fas fa-trophy" style="font-size: 3rem; color: #00ff88; margin-bottom: 1rem;"></i>
                <h3>No hay bracket de playoffs generado</h3>
                <p>El administrador aún no ha generado el bracket de playoffs.</p>
                <p>Una vez que se genere, aparecerá aquí automáticamente.</p>
            </div>
        `;
    }
    console.log('📋 Mostrando mensaje de bracket vacío');
}

// Renderizar bracket dinámico
function renderDynamicBracket(bracket) {
    const playoffsContainer = document.querySelector('#playoffs .playoffs-bracket-visual');
    if (!playoffsContainer) return;
    
    // Limpiar contenido existente
    playoffsContainer.innerHTML = '';
    
    // Crear estructura del bracket basada en el formato
    const { format, teams, matches } = bracket;
    
    // Crear título del bracket más compacto
    const bracketTitle = document.createElement('div');
    bracketTitle.className = 'bracket-title-compact';
    bracketTitle.innerHTML = `
        <h3><i class="fas fa-trophy"></i> Playoffs ${getFormatName(format)} - ${teams.length} equipos</h3>
    `;
    playoffsContainer.appendChild(bracketTitle);
    
    // Renderizar rondas del bracket
    renderBracketRounds(bracket, playoffsContainer);
    
    // Agregar estilos dinámicos para el bracket
    addBracketStyles();
    
    console.log('✅ Bracket dinámico renderizado:', format, 'equipos:', teams.length);
}

// Obtener nombre del formato
function getFormatName(format) {
    const formatNames = {
        '4': 'Semifinales',
        '8': 'Cuartos de Final', 
        '16': 'Octavos de Final'
    };
    return formatNames[format] || `${format} Equipos`;
}

// Renderizar rondas del bracket
function renderBracketRounds(bracket, container) {
    const { format, teams, matches } = bracket;
    
    // Crear contenedor de rondas más compacto
    const roundsContainer = document.createElement('div');
    roundsContainer.className = 'bracket-rounds-container';
    roundsContainer.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: flex-start;
        gap: 15px;
        padding: 10px;
        overflow-x: auto;
        max-width: 100%;
    `;
    
    // Organizar partidos por ronda
    const matchesByRound = {};
    matches.forEach(match => {
        if (!matchesByRound[match.round]) {
            matchesByRound[match.round] = [];
        }
        matchesByRound[match.round].push(match);
    });
    
    // Renderizar cada ronda
    Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b)).forEach(round => {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'bracket-round';
        roundDiv.style.cssText = `
            flex: 0 0 auto;
            min-width: 180px;
            max-width: 200px;
        `;
        
        const roundTitle = document.createElement('h4');
        roundTitle.className = 'round-title-compact';
        roundTitle.style.cssText = `
            color: #00ff88;
            text-align: center;
            margin-bottom: 10px;
            padding: 5px 8px;
            background: rgba(0, 255, 136, 0.1);
            border: 1px solid #00ff88;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
        `;
        
        // Usar el nombre de la ronda del primer partido si está disponible
        const firstMatch = matchesByRound[round][0];
        const roundName = firstMatch.roundName || getRoundName(round, format);
        roundTitle.textContent = roundName;
        roundDiv.appendChild(roundTitle);
        
        const matchesContainer = document.createElement('div');
        matchesContainer.className = 'round-matches';
        matchesContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        
        matchesByRound[round].forEach(match => {
            const matchDiv = createBracketMatch(match);
            matchesContainer.appendChild(matchDiv);
        });
        
        roundDiv.appendChild(matchesContainer);
        roundsContainer.appendChild(roundDiv);
    });
    
    container.appendChild(roundsContainer);
}

// Obtener nombre de la ronda
function getRoundName(round, format) {
    const roundNames = {
        '1': {
            '16': 'Octavos de Final',
            '8': 'Cuartos de Final',
            '4': 'Semifinales'
        },
        '2': {
            '16': 'Cuartos de Final',
            '8': 'Semifinales',
            '4': 'Final'
        },
        '3': {
            '16': 'Semifinales',
            '8': 'Final'
        },
        '4': {
            '16': 'Final'
        }
    };
    
    return roundNames[round]?.[format] || `Ronda ${round}`;
}

// Crear elemento de partido del bracket
function createBracketMatch(match) {
    const matchDiv = document.createElement('div');
    matchDiv.className = 'bracket-match-container';
    
    const isFinished = match.homeScore !== null && match.awayScore !== null && match.homeScore !== undefined && match.awayScore !== undefined;
    const homeWinner = isFinished && parseInt(match.homeScore) > parseInt(match.awayScore);
    const awayWinner = isFinished && parseInt(match.awayScore) > parseInt(match.homeScore);
    const isDraw = isFinished && parseInt(match.homeScore) === parseInt(match.awayScore);
    
    // Determinar ganador (en caso de empate, se puede definir por penales o criterio específico)
    let winner = null;
    if (homeWinner) winner = match.homeTeam;
    else if (awayWinner) winner = match.awayTeam;
    
    console.log('🎮 Renderizando partido:', match.homeTeam, 'vs', match.awayTeam, 'Finalizado:', isFinished, 'Scores:', match.homeScore, match.awayScore);
    
    matchDiv.innerHTML = `
        <div class="bracket-match-compact ${isFinished ? 'finished' : 'pending'}" data-match-id="${match.id}">
            <div class="match-teams">
                <div class="team-row ${homeWinner ? 'winner' : ''}">
                    <span class="team-name">${truncateTeamName(match.homeTeam)}</span>
                    <span class="team-score">${isFinished ? match.homeScore : '-'}</span>
                </div>
                <div class="team-row ${awayWinner ? 'winner' : ''}">
                    <span class="team-name">${truncateTeamName(match.awayTeam)}</span>
                    <span class="team-score">${isFinished ? match.awayScore : '-'}</span>
                </div>
            </div>
            ${!isFinished ? '<div class="vs-indicator">VS</div>' : ''}
            ${isFinished && winner ? `<div class="match-winner">🏆 ${truncateTeamName(winner)}</div>` : ''}
        </div>
    `;
    
    return matchDiv;
}

// Función auxiliar para truncar nombres de equipos largos
function truncateTeamName(teamName) {
    if (!teamName) return 'TBD';
    if (teamName.length <= 12) return teamName;
    return teamName.substring(0, 10) + '...';
}

// Agregar estilos dinámicos para el bracket
function addBracketStyles() {
    // Remover estilos existentes
    const existingStyle = document.getElementById('dynamic-bracket-styles');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    // Crear nuevos estilos para el bracket
    const style = document.createElement('style');
    style.id = 'bracket-dynamic-styles';
    style.textContent = `
        .bracket-title-compact {
            text-align: center;
            margin-bottom: 15px;
            padding: 10px 15px;
            background: linear-gradient(135deg, rgba(0, 255, 136, 0.15), rgba(0, 255, 136, 0.05));
            border-radius: 10px;
            border: 1px solid rgba(0, 255, 136, 0.3);
        }
        
        .bracket-title-compact h3 {
            color: #00ff88;
            margin: 0;
            font-size: 1.2rem;
            font-weight: 600;
        }
        
        .bracket-rounds-container {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            gap: 15px;
            padding: 10px;
            overflow-x: auto;
            max-width: 100%;
        }
        
        .bracket-round {
            flex: 0 0 auto;
            min-width: 180px;
            max-width: 200px;
        }
        
        .round-title-compact {
            color: #00ff88;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 10px;
            text-align: center;
            padding: 5px 8px;
            background: rgba(0, 255, 136, 0.1);
            border-radius: 15px;
            border: 1px solid rgba(0, 255, 136, 0.3);
        }
        
        .round-matches {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .bracket-match-container {
            margin-bottom: 5px;
        }
        
        .bracket-match-compact {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(0, 255, 136, 0.4);
            border-radius: 6px;
            overflow: hidden;
            min-width: 160px;
            position: relative;
            transition: all 0.3s ease;
        }
        
        .bracket-match-compact:hover {
            border-color: rgba(0, 255, 136, 0.7);
            box-shadow: 0 2px 8px rgba(0, 255, 136, 0.2);
        }
        
        .bracket-match-compact.finished {
            border-color: rgba(0, 255, 136, 0.6);
            background: rgba(0, 255, 136, 0.05);
        }
        
        .bracket-match-compact.pending {
            border-color: rgba(255, 165, 0, 0.5);
            background: rgba(255, 165, 0, 0.03);
        }
        
        .match-teams {
            padding: 6px;
        }
        
        .team-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 6px;
            margin-bottom: 2px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.05);
            transition: all 0.2s ease;
        }
        
        .team-row:last-child {
            margin-bottom: 0;
        }
        
        .team-row.winner {
            background: rgba(0, 255, 136, 0.2);
            color: #00ff88;
            font-weight: bold;
            border: 1px solid rgba(0, 255, 136, 0.5);
        }
        
        .team-name {
            font-size: 11px;
            font-weight: 500;
            color: white;
            flex: 1;
            text-align: left;
        }
        
        .team-row.winner .team-name {
            color: #00ff88;
            font-weight: bold;
        }
        
        .team-score {
            font-weight: bold;
            font-size: 12px;
            color: #00ff88;
            background: rgba(0, 0, 0, 0.3);
            padding: 2px 6px;
            border-radius: 3px;
            min-width: 20px;
            text-align: center;
            margin-left: 5px;
        }
        
        .vs-indicator {
            text-align: center;
            padding: 3px;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.7);
            font-weight: bold;
        }
        
        .match-winner {
            text-align: center;
            padding: 3px 6px;
            font-size: 10px;
            color: #00ff88;
            font-weight: bold;
            background: rgba(0, 255, 136, 0.1);
            border-top: 1px solid rgba(0, 255, 136, 0.3);
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            .bracket-rounds-container {
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }
            
            .bracket-round {
                width: 100%;
                max-width: 250px;
                min-width: 200px;
            }
            
            .bracket-match-compact {
                min-width: 180px;
            }
        }
        
        @media (max-width: 480px) {
            .bracket-title-compact h3 {
                font-size: 1rem;
            }
            
            .team-name {
                font-size: 10px;
            }
            
            .team-score {
                font-size: 11px;
                padding: 1px 4px;
            }
        }
    `;
    
    document.head.appendChild(style);
}

// Función para cargar los datos de la tabla de posiciones
// Se ejecuta una sola vez al cargar la página
function refreshStandingsData() {
    console.log('📊 Cargando datos de la tabla de posiciones...');
    loadStandingsData();
}

// Typewriter effect
function typeWriter() {
    const text = "Tabla de Posiciones";
    const element = document.querySelector('.typewriter-text');
    if (!element) return;
    
    let i = 0;
    element.textContent = '';
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, 100);
        }
    }
    
    type();
}

// Floating particles animation
function createFloatingParticles() {
    const particlesContainer = document.querySelector('.floating-particles');
    if (!particlesContainer) return;
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 10 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 2) + 's';
        particlesContainer.appendChild(particle);
    }
}

// ============ FUNCIONES DE ESTADÍSTICAS ============

// Cargar estadísticas de jugadores desde la API
async function loadPlayerStats() {
    try {
        console.log('📊 Cargando estadísticas de jugadores...');
        const response = await fetch('/api/players');
        if (response.ok) {
            playersStatsData = await response.json();
            console.log(`✅ Estadísticas de ${playersStatsData.length} jugadores cargadas`);
            
            // Calcular totales
            totalGoals = playersStatsData.reduce((sum, player) => sum + (parseInt(player.goals) || 0), 0);
            totalAssists = playersStatsData.reduce((sum, player) => sum + (parseInt(player.assists) || 0), 0);
            
            return true;
        } else {
            console.warn('⚠️ No se pudieron cargar las estadísticas de jugadores');
            playersStatsData = [];
            return false;
        }
    } catch (error) {
        console.error('❌ Error cargando estadísticas de jugadores:', error);
        playersStatsData = [];
        return false;
    }
}

// Cargar y mostrar estadísticas en la pestaña de estadísticas
function loadStats() {
    console.log('📈 Cargando estadísticas...');
    
    // Ordenar jugadores por goles y asistencias
    const topScorers = [...playersStatsData]
        .sort((a, b) => (parseInt(b.goals) || 0) - (parseInt(a.goals) || 0) || a.name.localeCompare(b.name))
        .slice(0, 10);
        
    const topAssisters = [...playersStatsData]
        .sort((a, b) => (parseInt(b.assists) || 0) - (parseInt(a.assists) || 0) || a.name.localeCompare(b.name))
        .slice(0, 10);
    
    // Actualizar tablas
    updateTopScorersTable(topScorers);
    updateTopAssistsTable(topAssisters);
    updateStatsSummary();
}

// Actualizar tabla de goleadores
function updateTopScorersTable(players) {
    const tbody = document.getElementById('topScorersList');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (players.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="4">
                    <i class="fas fa-info-circle"></i>
                    No hay datos de goleadores disponibles
                </td>
            </tr>`;
        return;
    }
    
    players.forEach((player, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="rank">${index + 1}</td>
            <td class="player">
                <div class="player-info">
                    <span class="player-number">${player.number || ''}</span>
                    <span class="player-name">${player.name || 'Jugador'}</span>
                </div>
            </td>
            <td class="team">
                <div class="team-info">
                    <img src="${player.teamLogo || 'img/team-placeholder.png'}" alt="${player.team || ''}" class="team-logo-small">
                    <span>${player.team || 'Sin equipo'}</span>
                </div>
            </td>
            <td class="goals">${player.goals || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Actualizar tabla de asistencias
function updateTopAssistsTable(players) {
    const tbody = document.getElementById('topAssistsList');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (players.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="4">
                    <i class="fas fa-info-circle"></i>
                    No hay datos de asistencias disponibles
                </td>
            </tr>`;
        return;
    }
    
    players.forEach((player, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="rank">${index + 1}</td>
            <td class="player">
                <div class="player-info">
                    <span class="player-number">${player.number || ''}</span>
                    <span class="player-name">${player.name || 'Jugador'}</span>
                </div>
            </td>
            <td class="team">
                <div class="team-info">
                    <img src="${player.teamLogo || 'img/team-placeholder.png'}" alt="${player.team || ''}" class="team-logo-small">
                    <span>${player.team || 'Sin equipo'}</span>
                </div>
            </td>
            <td class="assists">${player.assists || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Actualizar resumen de estadísticas
function updateStatsSummary() {
    // Calcular promedio de goles por partido
    const totalMatches = fixturesData.filter(match => match.status === 'FINISHED').length || 1;
    const avgGoalsPerMatch = (totalGoals / totalMatches).toFixed(1);
    
    // Actualizar los elementos del DOM
    const totalGoalsEl = document.getElementById('totalGoals');
    const totalAssistsEl = document.getElementById('totalAssists');
    const avgGoalsEl = document.getElementById('avgGoalsPerMatch');
    
    if (totalGoalsEl) totalGoalsEl.textContent = totalGoals;
    if (totalAssistsEl) totalAssistsEl.textContent = totalAssists;
    if (avgGoalsEl) avgGoalsEl.textContent = avgGoalsPerMatch;
    
    console.log(`📊 Resumen actualizado: ${totalGoals} goles, ${totalAssists} asistencias, ${avgGoalsPerMatch} promedio`);
}


// ============ FUNCIONES PARA PESTAÑA PRINCIPAL DE ESTADÍSTICAS ============

// Cargar y mostrar estadísticas completas en la pestaña principal
async function loadMainStatistics() {
    try {
        console.log('📊 Cargando estadísticas principales...');
        const response = await fetch('/api/players');
        if (response.ok) {
            const players = await response.json();
            console.log(`✅ ${players.length} jugadores cargados para estadísticas principales`);
            
            // Poblar tablas principales
            populateTopScorersTable(players);
            populateTopAssistsTable(players);
            updateStatsSummary(players);
            
            return true;
        } else {
            console.warn('⚠️ No se pudieron cargar las estadísticas principales');
            showMainStatsError();
            return false;
        }
    } catch (error) {
        console.error('❌ Error cargando estadísticas principales:', error);
        showMainStatsError();
        return false;
    }
}

// Poblar tabla de goleadores principales
function populateTopScorersTable(players) {
    const tbody = document.getElementById('topScorersList');
    if (!tbody) return;
    
    // Filtrar y ordenar jugadores por goles
    const topScorers = players
        .filter(player => (parseInt(player.goals) || 0) > 0)
        .sort((a, b) => (parseInt(b.goals) || 0) - (parseInt(a.goals) || 0));
    
    if (topScorers.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="4">
                    <i class="fas fa-info-circle"></i>
                    No hay datos de goleadores disponibles
                </td>
            </tr>`;
        return;
    }
    
    tbody.innerHTML = topScorers.map((player, index) => `
        <tr class="stats-row">
            <td class="rank-col">
                <div class="rank-badge rank-${index + 1}">${index + 1}</div>
            </td>
            <td class="player-col">
                <div class="player-info">
                    <div class="player-name">${player.name || 'Jugador'}</div>
                    <div class="player-number">#${player.number || '--'}</div>
                </div>
            </td>
            <td class="team-col">
                <div class="team-name">${player.clubName || 'Sin equipo'}</div>
            </td>
            <td class="goals-col">
                <div class="stat-value">${player.goals || 0}</div>
            </td>
        </tr>
    `).join('');
}

// Poblar tabla de asistidores principales
function populateTopAssistsTable(players) {
    const tbody = document.getElementById('topAssistsList');
    if (!tbody) return;
    
    // Filtrar y ordenar jugadores por asistencias
    const topAssisters = players
        .filter(player => (parseInt(player.assists) || 0) > 0)
        .sort((a, b) => (parseInt(b.assists) || 0) - (parseInt(a.assists) || 0));
    
    if (topAssisters.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="4">
                    <i class="fas fa-info-circle"></i>
                    No hay datos de asistencias disponibles
                </td>
            </tr>`;
        return;
    }
    
    tbody.innerHTML = topAssisters.map((player, index) => `
        <tr class="stats-row">
            <td class="rank-col">
                <div class="rank-badge rank-${index + 1}">${index + 1}</div>
            </td>
            <td class="player-col">
                <div class="player-info">
                    <div class="player-name">${player.name || 'Jugador'}</div>
                    <div class="player-number">#${player.number || '--'}</div>
                </div>
            </td>
            <td class="team-col">
                <div class="team-name">${player.clubName || 'Sin equipo'}</div>
            </td>
            <td class="assists-col">
                <div class="stat-value">${player.assists || 0}</div>
            </td>
        </tr>
    `).join('');
}

// Mostrar error en las estadísticas principales
function showMainStatsError() {
    const scorersTable = document.getElementById('topScorersList');
    const assistsTable = document.getElementById('topAssistsList');
    
    const errorHTML = `
        <tr class="no-data error">
            <td colspan="4">
                <i class="fas fa-exclamation-triangle"></i>
                Error cargando datos
            </td>
        </tr>`;
    
    if (scorersTable) scorersTable.innerHTML = errorHTML;
    if (assistsTable) assistsTable.innerHTML = errorHTML;
}

// Actualizar tarjetas de resumen de estadísticas
function updateStatsSummary(players) {
    console.log('📊 Actualizando resumen de estadísticas...');
    
    if (!players || players.length === 0) {
        // Si no hay jugadores, mostrar ceros
        const totalGoalsEl = document.getElementById('totalGoals');
        const totalAssistsEl = document.getElementById('totalAssists');
        const avgGoalsEl = document.getElementById('avgGoalsPerMatch');
        
        if (totalGoalsEl) totalGoalsEl.textContent = '0';
        if (totalAssistsEl) totalAssistsEl.textContent = '0';
        if (avgGoalsEl) avgGoalsEl.textContent = '0.0';
        return;
    }
    
    // Calcular totales
    const totalGoals = players.reduce((sum, player) => sum + (parseInt(player.goals) || 0), 0);
    const totalAssists = players.reduce((sum, player) => sum + (parseInt(player.assists) || 0), 0);
    
    // Calcular promedio de goles por partido (asumiendo que hay partidos jugados)
    // Para esto necesitamos obtener el número de partidos jugados
    let avgGoalsPerMatch = 0;
    if (fixturesData && fixturesData.length > 0) {
        const playedMatches = fixturesData.filter(match => 
            match.homeScore !== null && match.awayScore !== null
        ).length;
        
        if (playedMatches > 0) {
            avgGoalsPerMatch = (totalGoals / playedMatches).toFixed(1);
        }
    }
    
    // Actualizar elementos DOM
    const totalGoalsEl = document.getElementById('totalGoals');
    const totalAssistsEl = document.getElementById('totalAssists');
    const avgGoalsEl = document.getElementById('avgGoalsPerMatch');
    
    if (totalGoalsEl) {
        totalGoalsEl.textContent = totalGoals;
        console.log('✅ Goles totales actualizados:', totalGoals);
    }
    
    if (totalAssistsEl) {
        totalAssistsEl.textContent = totalAssists;
        console.log('✅ Asistencias totales actualizadas:', totalAssists);
    }
    
    if (avgGoalsEl) {
        avgGoalsEl.textContent = avgGoalsPerMatch;
        console.log('✅ Promedio goles/partido actualizado:', avgGoalsPerMatch);
    }
    
    console.log(`📊 Resumen actualizado: ${totalGoals} goles, ${totalAssists} asistencias, ${avgGoalsPerMatch} promedio`);
}

// Función principal para cargar la pestaña de estadísticas
function loadStats() {
    console.log('📊 Cargando pestaña de estadísticas...');
    
    // Si ya tenemos datos de jugadores en memoria, usarlos
    if (playersStatsData && playersStatsData.length > 0) {
        console.log('✅ Usando datos de jugadores en memoria:', playersStatsData.length);
        populateTopScorersTable(playersStatsData);
        populateTopAssistsTable(playersStatsData);
        updateStatsSummary(playersStatsData);
    } else {
        // Si no hay datos en memoria, cargarlos desde la API
        console.log('🔄 Cargando datos de jugadores desde API...');
        loadMainStatistics();
    }
}

// Classification zones system completely removed
