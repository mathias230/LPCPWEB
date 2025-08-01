// Admin panel functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Inicializando panel de administración...');
    
    initializeAdmin();
    setupEventListeners();
    loadInitialData();
    initializeWebSocket(); // Inicializar WebSocket para sincronización
    
    console.log('✅ Panel de administración inicializado');
});

// Global variables
let teams = [];
let matches = [];
let players = [];
let currentTab = 'teams';
let editingPlayerId = null;
let socket = null;

// Inicializar WebSocket
function initializeWebSocket() {
    if (typeof io !== 'undefined') {
        socket = io();
        
        socket.on('connect', () => {
            console.log('✅ Admin conectado al servidor WebSocket');
        });
        
        // Handler para actualizaciones de clubes
        socket.on('clubsUpdate', (updatedClubs) => {
            console.log('🏢 Actualización de clubes recibida:', updatedClubs.length);
            clubs = updatedClubs;
            if (currentTab === 'clubs') {
                renderClubs();
            }
        });
        
        // Handler para actualizaciones de equipos
        socket.on('teamsUpdate', (updatedTeams) => {
            console.log('🏆 Actualización de equipos recibida:', updatedTeams.length);
            teams = updatedTeams;
            if (currentTab === 'teams') {
                renderTeams();
            }
            populateTeamSelects();
        });
        
        // Handler para actualizaciones de jugadores
        socket.on('playersUpdate', (updatedPlayers) => {
            console.log('🏃 Actualización de jugadores recibida:', updatedPlayers.length);
            players = updatedPlayers;
            if (currentTab === 'players' && selectedTeamId) {
                loadTeamPlayers(selectedTeamId);
            }
        });
        
        // Handler para cambios específicos de estadísticas
        socket.on('playerStatsChanged', (data) => {
            console.log(`📊 Estadística actualizada: ${data.playerName} - ${data.statType}: ${data.value}`);
            showNotification(`${data.playerName}: ${data.statType === 'goals' ? 'Goles' : 'Asistencias'} actualizado a ${data.value}`, 'success');
        });
        
        socket.on('disconnect', () => {
            console.log('❌ Admin desconectado del servidor WebSocket');
        });
        
        // Hacer socket disponible globalmente para updatePlayerStats
        window.socket = socket;
    }
}

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

    // Player management is now handled by the new tab system
    // Event listeners are set up in setupPlayerEventListeners()

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
        case 'players':
            loadPlayers();
            populateClubSelects();
            break;
        case 'matches':
            loadMatches();
            populateTeamSelects();
            break;
        case 'results':
            loadPendingMatches();
            break;
        case 'calendar':
        case 'calendario':
            loadCalendarMatches();
            break;
        case 'config':
            loadConfiguration();
            break;
        case 'playoffs':
            loadPlayoffsManagement();
            break;
        case 'clips':
            loadClipsManagement();
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

// ==================== PLAYERS MANAGEMENT ====================

// Variables globales para el nuevo sistema
let selectedTeamId = null;
let teamPlayers = [];

// Cargar jugadores y equipos
async function loadPlayers() {
    try {
        const response = await fetch('/api/players');
        if (!response.ok) throw new Error('Error fetching players');
        
        players = await response.json();
        console.log('✅ Jugadores cargados:', players);
        
        // Cargar equipos y crear pestañas
        await loadTeamsForPlayerManagement();
        setupPlayerEventListeners();
        
    } catch (error) {
        console.error('Error loading players:', error);
        showNotification('Error cargando jugadores', 'error');
        players = [];
    }
}

// Cargar equipos para el sistema de pestañas
async function loadTeamsForPlayerManagement() {
    try {
        const response = await fetch('/api/teams');
        if (!response.ok) throw new Error('Error fetching teams');
        
        const teams = await response.json();
        renderTeamTabs(teams);
        
    } catch (error) {
        console.error('Error loading teams:', error);
        showNotification('Error cargando equipos', 'error');
    }
}

// Renderizar pestañas de equipos
function renderTeamTabs(teams) {
    const teamTabsContainer = document.getElementById('teamTabs');
    if (!teamTabsContainer) return;
    
    teamTabsContainer.innerHTML = '';
    
    if (teams.length === 0) {
        teamTabsContainer.innerHTML = `
            <div style="text-align: center; color: rgba(255,255,255,0.6); padding: 20px;">
                <p>No hay equipos disponibles. Agrega equipos primero en la pestaña de Equipos.</p>
            </div>
        `;
        return;
    }
    
    teams.forEach(team => {
        const tabElement = document.createElement('div');
        tabElement.className = 'team-tab';
        tabElement.dataset.teamId = team.id;
        tabElement.innerHTML = `
            <i class="fas fa-users"></i>
            ${team.name}
        `;
        
        tabElement.addEventListener('click', () => selectTeam(team.id, team.name));
        teamTabsContainer.appendChild(tabElement);
    });
}

// Seleccionar equipo
function selectTeam(teamId, teamName) {
    selectedTeamId = teamId;
    
    // Actualizar pestañas activas
    document.querySelectorAll('.team-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-team-id="${teamId}"]`).classList.add('active');
    
    // Mostrar contenedor de input rápido
    const quickAddContainer = document.getElementById('quickAddContainer');
    const teamPlayersContainer = document.getElementById('teamPlayersContainer');
    const selectedTeamNameElement = document.getElementById('selectedTeamName');
    
    if (quickAddContainer) quickAddContainer.style.display = 'block';
    if (teamPlayersContainer) teamPlayersContainer.style.display = 'block';
    if (selectedTeamNameElement) selectedTeamNameElement.textContent = teamName;
    
    // Cargar jugadores del equipo seleccionado
    loadTeamPlayers(teamId);
    
    // Enfocar el input
    const quickInput = document.getElementById('quickPlayerInput');
    if (quickInput) {
        quickInput.focus();
        quickInput.value = '';
    }
}

// Cargar jugadores del equipo seleccionado
function loadTeamPlayers(teamId) {
    teamPlayers = players.filter(player => player.clubId === teamId);
    renderTeamPlayers();
}

// Renderizar jugadores del equipo
function renderTeamPlayers() {
    const teamPlayersGrid = document.getElementById('teamPlayersGrid');
    const playersCount = document.getElementById('playersCount');
    
    if (!teamPlayersGrid || !playersCount) return;
    
    playersCount.textContent = `${teamPlayers.length} jugador${teamPlayers.length !== 1 ? 'es' : ''}`;
    
    teamPlayersGrid.innerHTML = '';
    
    if (teamPlayers.length === 0) {
        teamPlayersGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: rgba(255,255,255,0.6); padding: 20px;">
                <i class="fas fa-running" style="font-size: 32px; margin-bottom: 10px; opacity: 0.3;"></i>
                <p>No hay jugadores en este equipo. Agrega el primer jugador usando el input de arriba.</p>
            </div>
        `;
        return;
    }
    
    // Configurar grid para tarjetas más pequeñas
    teamPlayersGrid.style.display = 'grid';
    teamPlayersGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    teamPlayersGrid.style.gap = '8px';
    
    teamPlayers.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(0, 255, 136, 0.2);
            border-radius: 8px;
            padding: 8px 10px;
            transition: all 0.3s ease;
            position: relative;
            font-size: 13px;
        `;
        
        playerCard.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <!-- Player Info -->
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                            <span style="background: #00ff88; color: #0a0a0a; padding: 2px 6px; border-radius: 50%; font-weight: bold; font-size: 10px; min-width: 18px; text-align: center; line-height: 1;">
                                ${player.number || '?'}
                            </span>
                            <span style="color: white; font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${player.name}</span>
                        </div>
                        <div style="color: rgba(255,255,255,0.6); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${player.position || 'Jugador'} • ${player.age || '--'} años
                        </div>
                    </div>
                    <div style="display: flex; gap: 3px; margin-left: 8px;">
                        <button onclick="editPlayerQuick('${player.id}')" style="background: rgba(0,255,136,0.2); border: 1px solid #00ff88; color: #00ff88; padding: 4px; border-radius: 4px; cursor: pointer; font-size: 10px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deletePlayerQuick('${player.id}')" style="background: rgba(255,0,0,0.2); border: 1px solid #ff4444; color: #ff4444; padding: 4px; border-radius: 4px; cursor: pointer; font-size: 10px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Stats Section -->
                <div style="display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="flex: 1; display: flex; align-items: center; gap: 4px;">
                        <i class="fas fa-futbol" style="color: #00ff88; font-size: 10px;"></i>
                        <span style="color: rgba(255,255,255,0.7); font-size: 10px;">Goles:</span>
                        <input type="number" 
                               value="${player.goals || 0}" 
                               min="0" 
                               max="999"
                               onchange="updatePlayerStats('${player.id}', 'goals', this.value)"
                               style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 2px 4px; border-radius: 3px; width: 35px; font-size: 10px; text-align: center;">
                    </div>
                    <div style="flex: 1; display: flex; align-items: center; gap: 4px;">
                        <i class="fas fa-hands-helping" style="color: #00ff88; font-size: 10px;"></i>
                        <span style="color: rgba(255,255,255,0.7); font-size: 10px;">Asist:</span>
                        <input type="number" 
                               value="${player.assists || 0}" 
                               min="0" 
                               max="999"
                               onchange="updatePlayerStats('${player.id}', 'assists', this.value)"
                               style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 2px 4px; border-radius: 3px; width: 35px; font-size: 10px; text-align: center;">
                    </div>
                </div>
            </div>
        `;
        
        // Hover effect más sutil
        playerCard.addEventListener('mouseenter', () => {
            playerCard.style.borderColor = '#00ff88';
            playerCard.style.background = 'rgba(0, 255, 136, 0.08)';
        });
        
        playerCard.addEventListener('mouseleave', () => {
            playerCard.style.borderColor = 'rgba(0, 255, 136, 0.2)';
            playerCard.style.background = 'rgba(255, 255, 255, 0.05)';
        });
        
        teamPlayersGrid.appendChild(playerCard);
    });
}

// Configurar event listeners para el sistema rápido
function setupPlayerEventListeners() {
    const quickInput = document.getElementById('quickPlayerInput');
    const quickAddBtn = document.getElementById('quickAddBtn');
    
    if (quickInput) {
        quickInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addPlayerQuick();
            }
        });
    }
    
    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', addPlayerQuick);
    }
}

// Agregar jugador rápidamente
async function addPlayerQuick() {
    const quickInput = document.getElementById('quickPlayerInput');
    const playerName = quickInput.value.trim();
    
    if (!playerName) {
        showNotification('Por favor ingresa un nombre', 'error');
        return;
    }
    
    if (!selectedTeamId) {
        showNotification('Por favor selecciona un equipo', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/players', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: playerName,
                clubId: selectedTeamId,
                position: 'Jugador',
                age: 25,
                number: getNextAvailableNumber(),
                nationality: 'Panamá'
            })
        });
        
        if (!response.ok) {
            throw new Error('Error al agregar jugador');
        }
        
        const newPlayer = await response.json();
        players.push(newPlayer);
        loadTeamPlayers(selectedTeamId);
        
        quickInput.value = '';
        quickInput.focus();
        
        showNotification(`Jugador "${playerName}" agregado exitosamente`, 'success');
        
    } catch (error) {
        console.error('Error adding player:', error);
        showNotification('Error al agregar jugador', 'error');
    }
}

// Obtener siguiente número disponible
function getNextAvailableNumber() {
    const usedNumbers = teamPlayers.map(p => p.number).filter(n => n);
    for (let i = 1; i <= 99; i++) {
        if (!usedNumbers.includes(i)) {
            return i;
        }
    }
    return 1;
}

// Editar jugador (versión rápida)
function editPlayerQuick(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    const newName = prompt('Nuevo nombre del jugador:', player.name);
    if (newName && newName.trim() !== player.name) {
        updatePlayerQuick(playerId, { name: newName.trim() });
    }
}

// Actualizar jugador
async function updatePlayerQuick(playerId, updates) {
    try {
        const response = await fetch(`/api/players/${playerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        
        if (!response.ok) {
            throw new Error('Error al actualizar jugador');
        }
        
        const updatedPlayer = await response.json();
        const playerIndex = players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
            players[playerIndex] = updatedPlayer;
        }
        
        loadTeamPlayers(selectedTeamId);
        showNotification('Jugador actualizado exitosamente', 'success');
        
    } catch (error) {
        console.error('Error updating player:', error);
        showNotification('Error al actualizar jugador', 'error');
    }
}

// Eliminar jugador desde API
async function deletePlayerFromAPI(playerId) {
    try {
        console.log('🔄 Eliminando jugador con ID:', playerId);
        
        const response = await fetch(`/api/players/${playerId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Jugador eliminado exitosamente:', result);
        
        // Actualizar array local de jugadores
        const playerIndex = players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
            players.splice(playerIndex, 1);
        }
        
        // Recargar jugadores del equipo actual
        if (selectedTeamId) {
            loadTeamPlayers(selectedTeamId);
        }
        
        showNotification('Jugador eliminado exitosamente', 'success');
        
    } catch (error) {
        console.error('❌ Error eliminando jugador:', error);
        showNotification(`Error eliminando jugador: ${error.message}`, 'error');
    }
}

// Eliminar jugador (versión rápida)
function deletePlayerQuick(playerId) {
    console.log('🗑️ deletePlayerQuick llamada con playerId:', playerId, 'tipo:', typeof playerId);
    console.log('📊 Array de jugadores actual:', players);
    
    // Convertir playerId a número si es string
    const numericPlayerId = typeof playerId === 'string' ? parseInt(playerId) : playerId;
    console.log('🔢 PlayerId convertido a:', numericPlayerId, 'tipo:', typeof numericPlayerId);
    
    const player = players.find(p => {
        console.log('Comparando:', p.id, 'tipo:', typeof p.id, 'con', numericPlayerId, 'tipo:', typeof numericPlayerId);
        return p.id === numericPlayerId;
    });
    console.log('🔍 Jugador encontrado:', player);
    
    if (!player) {
        console.error('❌ Jugador no encontrado con ID:', playerId);
        showNotification('Jugador no encontrado', 'error');
        return;
    }
    
    console.log('❓ Mostrando diálogo de confirmación...');
    if (confirm(`¿Estás seguro de que quieres eliminar a "${player.name}"?`)) {
        console.log('✅ Usuario confirmó eliminación, llamando deletePlayerFromAPI...');
        deletePlayerFromAPI(numericPlayerId);
    } else {
        console.log('❌ Usuario canceló eliminación');
    }
}

// Eliminar jugador de la API
async function deletePlayerFromAPI(playerId) {
    console.log('🌐 deletePlayerFromAPI iniciada con playerId:', playerId);
    
    try {
        console.log('📞 Haciendo llamada DELETE a /api/players/' + playerId);
        const response = await fetch(`/api/players/${playerId}`, {
            method: 'DELETE'
        });
        
        console.log('📝 Respuesta recibida:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorData = await response.text();
            console.error('❌ Error en respuesta del servidor:', errorData);
            throw new Error('Error al eliminar jugador: ' + response.status);
        }
        
        console.log('✅ Jugador eliminado del servidor, actualizando array local...');
        const originalLength = players.length;
        players = players.filter(p => p.id !== playerId);
        console.log(`📊 Array actualizado: ${originalLength} -> ${players.length} jugadores`);
        
        console.log('🔄 Recargando lista de jugadores del equipo...');
        loadTeamPlayers(selectedTeamId);
        
        showNotification('Jugador eliminado exitosamente', 'success');
        console.log('✅ Eliminación completada exitosamente');
        
    } catch (error) {
        console.error('❌ Error completo al eliminar jugador:', error);
        showNotification('Error al eliminar jugador: ' + error.message, 'error');
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
        
        // Detectar si hay logo personalizado
        const hasCustomLogo = team.logo && 
                             team.logo !== 'img/default-team.png' && 
                             team.logo !== 'undefined' && 
                             team.logo !== 'null' && 
                             team.logo !== '' && 
                             typeof team.logo === 'string' && 
                             team.logo.trim() !== '';
        
        const logoImg = hasCustomLogo ? 
            `<img src="${team.logo}" alt="Logo ${team.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px; margin-right: 10px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` + 
            `<div style="width: 50px; height: 50px; background: rgba(255,0,0,0.1); border: 2px dashed #ff0000; border-radius: 8px; display: none; align-items: center; justify-content: center; margin-right: 10px;"><i class="fas fa-exclamation-triangle" style="color: #ff0000;" title="Error cargando imagen"></i></div>` :
            `<div style="width: 50px; height: 50px; background: rgba(0,255,136,0.1); border: 2px dashed #00ff88; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 10px;"><i class="fas fa-image" style="color: #00ff88;"></i></div>`;
        
        teamCard.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                ${logoImg}
                <div>
                    <div class="team-name">${team.name}</div>
                    <div style="color: rgba(255,255,255,0.6); font-size: 12px;">
                        ${hasCustomLogo ? `Logo: ${team.logo.substring(0, 30)}...` : 'Logo por defecto'}
                    </div>
                </div>
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
    const teamName = formData.get('teamName').trim();
    const logoFile = formData.get('teamLogo');

    if (!teamName) {
        showNotification('El nombre del equipo es requerido', 'error');
        return;
    }

    // Crear FormData para enviar archivo
    const submitFormData = new FormData();
    submitFormData.append('name', teamName);
    
    // Solo agregar el logo si se seleccionó un archivo
    if (logoFile && logoFile.size > 0) {
        submitFormData.append('logo', logoFile);
    }

    try {
        const response = await fetch('/api/teams', {
            method: 'POST',
            body: submitFormData // No incluir Content-Type header para FormData
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

// Poblar selects de equipos
function populateTeamSelects() {
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    
    if (!homeTeamSelect || !awayTeamSelect) return;
    
    // Limpiar selects
    homeTeamSelect.innerHTML = '<option value="">Cargando equipos...</option>';
    awayTeamSelect.innerHTML = '<option value="">Cargando equipos...</option>';
    
    // Cargar equipos desde la API
    fetch('/api/teams')
        .then(response => response.json())
        .then(teams => {
            // Limpiar selects
            homeTeamSelect.innerHTML = '<option value="">Seleccionar equipo...</option>';
            awayTeamSelect.innerHTML = '<option value="">Seleccionar equipo...</option>';
            
            // Agregar equipos a ambos selects
            teams.forEach(team => {
                const option1 = document.createElement('option');
                option1.value = team.id;
                option1.textContent = team.name;
                homeTeamSelect.appendChild(option1);
                
                const option2 = document.createElement('option');
                option2.value = team.id;
                option2.textContent = team.name;
                awayTeamSelect.appendChild(option2);
            });
        })
        .catch(error => {
            console.error('Error cargando equipos:', error);
            homeTeamSelect.innerHTML = '<option value="">Error al cargar equipos</option>';
            awayTeamSelect.innerHTML = '<option value="">Error al cargar equipos</option>';
        });
}

// ==================== MATCHES MANAGEMENT ====================

async function loadMatches() {
    const matchesGrid = document.getElementById('matchesGrid');
    if (!matchesGrid) return;
    
    // Mostrar indicador de carga
    matchesGrid.innerHTML = '<div class="loading">Cargando partidos...</div>';
    
    try {
        // Agregar timeout para evitar que se quede cargando indefinidamente
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout
        
        const response = await fetch('/api/tournament/matches', {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        matches = await response.json();
        console.log('Partidos cargados:', matches); // Debug
        
        // Siempre renderizar los partidos cuando se cargan
        renderMatches();
    } catch (error) {
        console.error('Error loading matches:', error);
        matchesGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al cargar los partidos</p>
                <button class="btn btn-retry" onclick="loadMatches()">
                    <i class="fas fa-sync-alt"></i> Reintentar
                </button>
            </div>
        `;
    }
}

function renderMatches() {
    console.log('🎯 Iniciando renderMatches...');
    const matchesGrid = document.getElementById('matchesGrid');
    
    if (!matchesGrid) {
        console.error('❌ No se encontró el elemento matchesGrid');
        return;
    }
    
    console.log('✅ Elemento matchesGrid encontrado');
    console.log('📊 Partidos a renderizar:', matches);
    
    try {
        // Limpiar contenido
        matchesGrid.innerHTML = '';
        
        if (!Array.isArray(matches) || matches.length === 0) {
            console.log('⚠️ No hay partidos para mostrar');
            matchesGrid.innerHTML = `
                <div class="no-matches" style="text-align: center; padding: 40px; color: rgba(255,255,255,0.7);">
                    <i class="fas fa-futbol" style="font-size: 48px; margin-bottom: 20px; display: block;"></i>
                    <p>No hay partidos programados</p>
                </div>
            `;
            return;
        }

        console.log(`🔄 Renderizando ${matches.length} partidos...`);
        
        matches.forEach((match, index) => {
            if (!match) {
                console.warn(`⚠️ Partido ${index} es null/undefined`);
                return;
            }
            
            console.log(`🏆 Renderizando partido ${index + 1}:`, match);
            
            const matchCard = document.createElement('div');
            matchCard.className = 'match-card';
            matchCard.style.cssText = `
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(0, 255, 136, 0.3);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                transition: all 0.3s ease;
            `;
            
            const statusText = match.status === 'finished' ? 'Finalizado' : 'Programado';
            const scoreText = match.status === 'finished' && match.homeScore !== null && match.awayScore !== null 
                ? `${match.homeScore} - ${match.awayScore}` 
                : 'vs';

            // Valores seguros
            const homeTeam = String(match.homeTeam || 'Equipo Local');
            const awayTeam = String(match.awayTeam || 'Equipo Visitante');
            const matchDate = String(match.date || 'Sin fecha');
            const matchTime = String(match.time || 'Sin hora');
            const matchday = String(match.matchday || 'N/A');
            const matchId = match.id || 'unknown';

            // HTML simplificado y seguro
            matchCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h4 style="color: #00ff88; margin: 0;">Partido #${matchId}</h4>
                    <span style="background: ${match.status === 'finished' ? '#00ff88' : '#ffa500'}; color: #000; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">${statusText}</span>
                </div>
                <div style="text-align: center; margin: 20px 0;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 20px;">
                        <span style="color: #fff; font-weight: bold; font-size: 16px;">${homeTeam}</span>
                        <span style="color: #00ff88; font-weight: bold; font-size: 18px;">${scoreText}</span>
                        <span style="color: #fff; font-weight: bold; font-size: 16px;">${awayTeam}</span>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; color: rgba(255,255,255,0.7); font-size: 14px;">
                    <span><i class="fas fa-calendar"></i> ${matchDate} - ${matchTime}</span>
                    <span><i class="fas fa-futbol"></i> Jornada ${matchday}</span>
                </div>
                <div style="margin-top: 15px; text-align: center;">
                    <button class="btn btn-danger" onclick="deleteMatch(${matchId})" style="background: #ff4757; border: none; color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer;">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            `;
            
            matchesGrid.appendChild(matchCard);
        });
        
        console.log('✅ Partidos renderizados exitosamente');
        
    } catch (error) {
        console.error('❌ Error al renderizar partidos:', error);
        matchesGrid.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ff4757;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px; display: block;"></i>
                <p>Error al cargar los partidos</p>
                <button onclick="loadMatches()" style="background: #00ff88; color: #000; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 10px;">
                    Reintentar
                </button>
            </div>
        `;
    }
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

// ==================== CALENDAR MANAGEMENT ====================

async function loadCalendarMatches() {
    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) return;
    
    // Mostrar indicador de carga
    calendarGrid.innerHTML = '<div class="loading">Cargando calendario...</div>';
    
    try {
        const response = await fetch('/api/tournament/matches');
        if (!response.ok) throw new Error('Error fetching matches');
        
        const allMatches = await response.json();
        console.log('Partidos cargados para calendario:', allMatches);
        renderCalendarMatches(allMatches);
    } catch (error) {
        console.error('Error loading calendar matches:', error);
        calendarGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al cargar el calendario</p>
                <button class="btn btn-retry" onclick="loadCalendarMatches()">
                    <i class="fas fa-sync-alt"></i> Reintentar
                </button>
            </div>
        `;
    }
}

function renderCalendarMatches(matches) {
    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) return;
    
    calendarGrid.innerHTML = '';
    
    if (!Array.isArray(matches) || matches.length === 0) {
        calendarGrid.innerHTML = `
            <div class="no-matches">
                <i class="fas fa-calendar-times"></i>
                <p>No hay partidos programados</p>
            </div>
        `;
        return;
    }
    
    // Agrupar partidos por fecha
    const matchesByDate = {};
    matches.forEach(match => {
        if (!match || !match.date) return;
        
        const date = match.date;
        if (!matchesByDate[date]) {
            matchesByDate[date] = [];
        }
        matchesByDate[date].push(match);
    });
    
    // Ordenar fechas
    const sortedDates = Object.keys(matchesByDate).sort();
    
    sortedDates.forEach(date => {
        const dateHeader = document.createElement('div');
        dateHeader.className = 'calendar-date-header';
        dateHeader.innerHTML = `
            <h3><i class="fas fa-calendar-day"></i> ${new Date(date).toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}</h3>
        `;
        calendarGrid.appendChild(dateHeader);
        
        const dateMatches = matchesByDate[date].sort((a, b) => {
            const timeA = a.time || '00:00';
            const timeB = b.time || '00:00';
            return timeA.localeCompare(timeB);
        });
        
        const matchesContainer = document.createElement('div');
        matchesContainer.className = 'calendar-matches-container';
        
        dateMatches.forEach(match => {
            const matchCard = document.createElement('div');
            matchCard.className = `calendar-match-card ${match.status}`;
            
            const statusText = match.status === 'finished' ? 'Finalizado' : 'Programado';
            const scoreText = match.status === 'finished' && match.homeScore !== null && match.awayScore !== null 
                ? `${match.homeScore} - ${match.awayScore}` 
                : 'vs';
            
            matchCard.innerHTML = `
                <div class="match-time">
                    <i class="fas fa-clock"></i> ${match.time || 'Sin hora'}
                </div>
                <div class="match-teams">
                    <span class="team">${match.homeTeam || 'Equipo Local'}</span>
                    <span class="score">${scoreText}</span>
                    <span class="team">${match.awayTeam || 'Equipo Visitante'}</span>
                </div>
                <div class="match-details">
                    <span class="matchday">Jornada ${match.matchday || 'N/A'}</span>
                    <span class="status ${match.status}">${statusText}</span>
                </div>
            `;
            
            matchesContainer.appendChild(matchCard);
        });
        
        calendarGrid.appendChild(matchesContainer);
    });
}

// ==================== RESULTS MANAGEMENT ====================

async function loadPendingMatches() {
    const resultsGrid = document.getElementById('resultsGrid');
    if (!resultsGrid) return;
    
    // Mostrar indicador de carga
    resultsGrid.innerHTML = '<div class="loading">Cargando partidos...</div>';
    
    try {
        // Cargar TODOS los partidos (programados y finalizados)
        const response = await fetch('/api/tournament/matches');
        if (!response.ok) throw new Error('Error fetching matches');
        
        const allMatches = await response.json();
        console.log('Partidos cargados para resultados:', allMatches); // Debug
        renderAllMatches(allMatches);
    } catch (error) {
        console.error('Error loading matches:', error);
        resultsGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al cargar los partidos</p>
                <button class="btn btn-retry" onclick="loadPendingMatches()">
                    <i class="fas fa-sync-alt"></i> Reintentar
                </button>
            </div>
        `;
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

// ============ PLAYER STATS MANAGEMENT ============

// Actualizar estadísticas de jugador (goles y asistencias)
window.updatePlayerStats = async function updatePlayerStats(playerId, statType, value) {
    try {
        console.log(`📊 Actualizando ${statType} del jugador ${playerId}: ${value}`);
        console.log('🔍 Array de jugadores:', players.length, 'jugadores');
        console.log('🔍 Tipo de playerId:', typeof playerId, playerId);
        
        // Validar valor
        const numValue = parseInt(value) || 0;
        if (numValue < 0) {
            showNotification('El valor no puede ser negativo', 'error');
            return;
        }
        
        // Encontrar el jugador en el array local (comparar tanto string como number)
        let playerIndex = players.findIndex(p => p.id === playerId);
        
        // Si no se encuentra, intentar con conversión de tipos
        if (playerIndex === -1) {
            playerIndex = players.findIndex(p => p.id == playerId); // Comparación flexible
        }
        
        // Si aún no se encuentra, intentar con conversión a número
        if (playerIndex === -1) {
            const numPlayerId = parseInt(playerId);
            playerIndex = players.findIndex(p => p.id === numPlayerId);
        }
        
        if (playerIndex === -1) {
            console.error('❌ Jugador no encontrado. IDs disponibles:', players.map(p => `${p.id} (${typeof p.id})`));
            showNotification('Jugador no encontrado', 'error');
            return;
        }
        
        console.log('✅ Jugador encontrado:', players[playerIndex].name, 'en índice', playerIndex);
        
        // Actualizar localmente primero para respuesta rápida
        const oldValue = players[playerIndex][statType] || 0;
        players[playerIndex][statType] = numValue;
        
        // Actualizar en el backend
        const response = await fetch(`/api/players/${playerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...players[playerIndex],
                [statType]: numValue
            })
        });
        
        if (response.ok) {
            const updatedPlayer = await response.json();
            players[playerIndex] = updatedPlayer;
            
            // Actualizar también el array de teamPlayers si es necesario
            const teamPlayerIndex = teamPlayers.findIndex(p => p.id === playerId);
            if (teamPlayerIndex !== -1) {
                teamPlayers[teamPlayerIndex] = updatedPlayer;
            }
            
            console.log(`✅ ${statType} actualizado: ${oldValue} → ${numValue}`);
            showNotification(`${statType === 'goals' ? 'Goles' : 'Asistencias'} actualizado: ${numValue}`, 'success');
            
            // Emitir evento para actualizar estadísticas en tiempo real
            if (window.socket) {
                window.socket.emit('playerStatsUpdated', {
                    playerId: playerId,
                    statType: statType,
                    value: numValue,
                    playerName: players[playerIndex].name
                });
            }
            
        } else {
            // Revertir cambio local si falla el backend
            players[playerIndex][statType] = oldValue;
            
            // Revertir el input también
            const input = document.querySelector(`input[onchange*="updatePlayerStats('${playerId}', '${statType}'"]`);
            if (input) {
                input.value = oldValue;
            }
            
            console.error('Error actualizando estadísticas en el backend');
            showNotification('Error actualizando estadísticas', 'error');
        }
        
    } catch (error) {
        console.error('Error actualizando estadísticas:', error);
        showNotification('Error actualizando estadísticas', 'error');
        
        // Revertir cambio local
        const playerIndex = players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
            // Revertir el input
            const input = document.querySelector(`input[onchange*="updatePlayerStats('${playerId}', '${statType}'"]`);
            if (input) {
                input.value = players[playerIndex][statType] || 0;
            }
        }
    }
}

// Make functions globally available
window.deleteTeam = deleteTeam;
window.editClub = editClub;
window.deleteClub = deleteClub;
window.updatePlayerStats = updatePlayerStats;
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
window.editPlayerQuick = editPlayerQuick;
window.deletePlayerQuick = deletePlayerQuick;
window.deleteClip = deleteClip;

// ==================== CLIPS MANAGEMENT ====================

// Cargar gestión de clips
async function loadClipsManagement() {
    console.log('📹 Cargando gestión de clips...');
    await loadAllClips();
}

// Cargar todos los clips
async function loadAllClips() {
    try {
        // Obtener todos los clips sin paginación
        const response = await fetch('/api/clips?page=1&limit=1000');
        if (response.ok) {
            const data = await response.json();
            const clips = data.clips || []; // Extraer el array de clips
            console.log('📹 Clips cargados:', clips.length);
            renderClips(clips);
        } else {
            console.error('Error cargando clips:', response.status);
            showNotification('Error cargando clips', 'error');
        }
    } catch (error) {
        console.error('Error cargando clips:', error);
        showNotification('Error de conexión al cargar clips', 'error');
    }
}

// Renderizar clips en el admin
function renderClips(clips) {
    const clipsGrid = document.getElementById('clipsGrid');
    if (!clipsGrid) return;

    if (clips.length === 0) {
        clipsGrid.innerHTML = `
            <div style="text-align: center; color: rgba(255,255,255,0.7); padding: 40px;">
                <i class="fas fa-video" style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;"></i>
                <p>No hay clips subidos aún</p>
            </div>
        `;
        return;
    }

    clipsGrid.innerHTML = clips.map(clip => {
        const uploadDate = new Date(clip.upload_date).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Usar video_url como fuente del video
        const videoUrl = clip.video_url || clip.url || '#';

        return `
            <div class="clip-card">
                <video class="clip-video" controls preload="metadata">
                    <source src="${videoUrl}" type="video/mp4">
                    Tu navegador no soporta el elemento video.
                </video>
                
                <div class="clip-info">
                    <div class="clip-title">${clip.title || 'Sin título'}</div>
                    <div class="clip-meta">
                        <i class="fas fa-calendar"></i> Subido: ${uploadDate}
                    </div>
                    <div class="clip-meta">
                        <i class="fas fa-file"></i> ID: ${clip.id}
                    </div>
                    <div class="clip-meta">
                        <i class="fas fa-tag"></i> Tipo: ${clip.type || 'N/A'}
                    </div>
                    <div class="clip-meta">
                        <i class="fas fa-shield-alt"></i> Club: ${clip.club || 'N/A'}
                    </div>
                </div>
                
                <div class="clip-stats">
                    <div class="clip-stat">
                        <i class="fas fa-heart"></i> ${clip.likes || 0} likes
                    </div>
                    <div class="clip-stat">
                        <i class="fas fa-eye"></i> ${clip.views || 0} vistas
                    </div>
                </div>
                
                <div class="clip-actions">
                    <a href="/clips.html" target="_blank" class="btn-view">
                        <i class="fas fa-external-link-alt"></i> Ver en página
                    </a>
                    <button class="btn-delete" onclick="deleteClip('${clip.id}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Eliminar clip
async function deleteClip(clipId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este clip? Esta acción no se puede deshacer.')) {
        return;
    }

    try {
        const response = await fetch(`/api/clips/${clipId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('Clip eliminado exitosamente', 'success');
            console.log('🗑️ Clip eliminado:', clipId);
            
            // Recargar clips
            await loadAllClips();
        } else {
            const error = await response.json().catch(() => ({}));
            showNotification(`Error eliminando clip: ${error.error || 'Error desconocido'}`, 'error');
            console.error('Error eliminando clip:', error);
        }
    } catch (error) {
        console.error('Error eliminando clip:', error);
        showNotification('Error de conexión al eliminar clip', 'error');
    }
}

// Función para poblar selects de clubes (función faltante)
function populateClubSelects() {
    // Esta función se llama cuando se cambia a la pestaña de jugadores
    // No es necesaria en el diseño actual ya que usamos pestañas por equipo
    console.log('populateClubSelects llamada - no es necesaria en el diseño actual');
}

// Función para editar equipo (función faltante)
function editTeam(teamId) {
    console.log('Función editTeam no implementada para teamId:', teamId);
    showNotification('Función de editar equipo no disponible', 'info');
}

// Editar jugador (versión rápida)
function editPlayerQuick(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) {
        showNotification('Jugador no encontrado', 'error');
        return;
    }
    
    // Crear un modal simple para editar el jugador
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: #1a1a1a; border: 1px solid #00ff88; border-radius: 12px; padding: 30px; width: 400px; max-width: 90vw;">
            <h3 style="color: #00ff88; margin-bottom: 20px; text-align: center;">Editar Jugador</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="color: white; display: block; margin-bottom: 5px;">Nombre:</label>
                <input type="text" id="editPlayerName" value="${player.name}" style="width: 100%; padding: 8px; border: 1px solid #333; background: #2a2a2a; color: white; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="color: white; display: block; margin-bottom: 5px;">Edad:</label>
                <input type="number" id="editPlayerAge" value="${player.age || ''}" min="16" max="50" style="width: 100%; padding: 8px; border: 1px solid #333; background: #2a2a2a; color: white; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="color: white; display: block; margin-bottom: 5px;">Número:</label>
                <input type="number" id="editPlayerNumber" value="${player.number || ''}" min="1" max="99" style="width: 100%; padding: 8px; border: 1px solid #333; background: #2a2a2a; color: white; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="color: white; display: block; margin-bottom: 5px;">Posición:</label>
                <select id="editPlayerPosition" style="width: 100%; padding: 8px; border: 1px solid #333; background: #2a2a2a; color: white; border-radius: 4px;">
                    <option value="Portero" ${player.position === 'Portero' ? 'selected' : ''}>Portero</option>
                    <option value="Defensa Central" ${player.position === 'Defensa Central' ? 'selected' : ''}>Defensa Central</option>
                    <option value="Lateral Derecho" ${player.position === 'Lateral Derecho' ? 'selected' : ''}>Lateral Derecho</option>
                    <option value="Lateral Izquierdo" ${player.position === 'Lateral Izquierdo' ? 'selected' : ''}>Lateral Izquierdo</option>
                    <option value="Mediocentro" ${player.position === 'Mediocentro' ? 'selected' : ''}>Mediocentro</option>
                    <option value="Mediocentro Defensivo" ${player.position === 'Mediocentro Defensivo' ? 'selected' : ''}>Mediocentro Defensivo</option>
                    <option value="Mediocentro Ofensivo" ${player.position === 'Mediocentro Ofensivo' ? 'selected' : ''}>Mediocentro Ofensivo</option>
                    <option value="Extremo Derecho" ${player.position === 'Extremo Derecho' ? 'selected' : ''}>Extremo Derecho</option>
                    <option value="Extremo Izquierdo" ${player.position === 'Extremo Izquierdo' ? 'selected' : ''}>Extremo Izquierdo</option>
                    <option value="Delantero" ${player.position === 'Delantero' ? 'selected' : ''}>Delantero</option>
                </select>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="savePlayerEdit('${playerId}')" style="background: #00ff88; color: #000; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                    Guardar
                </button>
                <button onclick="closeEditModal()" style="background: #666; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                    Cancelar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Funciones para el modal
    window.savePlayerEdit = async function(playerId) {
        const name = document.getElementById('editPlayerName').value.trim();
        const age = parseInt(document.getElementById('editPlayerAge').value);
        const number = parseInt(document.getElementById('editPlayerNumber').value);
        const position = document.getElementById('editPlayerPosition').value;
        
        if (!name) {
            showNotification('El nombre es obligatorio', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/players/${playerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    age: age || null,
                    number: number || null,
                    position
                })
            });
            
            if (response.ok) {
                // Actualizar el jugador en el array local
                const playerIndex = players.findIndex(p => p.id === playerId);
                if (playerIndex !== -1) {
                    players[playerIndex] = { ...players[playerIndex], name, age, number, position };
                }
                
                loadTeamPlayers(selectedTeamId);
                showNotification('Jugador actualizado exitosamente', 'success');
                closeEditModal();
            } else {
                const error = await response.json();
                showNotification(error.error || 'Error al actualizar jugador', 'error');
            }
        } catch (error) {
            console.error('Error updating player:', error);
            showNotification('Error de conexión', 'error');
        }
    };
    
    window.closeEditModal = function() {
        document.body.removeChild(modal);
        delete window.savePlayerEdit;
        delete window.closeEditModal;
    };
}

// ==================== FUNCIONES GLOBALES ====================
// Exponer funciones necesarias para los botones onclick

// Funciones de jugadores
window.deletePlayerQuick = deletePlayerQuick;
window.editPlayerQuick = editPlayerQuick;

// Funciones de equipos
window.deleteTeam = deleteTeam;
window.editTeam = editTeam;

// Funciones auxiliares
window.populateClubSelects = populateClubSelects;

// Funciones de partidos
window.deleteMatch = deleteMatch;
window.updateMatchResult = updateMatchResult;

// Funciones de clips
window.deleteClip = deleteClip;

// Funciones de configuración
window.addClassificationZone = addClassificationZone;
// window.removeClassificationZone = removeClassificationZone; // Función no implementada
window.saveTableConfig = saveTableConfig;
window.saveTournamentConfig = saveTournamentConfig;

// Funciones de playoffs
window.generateBracket = generateBracket;
window.saveBracketResult = saveBracketResult;

// Funciones de navegación
window.changeMatchday = changeMatchday;
window.switchTab = switchTab;
window.logout = logout;

console.log('✅ Funciones globales expuestas correctamente');
