// Standings page functionality - FIXED VERSION
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando página de posiciones...');
    
    // Generar datos de ejemplo una sola vez
    if (!fixturesData || fixturesData.length === 0) {
        fixturesData = generateSampleFixtures();
        console.log('📋 Datos de partidos generados una sola vez');
    }
    
    initializeStandings();
    setupEventListeners();
    loadStandingsData();
    createFloatingParticles();
    
    console.log('✅ Página de posiciones inicializada');
});

// WebSocket connection disabled to prevent auto-refresh
function setupWebSocket() {
    console.log('WebSocket functionality is disabled to prevent auto-refresh');
    // No se establece ninguna conexión WebSocket
}

// Global variables
let currentMatchday = 1;
let standingsData = [];
let fixturesData = [];
let resultsData = [];

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

async function loadStandingsData() {
    console.log('Cargando datos de la tabla de posiciones...');
    
    // Verificar si ya se cargaron los datos
    if (standingsData.length > 0 && fixturesData.length > 0) {
        console.log('✅ Los datos ya están cargados, omitiendo recarga');
        return;
    }
    
    try {
        // Intentar cargar datos del servidor
        const [standingsRes, matchesRes] = await Promise.all([
            fetch('/api/standings'),
            fetch('/api/matches')
        ]);
        
        // Procesar datos de la tabla de posiciones
        if (standingsRes && standingsRes.ok) {
            const serverStandings = await standingsRes.json();
            if (serverStandings && serverStandings.length > 0) {
                standingsData = serverStandings;
            }
        }
        
        // Si no hay datos del servidor, usar datos de respaldo
        if (standingsData.length === 0) {
            console.log('Usando datos de respaldo para la tabla de posiciones');
            standingsData = generateFallbackStandings();
        }
        
        // Procesar partidos
        if (matchesRes && matchesRes.ok) {
            const allMatches = await matchesRes.json();
            
            if (allMatches && allMatches.length > 0) {
                // Filtrar partidos futuros y en vivo
                fixturesData = allMatches
                    .filter(match => match.status === 'upcoming' || match.status === 'live')
                    .sort((a, b) => {
                        const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
                        const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
                        return dateA - dateB;
                    });
                
                // Filtrar partidos finalizados
                resultsData = allMatches
                    .filter(match => match.status === 'finished')
                    .sort((a, b) => {
                        const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
                        const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
                        return dateB - dateA;
                    });
            }
        }
        
        // Si no hay partidos del servidor, no generamos datos de ejemplo
        
        // Actualizar la interfaz de usuario solo si hay datos
        if (standingsData.length > 0) {
            loadStandingsTable();
        }
        
        if (fixturesData.length > 0 || resultsData.length > 0) {
            loadFixtures();
            loadResults();
            loadSchedule();
        }
        
        console.log('✅ Datos cargados correctamente');
        
    } catch (error) {
        console.error('❌ Error al cargar los datos:', error);
        // No generamos datos de ejemplo automáticamente
        showNotification('Error al cargar los datos. Intenta recargar la página.', 'error');
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
                <span>${matchdayFixtures.length} partidos</span>
            </div>
            
            <button class="nav-arrow" onclick="changeMatchday('next', 'fixtures')" ${currentMatchday === 3 ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
        
        <div class="fixtures-grid" id="fixturesGrid"></div>
        
        <div class="matchday-pagination">
            ${[1, 2, 3].map(day => `
                <button class="matchday-dot ${day === currentMatchday ? 'active' : ''}" 
                        onclick="currentMatchday = ${day}; loadFixtures();">
                    <span class="sr-only">Jornada ${day}</span>
                </button>
            `).join('')}
        </div>
    `;
    
    // Update container with navigation and grid
    fixturesContainer.innerHTML = navigationHTML;
    
    // Get the grid where matches will be displayed
    const fixturesGrid = document.getElementById('fixturesGrid');
    
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
    const resultsGrid = document.getElementById('resultsGrid');
    if (!resultsGrid) return;
    
    const matchdayResults = resultsData.filter(match => match.matchday === currentMatchday);
    
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
    
    // Update matchday display
    const matchdaySpan = document.getElementById('resultsMatchday');
    if (matchdaySpan) {
        matchdaySpan.textContent = `Jornada ${currentMatchday}`;
    }
}

// Load schedule tab
function loadSchedule() {
    const scheduleTimeline = document.getElementById('scheduleTimeline');
    if (!scheduleTimeline) return;
    
    const allMatches = [...fixturesData, ...resultsData];
    const matchdayGroups = {};
    
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
    if (position === 1) return 'champion';
    if (position <= 8) return 'playoffs';
    if (position >= 9) return 'relegation';
    return '';
}

/**
 * Cambia la jornada actual y recarga el contenido correspondiente
 * @param {string|number} direction - Dirección del cambio ('prev', 'next') o número de jornada (1-3)
 * @param {string} type - Tipo de contenido a actualizar ('fixtures' o 'results')
 */
function changeMatchday(direction, type) {
    // Actualizar el número de jornada según la dirección
    if (direction === 'prev' && currentMatchday > 1) {
        currentMatchday--;
    } else if (direction === 'next' && currentMatchday < 3) {
        currentMatchday++;
    } else if (typeof direction === 'number' && direction >= 1 && direction <= 3) {
        // Si se pasa un número de jornada directamente
        currentMatchday = direction;
    }
    
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
function loadPlayoffs() {
    console.log('🏆 Loading playoffs bracket...');
    
    // For now, just show the placeholder structure
    // Later, this will be populated with actual qualified teams
    const quarterfinalsMatches = document.getElementById('quarterfinalsMatches');
    if (quarterfinalsMatches) {
        // The HTML structure is already in place, no dynamic loading needed yet
        console.log('✅ Playoffs bracket loaded (placeholder mode)');
    }
    
    // TODO: When teams are available, update the team slots with actual team names
    // This function will be expanded when you add the teams later
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
