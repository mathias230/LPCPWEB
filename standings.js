// Standings page functionality - FIXED VERSION
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing standings page...');
    initializeStandings();
    setupEventListeners();
    loadStandingsData();
    createFloatingParticles();
    
    // Set up auto-refresh for real-time updates
    setInterval(refreshStandingsData, 10000); // Refresh every 10 seconds
    
    // Set up WebSocket for real-time updates
    setupWebSocket();
    
    console.log('✅ Standings page initialized with real-time sync');
});

// WebSocket connection for real-time updates
function setupWebSocket() {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('WebSocket connected');
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Update received:', data);
            
            if (data.type === 'standings_updated' || data.type === 'match_updated') {
                refreshStandingsData();
            }
        };

        socket.onclose = () => {
            console.log('WebSocket disconnected. Attempting to reconnect...');
            setTimeout(setupWebSocket, 5000);
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        console.warn('WebSocket not available:', error);
    }
}

// Global variables
let currentMatchday = 1;
let standingsData = [];
let fixturesData = [];
let resultsData = [];

// Teams data from memory
const teams = [
    'ACP 507',
    'Coiner FC', 
    'FC WEST SIDE',
    'Humacao Fc',
    'Punta Coco Fc',
    'Pura Vibra',
    'Raven Law',
    'Rayos X Fc',
    'Tiki Taka Fc',
    'fly city'
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
    console.log('Loading standings data from API...');
    
    try {
        // Cargar datos de la tabla de posiciones
        const [standingsRes, matchesRes] = await Promise.all([
            fetch('/api/standings'),
            fetch('/api/matches')
        ]);
        
        if (standingsRes.ok) {
            const serverStandings = await standingsRes.json();
            // Usar datos del servidor si están disponibles y no están vacíos
            if (serverStandings && serverStandings.length > 0) {
                standingsData = serverStandings;
            } else {
                // Si el servidor responde pero no hay datos, generar datos iniciales
                standingsData = generateFallbackStandings();
            }
        } else {
            // Si el servidor no responde, usar datos de respaldo
            standingsData = generateFallbackStandings();
        }
        
        if (matchesRes.ok) {
            const allMatches = await matchesRes.json();
            
            // Procesar partidos para fixtures y resultados
            fixturesData = allMatches
                .filter(match => match.status === 'upcoming' || match.status === 'live')
                .sort((a, b) => {
                    const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
                    const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
                    return dateA - dateB;
                });
                
            resultsData = allMatches
                .filter(match => match.status === 'finished')
                .sort((a, b) => {
                    const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
                    const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
                    return dateB - dateA; // Mostrar los más recientes primero
                });
        } else {
            // Si no hay partidos del servidor, generar datos de ejemplo
            fixturesData = generateSampleFixtures();
            resultsData = [];
        }
        
        // Actualizar la interfaz de usuario
        loadStandingsTable();
        loadFixtures();
        loadResults();
        loadSchedule();
        
        console.log('✅ Datos cargados exitosamente:', {
            standings: standingsData.length,
            fixtures: fixturesData.length,
            results: resultsData.length
        });
        
    } catch (error) {
        console.error('❌ Error al cargar los datos:', error);
        // Generar datos de respaldo si hay un error
        standingsData = generateFallbackStandings();
        fixturesData = generateSampleFixtures();
        resultsData = [];
        
        // Actualizar la interfaz con datos de respaldo
        loadStandingsTable();
        loadFixtures();
        loadResults();
        loadSchedule();
        
        // Mostrar mensaje de información
        showNotification('Usando datos de ejemplo. El servidor puede no estar disponible.', 'warning');
    }
}

// Fallback standings if server is unavailable
function generateFallbackStandings() {
    const teams = [
        'ACP 507', 'Coiner FC', 'FC WEST SIDE', 'Humacao Fc', 'Punta Coco Fc',
        'Pura Vibra', 'Raven Law', 'Rayos X Fc', 'Tiki Taka Fc', 'fly city'
    ];
    
    return teams.map((team, index) => ({
        position: index + 1,
        team: team,
        played: Math.floor(Math.random() * 5),
        won: Math.floor(Math.random() * 3),
        drawn: Math.floor(Math.random() * 2),
        lost: Math.floor(Math.random() * 2),
        goalsFor: Math.floor(Math.random() * 10),
        goalsAgainst: Math.floor(Math.random() * 8),
        goalDifference: Math.floor(Math.random() * 6) - 3,
        points: Math.floor(Math.random() * 9)
    })).sort((a, b) => b.points - a.points).map((team, index) => ({ ...team, position: index + 1 }));
}

// Generate sample fixtures for demonstration
function generateSampleFixtures() {
    const teams = [
        'ACP 507', 'Coiner FC', 'FC WEST SIDE', 'Humacao Fc', 'Punta Coco Fc',
        'Pura Vibra', 'Raven Law', 'Rayos X Fc', 'Tiki Taka Fc', 'fly city'
    ];
    
    const fixtures = [];
    const today = new Date();
    
    for (let i = 0; i < 5; i++) {
        const matchDate = new Date(today);
        matchDate.setDate(today.getDate() + i + 1);
        
        const homeTeam = teams[Math.floor(Math.random() * teams.length)];
        let awayTeam = teams[Math.floor(Math.random() * teams.length)];
        while (awayTeam === homeTeam) {
            awayTeam = teams[Math.floor(Math.random() * teams.length)];
        }
        
        fixtures.push({
            id: `fixture-${i + 1}`,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            date: matchDate.toISOString().split('T')[0],
            time: `${15 + Math.floor(Math.random() * 3)}:00`,
            venue: `Estadio ${homeTeam.split(' ')[0]}`,
            status: 'upcoming',
            matchday: Math.floor(i / 2) + 1
        });
    }
    
    return fixtures;
}

// Load and display standings table - FIXED VERSION
function loadStandingsTable() {
    console.log('🔄 Loading standings table...');
    const tableBody = document.getElementById('standingsTableBody');
    if (!tableBody) {
        console.warn('Standings table body not found');
        return;
    }
    
    // Asegurar que siempre tengamos datos para mostrar
    if (!standingsData || standingsData.length === 0) {
        console.log('No standings data found, generating fallback data');
        standingsData = generateFallbackStandings();
    }
    
    // Mostrar los datos en la tabla
    tableBody.innerHTML = standingsData.map(team => `
        <tr class="${getPositionClass(team.position)}">
            <td class="position">${team.position}</td>
            <td class="team-name">
                <i class="fas fa-shield-alt"></i>
                ${team.team}
            </td>
            <td>${team.played}</td>
            <td>${team.won}</td>
            <td>${team.drawn}</td>
            <td>${team.lost}</td>
            <td>${team.goalsFor}</td>
            <td>${team.goalsAgainst}</td>
            <td class="${team.goalDifference >= 0 ? 'positive' : 'negative'}">
                ${team.goalDifference >= 0 ? '+' : ''}${team.goalDifference}
            </td>
            <td class="points">${team.points}</td>
        </tr>
    `).join('');
    
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

// Load fixtures tab
function loadFixtures() {
    const fixturesGrid = document.getElementById('fixturesGrid');
    if (!fixturesGrid) return;
    
    if (!fixturesData || fixturesData.length === 0) {
        fixturesData = generateSampleFixtures();
    }
    
    const matchdayFixtures = fixturesData.filter(match => match.matchday === currentMatchday);
    
    if (matchdayFixtures.length === 0) {
        fixturesGrid.innerHTML = `
            <div class="no-matches">
                <i class="fas fa-calendar-times"></i>
                <p>No hay partidos programados para la Jornada ${currentMatchday}</p>
            </div>
        `;
        return;
    }
    
    fixturesGrid.innerHTML = matchdayFixtures.map(match => createMatchCard(match)).join('');
    
    // Update matchday display
    const matchdaySpan = document.getElementById('currentMatchdayFixtures');
    if (matchdaySpan) {
        matchdaySpan.textContent = `Jornada ${currentMatchday}`;
    }
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
    return `
        <div class="match-card upcoming" onclick="showMatchDetails(${JSON.stringify(match).replace(/"/g, '&quot;')})">
            <div class="match-header">
                <span class="match-date">${new Date(match.date).toLocaleDateString('es-ES')}</span>
                <span class="match-time">${match.time}</span>
            </div>
            <div class="match-teams">
                <div class="team home">
                    <i class="fas fa-shield-alt"></i>
                    <span>${match.homeTeam}</span>
                </div>
                <div class="vs">VS</div>
                <div class="team away">
                    <i class="fas fa-shield-alt"></i>
                    <span>${match.awayTeam}</span>
                </div>
            </div>
            <div class="match-info">
                <i class="fas fa-map-marker-alt"></i>
                <span>${match.venue || 'Por confirmar'}</span>
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

function changeMatchday(direction, type) {
    const newMatchday = currentMatchday + direction;
    
    if (newMatchday >= 1 && newMatchday <= 18) {
        currentMatchday = newMatchday;
        
        if (type === 'fixtures') {
            loadFixtures();
        } else if (type === 'results') {
            loadResults();
        }
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

// Function to refresh standings data from server
function refreshStandingsData() {
    console.log('🔄 Refreshing standings data...');
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
