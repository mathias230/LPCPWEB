// Admin panel functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Inicializando panel de administración...');
    
    initializeAdmin();
    setupEventListeners();
    loadInitialData();
    
    console.log('✅ Panel de administración inicializado');
});

// Global variables
let teams = [];
let matches = [];
let currentTab = 'teams';

function initializeAdmin() {
    // Setup tab switching
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Setup mobile navigation
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }
}

function setupEventListeners() {
    // Team form submission
    const teamForm = document.getElementById('teamForm');
    if (teamForm) {
        teamForm.addEventListener('submit', handleTeamSubmit);
    }

    // Club form submission
    const clubForm = document.getElementById('clubForm');
    if (clubForm) {
        clubForm.addEventListener('submit', handleClubSubmit);
    }

    // Match form submission
    const matchForm = document.getElementById('matchForm');
    if (matchForm) {
        matchForm.addEventListener('submit', handleMatchSubmit);
    }
}

function switchTab(tabId) {
    // Update active tab button
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

    // Update active section
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');

    currentTab = tabId;

    // Load data for the active tab
    switch(tabId) {
        case 'teams':
            loadTeams();
            break;
        case 'clubs':
            loadClubs();
            break;
        case 'matches':
            loadMatches();
            populateTeamSelects();
            break;
        case 'results':
            loadPendingMatches();
            break;
        case 'config':
            loadConfiguration();
            break;
        case 'playoffs':
            loadPlayoffsManagement();
            break;
    }
}

async function loadInitialData() {
    try {
        await loadTeams();
        await loadMatches();
        populateTeamSelects();
    } catch (error) {
        console.error('Error loading initial data:', error);
        showNotification('Error cargando datos iniciales', 'error');
    }
}

// ==================== CLUBS MANAGEMENT ====================

async function loadClubs() {
    try {
        const response = await fetch('/api/clubs');
        if (!response.ok) throw new Error('Error fetching clubs');
        
        clubs = await response.json();
        renderClubs();
        console.log('✅ Clubes cargados:', clubs);
    } catch (error) {
        console.error('Error loading clubs:', error);
        showNotification('Error cargando clubes', 'error');
        // Mostrar clubes de ejemplo si no hay datos
        clubs = [];
        renderClubs();
    }
}

function renderClubs() {
    const clubsGrid = document.getElementById('clubsGrid');
    if (!clubsGrid) return;

    clubsGrid.innerHTML = '';

    if (clubs.length === 0) {
        clubsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: rgba(255,255,255,0.6); padding: 40px;">
                <i class="fas fa-shield-alt" style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;"></i>
                <p>No hay clubes registrados. Agrega el primer club usando el formulario de arriba.</p>
            </div>
        `;
        return;
    }

    clubs.forEach(club => {
        const clubCard = document.createElement('div');
        clubCard.className = 'club-card';
        clubCard.innerHTML = `
            <div class="club-logo">
                ${club.logo ? 
                    `<img src="${club.logo}" alt="${club.name} Logo" class="club-logo-img">` :
                    `<div class="club-logo-placeholder"><i class="fas fa-shield-alt"></i></div>`
                }
            </div>
            <h3>${club.name}</h3>
            <p class="club-description">${club.description}</p>
            <div class="club-stats">
                <span>Fundado: ${club.founded}</span>
                <span>Jugadores: ${club.players}</span>
            </div>
            <div class="club-actions">
                <button class="btn btn-small" onclick="editClub(${club.id})">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-danger btn-small" onclick="deleteClub(${club.id})">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        `;
        clubsGrid.appendChild(clubCard);
    });
}

async function handleClubSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const clubId = formData.get('clubId');
    
    // Validar datos
    const clubName = formData.get('clubName').trim();
    const clubDescription = formData.get('clubDescription').trim();
    const clubFounded = parseInt(formData.get('clubFounded'));
    const clubPlayers = parseInt(formData.get('clubPlayers'));
    
    if (!clubName || !clubDescription || !clubFounded || !clubPlayers) {
        showNotification('Por favor completa todos los campos', 'error');
        return;
    }
    
    if (clubFounded < 2000 || clubFounded > 2030) {
        showNotification('El año de fundación debe estar entre 2000 y 2030', 'error');
        return;
    }
    
    if (clubPlayers < 1 || clubPlayers > 50) {
        showNotification('El número de jugadores debe estar entre 1 y 50', 'error');
        return;
    }
    
    try {
        const url = clubId ? `/api/clubs/${clubId}` : '/api/clubs';
        const method = clubId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            body: formData
        });
        
        if (response.ok) {
            const action = clubId ? 'actualizado' : 'agregado';
            showNotification(`Club ${action} exitosamente`, 'success');
            
            // Limpiar formulario y recargar
            e.target.reset();
            cancelClubEdit();
            await loadClubs();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error guardando club', 'error');
        }
    } catch (error) {
        console.error('Error submitting club:', error);
        showNotification('Error de conexión', 'error');
    }
}

function editClub(clubId) {
    const club = clubs.find(c => c.id === clubId);
    if (!club) return;
    
    // Llenar formulario con datos del club
    document.getElementById('clubId').value = club.id;
    document.getElementById('clubName').value = club.name;
    document.getElementById('clubDescription').value = club.description;
    document.getElementById('clubFounded').value = club.founded;
    document.getElementById('clubPlayers').value = club.players;
    
    // Cambiar texto del botón y mostrar cancelar
    document.getElementById('clubFormAction').textContent = 'Actualizar Club';
    document.getElementById('cancelClubBtn').style.display = 'inline-block';
    
    // Scroll al formulario
    document.getElementById('clubForm').scrollIntoView({ behavior: 'smooth' });
}

function cancelClubEdit() {
    // Limpiar formulario
    document.getElementById('clubForm').reset();
    document.getElementById('clubId').value = '';
    
    // Restaurar texto del botón y ocultar cancelar
    document.getElementById('clubFormAction').textContent = 'Agregar Club';
    document.getElementById('cancelClubBtn').style.display = 'none';
}

async function deleteClub(clubId) {
    const club = clubs.find(c => c.id === clubId);
    if (!club) return;
    
    if (!confirm(`¿Estás seguro de que quieres eliminar el club "${club.name}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/clubs/${clubId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Club eliminado exitosamente', 'success');
            await loadClubs();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error eliminando club', 'error');
        }
    } catch (error) {
        console.error('Error deleting club:', error);
        showNotification('Error de conexión', 'error');
    }
}

// ==================== TEAMS MANAGEMENT ====================

// Global variable for clubs
let clubs = [];

async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        if (!response.ok) throw new Error('Error fetching teams');
        
        teams = await response.json();
        renderTeams();
        populateTeamSelects();
    } catch (error) {
        console.error('Error loading teams:', error);
        showNotification('Error cargando equipos', 'error');
    }
}

function renderTeams() {
    const teamsGrid = document.getElementById('teamsGrid');
    if (!teamsGrid) return;

    teamsGrid.innerHTML = '';

    teams.forEach(team => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';
        teamCard.innerHTML = `
            <div class="team-name">${team.name}</div>
            <div class="team-info">
                <i class="fas fa-image"></i> ${team.logo || 'Sin logo'}
            </div>
            <div class="team-actions">
                <button class="btn btn-danger" onclick="deleteTeam(${team.id})">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        `;
        teamsGrid.appendChild(teamCard);
    });
}

async function handleTeamSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const teamData = {
        name: formData.get('teamName').trim(),
        logo: formData.get('teamLogo').trim() || 'img/default-team.png'
    };

    if (!teamData.name) {
        showNotification('El nombre del equipo es requerido', 'error');
        return;
    }

    try {
        const response = await fetch('/api/teams', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(teamData)
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Equipo agregado exitosamente', 'success');
            e.target.reset();
            await loadTeams();
        } else {
            showNotification(result.error || 'Error agregando equipo', 'error');
        }
    } catch (error) {
        console.error('Error adding team:', error);
        showNotification('Error de conexión', 'error');
    }
}

async function deleteTeam(teamId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este equipo?')) {
        return;
    }

    try {
        const response = await fetch(`/api/teams/${teamId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Equipo eliminado exitosamente', 'success');
            await loadTeams();
        } else {
            showNotification(result.error || 'Error eliminando equipo', 'error');
        }
    } catch (error) {
        console.error('Error deleting team:', error);
        showNotification('Error de conexión', 'error');
    }
}

function populateTeamSelects() {
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');

    if (!homeTeamSelect || !awayTeamSelect) return;

    // Clear existing options (except first one)
    homeTeamSelect.innerHTML = '<option value="">Seleccionar equipo...</option>';
    awayTeamSelect.innerHTML = '<option value="">Seleccionar equipo...</option>';

    teams.forEach(team => {
        const homeOption = document.createElement('option');
        homeOption.value = team.name;
        homeOption.textContent = team.name;
        homeTeamSelect.appendChild(homeOption);

        const awayOption = document.createElement('option');
        awayOption.value = team.name;
        awayOption.textContent = team.name;
        awayTeamSelect.appendChild(awayOption);
    });
}

// ==================== MATCHES MANAGEMENT ====================

async function loadMatches() {
    try {
        const response = await fetch('/api/tournament/matches');
        if (!response.ok) throw new Error('Error fetching matches');
        
        matches = await response.json();
        if (currentTab === 'matches') {
            renderMatches();
        }
    } catch (error) {
        console.error('Error loading matches:', error);
        showNotification('Error cargando partidos', 'error');
    }
}

function renderMatches() {
    const matchesGrid = document.getElementById('matchesGrid');
    if (!matchesGrid) return;

    matchesGrid.innerHTML = '';

    matches.forEach(match => {
        const matchCard = document.createElement('div');
        matchCard.className = 'match-card';
        
        const statusText = match.status === 'finished' ? 'Finalizado' : 'Programado';
        const scoreText = match.status === 'finished' && match.homeScore !== null && match.awayScore !== null 
            ? `${match.homeScore} - ${match.awayScore}` 
            : 'vs';

        matchCard.innerHTML = `
            <div class="match-teams">${match.homeTeam} ${scoreText} ${match.awayTeam}</div>
            <div class="match-info">
                <i class="fas fa-calendar"></i> ${match.date} - ${match.time}<br>
                <i class="fas fa-futbol"></i> Jornada ${match.matchday}<br>
                <i class="fas fa-info-circle"></i> ${statusText}
            </div>
            <div class="match-actions">
                <button class="btn btn-danger" onclick="deleteMatch(${match.id})">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        `;
        matchesGrid.appendChild(matchCard);
    });
}

async function handleMatchSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const matchData = {
        homeTeam: formData.get('homeTeam'),
        awayTeam: formData.get('awayTeam'),
        date: formData.get('matchDate'),
        time: formData.get('matchTime'),
        matchday: parseInt(formData.get('matchday'))
    };

    if (!matchData.homeTeam || !matchData.awayTeam || !matchData.date || !matchData.time) {
        showNotification('Todos los campos son requeridos', 'error');
        return;
    }

    if (matchData.homeTeam === matchData.awayTeam) {
        showNotification('Un equipo no puede jugar contra sí mismo', 'error');
        return;
    }

    try {
        const response = await fetch('/api/tournament/matches', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(matchData)
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Partido agregado exitosamente', 'success');
            e.target.reset();
            await loadMatches();
        } else {
            showNotification(result.error || 'Error agregando partido', 'error');
        }
    } catch (error) {
        console.error('Error adding match:', error);
        showNotification('Error de conexión', 'error');
    }
}

async function deleteMatch(matchId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este partido?')) {
        return;
    }

    try {
        const response = await fetch(`/api/tournament/matches/${matchId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Partido eliminado exitosamente', 'success');
            await loadMatches();
            if (currentTab === 'results') {
                loadPendingMatches();
            }
        } else {
            showNotification(result.error || 'Error eliminando partido', 'error');
        }
    } catch (error) {
        console.error('Error deleting match:', error);
        showNotification('Error de conexión', 'error');
    }
}

// ==================== RESULTS MANAGEMENT ====================

async function loadPendingMatches() {
    try {
        // Cargar TODOS los partidos (programados y finalizados)
        const response = await fetch('/api/tournament/matches');
        if (!response.ok) throw new Error('Error fetching matches');
        
        const allMatches = await response.json();
        renderAllMatches(allMatches);
    } catch (error) {
        console.error('Error loading matches:', error);
        showNotification('Error cargando partidos', 'error');
    }
}

function renderAllMatches(allMatches) {
    const resultsGrid = document.getElementById('resultsGrid');
    if (!resultsGrid) return;

    resultsGrid.innerHTML = '';

    if (allMatches.length === 0) {
        resultsGrid.innerHTML = '<p style="color: rgba(255,255,255,0.7); text-align: center;">No hay partidos creados</p>';
        return;
    }

    // Separar partidos por estado
    const scheduledMatches = allMatches.filter(m => m.status === 'scheduled');
    const finishedMatches = allMatches.filter(m => m.status === 'finished');

    // Mostrar partidos programados primero
    if (scheduledMatches.length > 0) {
        const pendingTitle = document.createElement('h3');
        pendingTitle.innerHTML = '<i class="fas fa-clock"></i> Partidos Pendientes';
        pendingTitle.style.color = '#00ff88';
        pendingTitle.style.marginBottom = '20px';
        resultsGrid.appendChild(pendingTitle);

        scheduledMatches.forEach(match => {
            const matchCard = document.createElement('div');
            matchCard.className = 'match-card';
            matchCard.innerHTML = `
                <div class="match-teams">${match.homeTeam} vs ${match.awayTeam}</div>
                <div class="match-info">
                    <i class="fas fa-calendar"></i> ${match.date} - ${match.time}<br>
                    <i class="fas fa-futbol"></i> Jornada ${match.matchday}<br>
                    <i class="fas fa-info-circle"></i> Programado
                </div>
                <div class="match-result">
                    <input type="number" id="homeScore_${match.id}" min="0" placeholder="0" style="width: 60px;">
                    <span class="vs-text">-</span>
                    <input type="number" id="awayScore_${match.id}" min="0" placeholder="0" style="width: 60px;">
                    <button class="btn" onclick="updateMatchResult(${match.id})">
                        <i class="fas fa-save"></i> Guardar
                    </button>
                </div>
            `;
            resultsGrid.appendChild(matchCard);
        });
    }

    // Mostrar partidos finalizados
    if (finishedMatches.length > 0) {
        const finishedTitle = document.createElement('h3');
        finishedTitle.innerHTML = '<i class="fas fa-check-circle"></i> Partidos Finalizados';
        finishedTitle.style.color = '#00ff88';
        finishedTitle.style.marginTop = '30px';
        finishedTitle.style.marginBottom = '20px';
        resultsGrid.appendChild(finishedTitle);

        finishedMatches.forEach(match => {
            const matchCard = document.createElement('div');
            matchCard.className = 'match-card';
            matchCard.style.borderColor = 'rgba(0, 255, 136, 0.5)';
            matchCard.innerHTML = `
                <div class="match-teams">${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}</div>
                <div class="match-info">
                    <i class="fas fa-calendar"></i> ${match.date} - ${match.time}<br>
                    <i class="fas fa-futbol"></i> Jornada ${match.matchday}<br>
                    <i class="fas fa-check-circle"></i> Finalizado
                </div>
                <div class="match-result">
                    <input type="number" id="homeScore_${match.id}" min="0" value="${match.homeScore}" style="width: 60px;">
                    <span class="vs-text">-</span>
                    <input type="number" id="awayScore_${match.id}" min="0" value="${match.awayScore}" style="width: 60px;">
                    <button class="btn" onclick="updateMatchResult(${match.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger" onclick="clearMatchResult(${match.id})">
                        <i class="fas fa-undo"></i> Eliminar Resultado
                    </button>
                </div>
            `;
            resultsGrid.appendChild(matchCard);
        });
    }
}

async function updateMatchResult(matchId) {
    const homeScoreInput = document.getElementById(`homeScore_${matchId}`);
    const awayScoreInput = document.getElementById(`awayScore_${matchId}`);

    const homeScore = parseInt(homeScoreInput.value);
    const awayScore = parseInt(awayScoreInput.value);

    if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
        showNotification('Por favor ingresa resultados válidos', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/tournament/matches/${matchId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                homeScore: homeScore,
                awayScore: awayScore,
                status: 'finished'
            })
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Resultado actualizado exitosamente', 'success');
            await loadMatches();
            loadPendingMatches();
        } else {
            showNotification(result.error || 'Error actualizando resultado', 'error');
        }
    } catch (error) {
        console.error('Error updating match result:', error);
        showNotification('Error de conexión', 'error');
    }
}

// ==================== UTILITY FUNCTIONS ====================

// Obtener el nombre del formato del torneo
function getFormatName(format) {
    const formats = {
        '8': 'Octavos de Final',
        '4': 'Cuartos de Final',
        '2': 'Semifinal',
        '1': 'Final',
        '16': 'Dieciseisavos de Final',
        '32': 'Treintaidosavos de Final'
    };
    return formats[format] || `Formato ${format} equipos`;
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

async function clearMatchResult(matchId) {
    if (!confirm('¿Estás seguro de que quieres eliminar el resultado de este partido?')) {
        return;
    }

    try {
        const response = await fetch(`/api/tournament/matches/${matchId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                homeScore: null,
                awayScore: null,
                status: 'scheduled'
            })
        });

        const result = await response.json();

        if (response.ok) {
            showNotification('Resultado eliminado exitosamente', 'success');
            await loadMatches();
            loadPendingMatches(); // Recargar la vista de resultados
        } else {
            showNotification(result.error || 'Error eliminando resultado', 'error');
        }
    } catch (error) {
        console.error('Error clearing match result:', error);
        showNotification('Error de conexión', 'error');
    }
}

// ==================== CONFIGURATION MANAGEMENT ====================

let classificationZones = [];

async function loadConfiguration() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            const settings = await response.json();
            
            // Cargar zonas de clasificación
            if (settings.classificationZones && settings.classificationZones.length > 0) {
                classificationZones = settings.classificationZones;
            } else {
                // Zonas por defecto
                classificationZones = [
                    { id: 1, name: 'Clasificación Directa', positions: '1-4', color: '#00ff88' },
                    { id: 2, name: 'Repechaje', positions: '5-8', color: '#ffa500' },
                    { id: 3, name: 'Eliminación', positions: '9-12', color: '#ff4757' }
                ];
            }
            
            renderClassificationZones();
            
            // Cargar configuración general
            document.getElementById('seasonName').value = settings.seasonName || 'Temporada 2025';
            document.getElementById('pointsWin').value = settings.pointsWin || 3;
            document.getElementById('pointsDraw').value = settings.pointsDraw || 1;
            document.getElementById('playoffFormat').value = settings.playoffFormat || '8';
        }
    } catch (error) {
        console.error('Error loading configuration:', error);
        // Usar zonas por defecto en caso de error
        classificationZones = [
            { id: 1, name: 'Clasificación Directa', positions: '1-4', color: '#00ff88' },
            { id: 2, name: 'Repechaje', positions: '5-8', color: '#ffa500' },
            { id: 3, name: 'Eliminación', positions: '9-12', color: '#ff4757' }
        ];
        renderClassificationZones();
    }
}

function renderClassificationZones() {
    const container = document.getElementById('classificationZones');
    if (!container) return;
    
    container.innerHTML = '';
    
    classificationZones.forEach((zone, index) => {
        const zoneDiv = document.createElement('div');
        zoneDiv.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(0, 255, 136, 0.3);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            display: grid;
            grid-template-columns: 1fr 1fr 80px 50px;
            gap: 15px;
            align-items: center;
        `;
        
        zoneDiv.innerHTML = `
            <div class="form-group" style="margin: 0;">
                <label style="color: #00ff88; font-size: 14px;">Nombre de la Zona</label>
                <input type="text" value="${zone.name}" onchange="updateZone(${zone.id}, 'name', this.value)" 
                       style="background: rgba(255,255,255,0.1); border: 1px solid rgba(0,255,136,0.3); color: white; padding: 8px; border-radius: 4px; width: 100%;">
            </div>
            <div class="form-group" style="margin: 0;">
                <label style="color: #00ff88; font-size: 14px;">Posiciones</label>
                <input type="text" value="${zone.positions}" onchange="updateZone(${zone.id}, 'positions', this.value)" 
                       placeholder="1-4" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(0,255,136,0.3); color: white; padding: 8px; border-radius: 4px; width: 100%;">
            </div>
            <div class="form-group" style="margin: 0;">
                <label style="color: #00ff88; font-size: 14px;">Color</label>
                <input type="color" value="${zone.color}" onchange="updateZone(${zone.id}, 'color', this.value)" 
                       style="width: 100%; height: 40px; border: none; border-radius: 4px; cursor: pointer;">
            </div>
            <button onclick="removeZone(${zone.id})" 
                    style="background: #ff4757; border: none; color: white; padding: 8px; border-radius: 4px; cursor: pointer; height: 40px;">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        container.appendChild(zoneDiv);
    });
}

function addClassificationZone() {
    const newId = Math.max(...classificationZones.map(z => z.id), 0) + 1;
    const newZone = {
        id: newId,
        name: 'Nueva Zona',
        positions: '1-2',
        color: '#00ff88'
    };
    
    classificationZones.push(newZone);
    renderClassificationZones();
}

function updateZone(id, field, value) {
    const zone = classificationZones.find(z => z.id === id);
    if (zone) {
        zone[field] = value;
    }
}

function removeZone(id) {
    if (classificationZones.length <= 1) {
        showNotification('Debe haber al menos una zona de clasificación', 'error');
        return;
    }
    
    if (confirm('¿Estás seguro de que quieres eliminar esta zona?')) {
        classificationZones = classificationZones.filter(z => z.id !== id);
        renderClassificationZones();
    }
}

async function saveTableConfig() {
    try {
        const response = await fetch('/api/settings/classification-zones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ classificationZones })
        });
        
        if (response.ok) {
            showNotification('Zonas de clasificación guardadas exitosamente', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error guardando configuración', 'error');
        }
    } catch (error) {
        console.error('Error saving classification zones:', error);
        showNotification('Error de conexión', 'error');
    }
}

async function saveTournamentConfig() {
    const tournamentConfig = {
        seasonName: document.getElementById('seasonName').value,
        pointsWin: parseInt(document.getElementById('pointsWin').value),
        pointsDraw: parseInt(document.getElementById('pointsDraw').value),
        playoffFormat: document.getElementById('playoffFormat').value
    };
    
    try {
        const response = await fetch('/api/settings/tournament-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tournamentConfig)
        });
        
        if (response.ok) {
            showNotification('Configuración de torneo guardada exitosamente', 'success');
        } else {
            showNotification('Error guardando configuración', 'error');
        }
    } catch (error) {
        console.error('Error saving tournament config:', error);
        showNotification('Error de conexión', 'error');
    }
}

// ==================== PLAYOFFS MANAGEMENT ====================

let currentBracket = null;

async function loadPlayoffsManagement() {
    await loadTeamsForSelection();
    await loadCurrentBracket();
}

async function loadTeamsForSelection() {
    const teamSelection = document.getElementById('teamSelection');
    if (!teamSelection) return;
    
    teamSelection.innerHTML = '';
    
    teams.forEach(team => {
        const teamCheckbox = document.createElement('div');
        teamCheckbox.innerHTML = `
            <label style="display: flex; align-items: center; color: white; cursor: pointer;">
                <input type="checkbox" value="${team.name}" style="margin-right: 10px;">
                ${team.name}
            </label>
        `;
        teamSelection.appendChild(teamCheckbox);
    });
}

function showManualSelection() {
    const manualSelection = document.getElementById('manualSelection');
    manualSelection.style.display = manualSelection.style.display === 'none' ? 'block' : 'none';
}

async function generateBracket() {
    const format = document.getElementById('bracketFormat').value;
    const numTeams = parseInt(format);
    
    try {
        // Obtener tabla de posiciones actual
        const response = await fetch('/api/standings');
        if (!response.ok) throw new Error('Error fetching standings');
        
        const standings = await response.json();
        
        // Tomar los primeros N equipos según el formato
        const qualifiedTeams = standings.slice(0, numTeams).map(team => team.team);
        
        if (qualifiedTeams.length < numTeams) {
            showNotification(`Se necesitan al menos ${numTeams} equipos en la tabla`, 'error');
            return;
        }
        
        await createBracket(qualifiedTeams, format);
        
    } catch (error) {
        console.error('Error generating bracket:', error);
        showNotification('Error generando bracket', 'error');
    }
}

async function createManualBracket() {
    const format = document.getElementById('bracketFormat').value;
    const numTeams = parseInt(format);
    
    const checkboxes = document.querySelectorAll('#teamSelection input[type="checkbox"]:checked');
    const selectedTeams = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedTeams.length !== numTeams) {
        showNotification(`Debes seleccionar exactamente ${numTeams} equipos`, 'error');
        return;
    }
    
    await createBracket(selectedTeams, format);
}

async function createBracket(teams, format) {
    const bracket = {
        format: format,
        teams: teams,
        matches: generateBracketMatches(teams, format),
        createdAt: new Date().toISOString()
    };
    
    try {
        const response = await fetch('/api/playoffs/bracket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bracket)
        });
        
        if (response.ok) {
            currentBracket = bracket;
            renderBracket(bracket);
            showNotification('Bracket creado exitosamente', 'success');
            
            // Ocultar selección manual
            document.getElementById('manualSelection').style.display = 'none';
        } else {
            showNotification('Error creando bracket', 'error');
        }
    } catch (error) {
        console.error('Error creating bracket:', error);
        showNotification('Error de conexión', 'error');
    }
}

function generateBracketMatches(teams, format) {
    const matches = [];
    const numTeams = parseInt(format);
    let matchId = 1;
    
    if (numTeams === 16) {
        // OCTAVOS DE FINAL (16 equipos = 8 partidos)
        for (let i = 0; i < 8; i++) {
            matches.push({
                id: `match_${matchId++}`,
                round: 1,
                roundName: 'Octavos de Final',
                homeTeam: teams[i],
                awayTeam: teams[15 - i],
                homeScore: null,
                awayScore: null,
                status: 'pending'
            });
        }
        
        // CUARTOS DE FINAL (4 partidos)
        for (let i = 0; i < 4; i++) {
            matches.push({
                id: `match_${matchId++}`,
                round: 2,
                roundName: 'Cuartos de Final',
                homeTeam: `Ganador Match ${i * 2 + 1}`,
                awayTeam: `Ganador Match ${i * 2 + 2}`,
                homeScore: null,
                awayScore: null,
                status: 'pending'
            });
        }
        
        // SEMIFINALES (2 partidos)
        for (let i = 0; i < 2; i++) {
            matches.push({
                id: `match_${matchId++}`,
                round: 3,
                roundName: 'Semifinales',
                homeTeam: `Ganador Match ${9 + i * 2}`,
                awayTeam: `Ganador Match ${10 + i * 2}`,
                homeScore: null,
                awayScore: null,
                status: 'pending'
            });
        }
        
        // FINAL (1 partido)
        matches.push({
            id: `match_${matchId++}`,
            round: 4,
            roundName: 'Final',
            homeTeam: 'Ganador Match 13',
            awayTeam: 'Ganador Match 14',
            homeScore: null,
            awayScore: null,
            status: 'pending'
        });
        
    } else if (numTeams === 8) {
        // CUARTOS DE FINAL (8 equipos = 4 partidos)
        for (let i = 0; i < 4; i++) {
            matches.push({
                id: `match_${matchId++}`,
                round: 1,
                roundName: 'Cuartos de Final',
                homeTeam: teams[i],
                awayTeam: teams[7 - i],
                homeScore: null,
                awayScore: null,
                status: 'pending'
            });
        }
        
        // SEMIFINALES (2 partidos)
        for (let i = 0; i < 2; i++) {
            matches.push({
                id: `match_${matchId++}`,
                round: 2,
                roundName: 'Semifinales',
                homeTeam: `Ganador Match ${i * 2 + 1}`,
                awayTeam: `Ganador Match ${i * 2 + 2}`,
                homeScore: null,
                awayScore: null,
                status: 'pending'
            });
        }
        
        // FINAL (1 partido)
        matches.push({
            id: `match_${matchId++}`,
            round: 3,
            roundName: 'Final',
            homeTeam: 'Ganador Match 5',
            awayTeam: 'Ganador Match 6',
            homeScore: null,
            awayScore: null,
            status: 'pending'
        });
        
    } else if (numTeams === 4) {
        // SEMIFINALES (4 equipos = 2 partidos)
        for (let i = 0; i < 2; i++) {
            matches.push({
                id: `match_${matchId++}`,
                round: 1,
                roundName: 'Semifinales',
                homeTeam: teams[i],
                awayTeam: teams[3 - i],
                homeScore: null,
                awayScore: null,
                status: 'pending'
            });
        }
        
        // FINAL (1 partido)
        matches.push({
            id: `match_${matchId++}`,
            round: 2,
            roundName: 'Final',
            homeTeam: 'Ganador Match 1',
            awayTeam: 'Ganador Match 2',
            homeScore: null,
            awayScore: null,
            status: 'pending'
        });
    }
    
    return matches;
}

// Función auxiliar para obtener el nombre de la ronda
function getRoundName(round, format) {
    const roundNum = parseInt(round);
    const totalRounds = Math.log2(parseInt(format)) + 1;
    
    switch (totalRounds - roundNum) {
        case 0: return 'Final';
        case 1: return 'Semifinales';
        case 2: return 'Cuartos de Final';
        case 3: return 'Octavos de Final';
        case 4: return 'Dieciseisavos de Final';
        default: return `Ronda ${roundNum}`;
    }
}

function renderBracket(bracket) {
    const bracketDisplay = document.getElementById('bracketDisplay');
    if (!bracketDisplay) return;
    
    // Agrupar partidos por ronda
    const matchesByRound = {};
    bracket.matches.forEach(match => {
        if (!matchesByRound[match.round]) {
            matchesByRound[match.round] = [];
        }
        matchesByRound[match.round].push(match);
    });
    
    // Ordenar las rondas numéricamente
    const sortedRounds = Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b));
    
    // Estilos para hacer el bracket más compacto
    const bracketStyles = `
        .bracket-container {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin: 10px 0;
            overflow-x: auto;
            padding: 10px 0;
        }
        .bracket-round {
            display: flex;
            flex-direction: column;
            gap: 10px;
            min-width: 200px;
        }
        .bracket-match {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid #00ff88;
            border-radius: 6px;
            padding: 8px;
            font-size: 0.85em;
        }
        .bracket-team {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 3px 0;
        }
        .bracket-team.winner {
            color: #00ff88;
            font-weight: bold;
        }
        .bracket-score {
            width: 30px;
            text-align: center;
            margin: 0 2px;
            padding: 2px;
            font-size: 0.9em;
        }
        .bracket-actions {
            display: flex;
            justify-content: flex-end;
            gap: 5px;
            margin-top: 8px;
        }
        .bracket-actions button {
            padding: 2px 6px;
            font-size: 0.8em;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }
        .bracket-save {
            background: #00ff88;
            color: #000;
        }
        .bracket-clear {
            background: #ff4444;
            color: white;
        }
        .bracket-round-title {
            text-align: center;
            color: #00ff88;
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 0.9em;
            white-space: nowrap;
        }
    `;
    
    let html = `
        <style>${bracketStyles}</style>
        <h3 style="color: #00ff88; text-align: center; margin: 0 0 10px 0; font-size: 1.1em;">
            <i class="fas fa-trophy"></i> Bracket de ${getFormatName(bracket.format)}
        </h3>
        <div class="bracket-container">
    `;
    
    // Renderizar cada ronda en columnas
    sortedRounds.forEach(round => {
        const roundMatches = matchesByRound[round].sort((a, b) => a.matchNumber - b.matchNumber);
        const roundName = getRoundName(round, bracket.format);
        
        html += `
            <div class="bracket-round">
                <div class="bracket-round-title">${roundName}</div>
        `;
    
        // Renderizar cada partido de la ronda
        roundMatches.forEach((match, index) => {
            const isFinished = match.homeScore !== null && match.awayScore !== null && 
                             match.homeScore !== undefined && match.awayScore !== undefined;
            const homeWinner = isFinished && parseInt(match.homeScore) > parseInt(match.awayScore);
            const awayWinner = isFinished && parseInt(match.awayScore) > parseInt(match.homeScore);
            
            // Mostrar el marcador junto al nombre del equipo si el partido está terminado
            const homeDisplay = match.homeTeam ? 
                `${match.homeTeam}${isFinished ? ` (${match.homeScore})` : ''}` : 
                'Por definir';
                
            const awayDisplay = match.awayTeam ? 
                `${match.awayTeam}${isFinished ? ` (${match.awayScore})` : ''}` : 
                'Por definir';
            
            html += `
                <div class="bracket-match">
                    <div class="bracket-team ${homeWinner ? 'winner' : ''}">
                        <span>${homeDisplay}</span>
                        <input type="number" id="homeScore_${match.id}" 
                            value="${match.homeScore !== null && match.homeScore !== undefined ? match.homeScore : ''}" 
                            class="bracket-score" 
                            min="0"
                            onchange="document.getElementById('saveBtn_${match.id}').style.display='inline-block'"
                            ${isFinished ? 'disabled' : ''}
                        >
                    </div>
                    
                    <div class="bracket-team ${awayWinner ? 'winner' : ''}">
                        <span>${awayDisplay}</span>
                        <input type="number" id="awayScore_${match.id}" 
                            value="${match.awayScore !== null && match.awayScore !== undefined ? match.awayScore : ''}" 
                            class="bracket-score" 
                            min="0"
                            onchange="document.getElementById('saveBtn_${match.id}').style.display='inline-block'"
                            ${isFinished ? 'disabled' : ''}
                        >
                    </div>
                    
                    <div class="bracket-actions">
                        <button id="saveBtn_${match.id}" 
                            onclick="updatePlayoffMatch('${match.id}')" 
                            style="display: ${isFinished ? 'none' : 'inline-block'}"
                            class="bracket-save">
                            Guardar
                        </button>
                        ${isFinished ? `
                        <button onclick="clearPlayoffMatch('${match.id}')" 
                            class="bracket-clear">
                            Limpiar
                        </button>` : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>'; // Cerrar bracket-round
    });
    
    html += '</div>'; // Cerrar bracket-container
    
    if (bracket.matches.length > 0) {
        html += `
            <div style="text-align: center; margin-top: 15px;">
                <button class="btn btn-danger btn-sm" onclick="clearBracket()">
                    <i class="fas fa-trash"></i> Eliminar Bracket
                </button>
            </div>
        `;
    }
    
    bracketDisplay.innerHTML = html;
    
    // Asegurar que el contenedor tenga el ancho adecuado para el contenido
    const container = bracketDisplay.querySelector('.bracket-container');
    if (container) {
        container.style.width = `${sortedRounds.length * 220}px`;
    }
}

async function loadCurrentBracket() {
    try {
        const response = await fetch('/api/playoffs/bracket');
        if (response.ok) {
            const bracket = await response.json();
            if (bracket && bracket.teams) {
                currentBracket = bracket;
                renderBracket(bracket);
            }
        }
    } catch (error) {
        console.error('Error loading current bracket:', error);
    }
}

async function clearBracket() {
    if (!confirm('¿Estás seguro de que quieres eliminar el bracket actual?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/playoffs/bracket', {
            method: 'DELETE'
        });
        
        if (response.ok) {
            currentBracket = null;
            document.getElementById('bracketDisplay').innerHTML = '<p style="color: rgba(255,255,255,0.7); text-align: center;">No hay bracket generado. Usa los botones de arriba para crear uno.</p>';
            showNotification('Bracket eliminado exitosamente', 'success');
        } else {
            showNotification('Error eliminando bracket', 'error');
        }
    } catch (error) {
        console.error('Error clearing bracket:', error);
        showNotification('Error de conexión', 'error');
    }
}

// Actualizar resultado de partido de playoffs
async function updatePlayoffMatch(matchId) {
    const homeScoreInput = document.getElementById(`homeScore_${matchId}`);
    const awayScoreInput = document.getElementById(`awayScore_${matchId}`);
    const homeScore = homeScoreInput ? homeScoreInput.value.trim() : '';
    const awayScore = awayScoreInput ? awayScoreInput.value.trim() : '';
    
    // Validaciones
    if (homeScore === '' || awayScore === '') {
        showNotification('❌ Por favor ingresa ambos resultados', 'error');
        return;
    }
    
    const homeScoreInt = parseInt(homeScore);
    const awayScoreInt = parseInt(awayScore);
    
    if (isNaN(homeScoreInt) || isNaN(awayScoreInt)) {
        showNotification('❌ Los resultados deben ser números válidos', 'error');
        return;
    }
    
    if (homeScoreInt < 0 || awayScoreInt < 0) {
        showNotification('❌ Los resultados no pueden ser negativos', 'error');
        return;
    }
    
    if (homeScoreInt === awayScoreInt) {
        showNotification('❌ No se permiten empates en partidos de eliminatoria', 'error');
        return;
    }
    
    // Mostrar indicador de carga
    const saveBtn = document.getElementById(`saveBtn_${matchId}`);
    const originalBtnText = saveBtn ? saveBtn.innerHTML : '';
    
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }
    
    try {
        const response = await fetch(`/api/playoffs/matches/${matchId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                homeScore: homeScoreInt,
                awayScore: awayScoreInt,
                status: 'finished'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            const winner = homeScoreInt > awayScoreInt ? 
                result.match.homeTeam : result.match.awayTeam;
            
            // Mostrar notificación del ganador
            showNotification(`✅ Resultado guardado. ¡${winner} avanza a la siguiente ronda!`, 'success');
            console.log('✅ Resultado de playoff actualizado:', result.match);
            
            // Recargar bracket completo para mostrar cambios
            await loadCurrentBracket();
            
            // Desplazarse al bracket actualizado
            const bracketDisplay = document.getElementById('bracketDisplay');
            if (bracketDisplay) {
                bracketDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
        } else {
            const error = await response.json().catch(() => ({}));
            showNotification(`❌ ${error.error || 'Error actualizando resultado'}`, 'error');
            console.error('Error en la respuesta del servidor:', error);
        }
    } catch (error) {
        console.error('Error actualizando partido de playoff:', error);
        showNotification('❌ Error de conexión al actualizar el partido', 'error');
    } finally {
        // Restaurar estado del botón si existe
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;
        }
    }
}

// Limpiar resultado de partido de playoffs
async function clearPlayoffMatch(matchId) {
    if (!confirm('¿Estás seguro de que quieres limpiar este resultado?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/playoffs/matches/${matchId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                homeScore: null,
                awayScore: null
            })
        });
        
        if (response.ok) {
            showNotification('Resultado limpiado exitosamente', 'success');
            
            // Recargar bracket para mostrar cambios
            await loadCurrentBracket();
            
            console.log('✅ Resultado de playoff limpiado');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error limpiando resultado', 'error');
        }
    } catch (error) {
        console.error('Error clearing playoff match:', error);
        showNotification('Error de conexión', 'error');
    }
}

// Make functions globally available
window.deleteTeam = deleteTeam;
window.editClub = editClub;
window.deleteClub = deleteClub;
window.cancelClubEdit = cancelClubEdit;
window.deleteMatch = deleteMatch;
window.updateMatchResult = updateMatchResult;
window.clearMatchResult = clearMatchResult;
window.saveTableConfig = saveTableConfig;
window.saveTournamentConfig = saveTournamentConfig;
window.generateBracket = generateBracket;
window.showManualSelection = showManualSelection;
window.createManualBracket = createManualBracket;
window.clearBracket = clearBracket;
window.addClassificationZone = addClassificationZone;
window.updateZone = updateZone;
window.removeZone = removeZone;
window.updatePlayoffMatch = updatePlayoffMatch;
window.clearPlayoffMatch = clearPlayoffMatch;
