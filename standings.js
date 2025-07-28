// Standings page functionality - BACKEND CONNECTED VERSION
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando página de posiciones...');
    
    initializeStandings();
    setupEventListeners();
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
        fixturesData = updatedMatches;
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
    
    socket.on('teamsUpdate', (updatedTeams) => {
        console.log('👥 Actualizando equipos...');
        // Update teams data if needed
    });
    
    socket.on('classificationZonesUpdate', (updatedZones) => {
        console.log('🎨 Actualizando zonas de clasificación...');
        classificationZones = updatedZones;
        if (document.querySelector('#table.active')) {
            loadStandingsTable();
        }
    });
    
    socket.on('bracketUpdate', (updatedBracket) => {
        console.log('🏆 Actualizando bracket de playoffs vía WebSocket...');
        console.log('📋 Datos del bracket recibido:', updatedBracket);
        
        // Forzar actualización si estamos en la pestaña de playoffs
        if (document.querySelector('#playoffs.active')) {
            console.log('🔄 Recargando bracket dinámico...');
            renderDynamicBracket(updatedBracket);
        }
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
let classificationZones = [];
let tournamentSettings = {};

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

// Teams data with logos - Updated to match actual file names
const teams = [
    { name: 'ACP 507', logo: 'img/APC 507.png' },
    { name: 'BKS FC', logo: 'img/BKS FC.jpg' },
    { name: 'Coiner FC', logo: 'img/Coiner FC.jpg' },
    { name: 'FC WEST SIDE', logo: 'img/West side.jpg' },
    { name: 'Humacao FC', logo: 'img/Humacao fc.jpg' },
    { name: 'Jumpers FC', logo: 'img/Jumpers FC.jpg' },
    { name: 'LOS PLEBES Tk', logo: 'img/Los Plebes.jpg' },
    { name: 'Punta Coco FC', logo: 'img/Punta Coco FC.png' },
    { name: 'Pura Vibra', logo: 'img/Pura vibra.png' },
    { name: 'Rayos X FC', logo: 'img/Rayos x FC.jpg' },
    { name: 'Tiki Taka FC', logo: 'img/Tiki taka FC.jpg' },
    { name: 'WEST SIDE PTY', logo: 'img/WEST SIDE PTY.jpg' }
];

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
    // Tab navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
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
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
    const tabContent = document.getElementById(tabId);
    
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
    
    // Load content based on tab
    switch(tabId) {
        case 'table':
            loadStandingsTable();
            break;
        case 'fixtures':
            loadFixtures();
            break;
        case 'results':
            loadResults();
            break;
        case 'playoffs':
            loadPlayoffs();
            break;
        case 'schedule':
            loadSchedule();
            break;
    }
}

async function loadAllData() {
    console.log('📊 Cargando todos los datos...');
    
    try {
        // Cargar configuración del torneo y zonas de clasificación
        await loadTournamentSettings();
        
        // Cargar datos de clasificación
        await loadStandingsData();
        
        // Cargar datos de partidos
        await loadMatchesData();
        
        console.log('✅ Todos los datos cargados exitosamente');
        
        // Cargar la pestaña activa por defecto (tabla de posiciones)
        if (document.querySelector('#table.active')) {
            loadStandingsTable();
        }
        
    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        
        // Usar datos de respaldo
        console.log('🔄 Usando datos de respaldo...');
        standingsData = generateFallbackStandings();
        fixturesData = generateSampleFixtures();
        
        // Usar zonas de clasificación por defecto
        classificationZones = [
            { id: 1, name: 'Clasificación Directa', positions: '1-4', color: '#00ff88' },
            { id: 2, name: 'Repechaje', positions: '5-8', color: '#ffa500' },
            { id: 3, name: 'Eliminación', positions: '9-12', color: '#ff4757' }
        ];
        
        if (document.querySelector('#table.active')) {
            loadStandingsTable();
        }
        
        showNotification('Conectando con el servidor...', 'info');
    }
}

// Cargar configuración del torneo
async function loadTournamentSettings() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            tournamentSettings = await response.json();
            
            // Cargar zonas de clasificación
            if (tournamentSettings.classificationZones && tournamentSettings.classificationZones.length > 0) {
                classificationZones = tournamentSettings.classificationZones;
                console.log('✅ Zonas de clasificación cargadas:', classificationZones.length);
            } else {
                // Usar zonas por defecto
                classificationZones = [
                    { id: 1, name: 'Clasificación Directa', positions: '1-4', color: '#00ff88' },
                    { id: 2, name: 'Repechaje', positions: '5-8', color: '#ffa500' },
                    { id: 3, name: 'Eliminación', positions: '9-12', color: '#ff4757' }
                ];
                console.log('📋 Usando zonas de clasificación por defecto');
            }
        }
    } catch (error) {
        console.error('Error loading tournament settings:', error);
        // Usar configuración por defecto
        classificationZones = [
            { id: 1, name: 'Clasificación Directa', positions: '1-4', color: '#00ff88' },
            { id: 2, name: 'Repechaje', positions: '5-8', color: '#ffa500' },
            { id: 3, name: 'Eliminación', positions: '9-12', color: '#ff4757' }
        ];
    }
}

async function loadStandingsData() {
    try {
        const response = await fetch('/api/standings');
        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }
        
        const data = await response.json();
        console.log('✅ Datos de posiciones cargados desde el servidor:', data);
        standingsData = data;
        
    } catch (error) {
        console.error('❌ Error cargando datos del servidor:', error);
        console.log('🔄 Usando datos de respaldo...');
        
        // Usar datos de respaldo si el servidor no está disponible
        standingsData = generateFallbackStandings();
        showNotification('Usando datos de ejemplo - Servidor no disponible', 'info');
    }
}

async function loadMatchesData() {
    try {
        const response = await fetch('/api/tournament/matches');
        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }
        
        const data = await response.json();
        console.log('✅ Datos de partidos cargados desde el servidor:', data);
        
        if (data && data.length > 0) {
            // Separar partidos por estado: programados vs terminados
            fixturesData = data.filter(match => match.status === 'scheduled' || match.status === 'live');
            resultsData = data.filter(match => match.status === 'finished');
            
            console.log(`📊 Partidos programados: ${fixturesData.length}`);
            console.log(`📊 Partidos terminados: ${resultsData.length}`);
            
            // Para la pestaña de partidos, mostrar TODOS los partidos independientemente del estado
            // Esto permite ver tanto partidos programados como terminados en la misma jornada
            const allMatchesData = data;
            
            // Asignar todos los partidos a fixturesData para que aparezcan en la pestaña de partidos
            fixturesData = allMatchesData;
            
        } else {
            // Si no hay partidos en el servidor, usar datos de ejemplo
            const sampleData = generateSampleFixtures();
            fixturesData = sampleData;
            resultsData = [];
            console.log('📋 Usando datos de partidos de ejemplo');
        }
        
        // Actualizar jornadas máximas dinámicamente
        getMaxMatchdays();
        
    } catch (error) {
        console.error('❌ Error cargando partidos del servidor:', error);
        console.log('🔄 Generando datos de partidos de ejemplo...');
        const sampleData = generateSampleFixtures();
        fixturesData = sampleData;
        resultsData = [];
        
        // Actualizar jornadas máximas dinámicamente
        getMaxMatchdays();
    }
}

// Fallback standings if server is unavailable
function generateFallbackStandings() {
    // Usamos el array global 'teams' que ya contiene los 12 equipos
    return teams.map((team, index) => ({
        position: index + 1,
        team: team.name, // Solo guardamos el nombre del equipo, no el objeto completo
        played: 0,       // Partidos jugados
        won: 0,          // Partidos ganados
        drawn: 0,        // Empates
        lost: 0,         // Partidos perdidos
        goalsFor: 0,     // Goles a favor
        goalsAgainst: 0,  // Goles en contra
        goalDifference: 0,// Diferencia de goles
        points: 0        // Puntos
    })).sort((a, b) => b.points - a.points).map((team, index) => ({ ...team, position: index + 1 }));
}

// Generate sample fixtures for demonstration - Updated for 3 matchdays with 6 matches each
function generateSampleFixtures() {
    // Usar una semilla fija para que los resultados sean consistentes
    const seed = 42;
    const random = (min, max) => {
        const x = Math.sin(seed + max + min) * 10000;
        return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
    };
    
    const teamNames = teams.map(team => team.name);
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
                venue: 'Estadio LPCP',
                competition: 'Liga LPCP 2024',
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
function loadStandingsTable() {
    console.log('🔄 Loading standings table...');
    const tableBody = document.getElementById('standingsTableBody');
    if (!tableBody) {
        console.warn('No se encontró el elemento de la tabla de posiciones');
        return;
    }
    
    // Asegurar que siempre tengamos datos para mostrar
    if (!standingsData || standingsData.length === 0) {
        console.log('No hay datos de clasificación disponibles, generando datos de ejemplo...');
        standingsData = generateFallbackStandings();
    }
    
    // Aplicar estilos dinámicos para las zonas de clasificación
    applyDynamicZoneStyles();
    
    // Ordenar los datos por posición
    const sortedStandings = [...standingsData].sort((a, b) => a.position - b.position);
    
    tableBody.innerHTML = sortedStandings.map(teamData => {
        // Asegurarse de que teamData.team sea un string y no un objeto
        const teamName = typeof teamData.team === 'object' ? teamData.team.name : teamData.team;
        
        // Encontrar el equipo en el array de equipos para obtener el logo
        const teamInfo = teams.find(t => t.name === teamName) || { 
            name: teamName, 
            logo: 'img/teams/default.png' 
        };
        
        // Si el logo no se encuentra, usar una imagen por defecto
        const logoPath = teamInfo.logo || 'img/teams/default.png';
        
        return `
        <tr class="${getPositionClass(teamData.position)}">
            <td class="position">${teamData.position}</td>
            <td class="team">
                <div class="team-info">
                    <img src="${logoPath}" alt="${teamInfo.name}" class="team-logo" onerror="this.onerror=null; this.src='img/teams/default.png'">
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
    
    console.log('✅ Tabla de posiciones cargada con', standingsData.length, 'equipos');
}

// Aplicar estilos dinámicos para las zonas de clasificación
function applyDynamicZoneStyles() {
    // Remover estilos existentes
    const existingStyle = document.getElementById('dynamic-zone-styles');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    // Crear nuevos estilos basados en las zonas de clasificación
    const style = document.createElement('style');
    style.id = 'dynamic-zone-styles';
    
    let css = '';
    classificationZones.forEach(zone => {
        css += `
            .zone-${zone.id} {
                border-left: 4px solid ${zone.color} !important;
                background: linear-gradient(90deg, ${zone.color}15, transparent) !important;
            }
            .zone-${zone.id}:hover {
                background: linear-gradient(90deg, ${zone.color}25, transparent) !important;
            }
        `;
    });
    
    style.textContent = css;
    document.head.appendChild(style);
    
    console.log('🎨 Estilos dinámicos aplicados para', classificationZones.length, 'zonas');
    
    // También actualizar la leyenda
    updateTableLegend();
}

// Actualizar la leyenda de colores debajo de la tabla
function updateTableLegend() {
    const legendContainer = document.querySelector('.table-legend');
    if (!legendContainer) return;
    
    // Limpiar leyenda existente
    legendContainer.innerHTML = '';
    
    // Crear elementos de leyenda basados en las zonas de clasificación
    classificationZones.forEach(zone => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        
        legendItem.innerHTML = `
            <span class="legend-color" style="background-color: ${zone.color}; border: 2px solid ${zone.color};"></span>
            <span>${zone.name} (${zone.positions})</span>
        `;
        
        legendContainer.appendChild(legendItem);
    });
    
    console.log('📋 Leyenda de tabla actualizada con', classificationZones.length, 'zonas');
}

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
    const fixturesContainer = document.getElementById('fixturesContainer');
    if (!fixturesContainer) return;
    
    // Usar datos ya generados, no generar nuevos
    if (!fixturesData || fixturesData.length === 0) {
        console.warn('No hay datos de partidos disponibles');
        return;
    }
    
    // Actualizar número máximo de jornadas dinámicamente
    const maxJornadas = getMaxMatchdays();
    
    // Get current matchday fixtures (up to 6 matches)
    const matchdayFixtures = fixturesData
        .filter(match => match.matchday === currentMatchday)
        .slice(0, 6); // Ensure we only show 6 matches per matchday
    
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
    const resultsContainer = document.getElementById('resultsContainer');
    const resultsGrid = document.getElementById('resultsGrid');
    if (!resultsGrid) return;
    
    // Actualizar número máximo de jornadas dinámicamente
    const maxJornadas = getMaxMatchdays();
    
    const matchdayResults = resultsData.filter(match => match.matchday === currentMatchday);
    
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
        resultsGrid.innerHTML = `
            <div class="no-matches">
                <i class="fas fa-history"></i>
                <p>No hay resultados disponibles para la Jornada ${currentMatchday}</p>
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
    
    // Usar solo fixturesData ya que ahora contiene todos los partidos (scheduled y finished)
    // Esto evita duplicados que ocurrían al combinar fixturesData y resultsData
    const allMatches = fixturesData || [];
    const matchdayGroups = {};
    
    console.log('📅 Cargando calendario con', allMatches.length, 'partidos');
    
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
    const homeTeamInfo = teams.find(t => t.name === match.homeTeam) || { 
        name: match.homeTeam, 
        logo: transparentPixel 
    };
    
    const awayTeamInfo = teams.find(t => t.name === match.awayTeam) || { 
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

function getPositionClass(position) {
    // Buscar en qué zona de clasificación está esta posición
    for (const zone of classificationZones) {
        if (isPositionInZone(position, zone.positions)) {
            return `zone-${zone.id}`;
        }
    }
    return '';
}

// Función auxiliar para verificar si una posición está en un rango
function isPositionInZone(position, positionsRange) {
    if (!positionsRange) return false;
    
    // Manejar rangos como "1-4" o posiciones individuales como "1"
    if (positionsRange.includes('-')) {
        const [start, end] = positionsRange.split('-').map(num => parseInt(num.trim()));
        return position >= start && position <= end;
    } else {
        return position === parseInt(positionsRange.trim());
    }
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
    
    // Desplazarse suavemente hacia arriba para mejor experiencia de usuario
    const fixturesSection = document.querySelector('.fixtures-section');
    if (fixturesSection) {
        fixturesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
        min-height: 300px;
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
