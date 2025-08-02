// Admin panel functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Inicializando panel de administración...');
    
    initializeAdmin();
    setupEventListeners();
    loadInitialData();
    initializeWebSocket(); // Inicializar WebSocket para sincronización
    
    console.log(' Panel de administración inicializado');
});

// Global variables
let teams = [];
let clubs = [];
let players = [];

// Funciones de equipos (disponibles globalmente desde el inicio)
window.editTeam = function(teamId) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    // Llenar formulario con datos del equipo
    document.getElementById('teamId').value = team.id;
    document.getElementById('teamName').value = team.name;
    
    // Cambiar texto del botón y mostrar cancelar
    document.getElementById('teamFormAction').textContent = 'Actualizar Equipo';
    document.getElementById('cancelTeamBtn').style.display = 'inline-block';
    
    // Scroll al formulario
    document.getElementById('teamForm').scrollIntoView({ behavior: 'smooth' });
};

window.cancelTeamEdit = function() {
    // Limpiar formulario
    document.getElementById('teamForm').reset();
    document.getElementById('teamId').value = '';
    
    // Restaurar texto del botón y ocultar cancelar
    document.getElementById('teamFormAction').textContent = 'Agregar Equipo';
    document.getElementById('cancelTeamBtn').style.display = 'none';
};

window.deleteTeam = async function(teamId) {
    console.log('🗑️ Intentando eliminar equipo ID:', teamId);
    
    const team = teams.find(t => t.id == teamId || t.id === parseInt(teamId));
    if (!team) {
        console.error('❌ Equipo no encontrado con ID:', teamId);
        alert('Error: Equipo no encontrado');
        return;
    }
    
    const confirmed = confirm(`¿Estás seguro de que quieres eliminar el equipo "${team.name}"?\n\nEsto también eliminará:\n- Todos los jugadores del equipo\n- El club asociado\n- Los partidos relacionados`);
    
    if (!confirmed) {
        console.log('❌ Eliminación cancelada por el usuario');
        return;
    }
    
    try {
        console.log('🔄 Enviando solicitud DELETE al servidor...');
        
        const response = await fetch(`/api/teams/${teamId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 Respuesta del servidor:', response.status, response.statusText);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Equipo eliminado exitosamente:', result);
            
            // Mostrar notificación de éxito
            if (typeof showNotification === 'function') {
                showNotification(`Equipo "${team.name}" eliminado exitosamente`, 'success');
            } else {
                alert(`✅ Equipo "${team.name}" eliminado exitosamente`);
            }
            
            // Recargar datos
            await loadTeams();
            await loadClubs();
            await loadPlayers();
            
        } else {
            const error = await response.json();
            console.error('❌ Error del servidor:', error);
            
            if (typeof showNotification === 'function') {
                showNotification(error.error || 'Error eliminando equipo', 'error');
            } else {
                alert(`❌ Error: ${error.error || 'Error eliminando equipo'}`);
            }
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        
        if (typeof showNotification === 'function') {
            showNotification('Error de conexión con el servidor', 'error');
        } else {
            alert('❌ Error de conexión con el servidor');
        }
    }
};
let matches = [];
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
            // Solución directa y simple
            setTimeout(() => {
                console.log('🚀 SOLUCIÓN DIRECTA: Agregando botones...');
                addEditButtonsToTeams();
            }, 500);
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
        case 'ocr-verify':
            initializeOCRVerification();
            break;
    }
}

async function loadInitialData() {
    try {
        await loadTeams();
        await loadClubs();
        await loadMatches();
        populateTeamSelects();
    } catch (error) {
        console.error('Error loading initial data:', error);
        showNotification('Error cargando datos iniciales', 'error');
    }
}

// ==================== SIMPLE TEAMS LOGO MANAGEMENT ====================

async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        if (!response.ok) throw new Error('Error fetching teams');
        
        teams = await response.json();
        console.log('🎯 DEBUG: Equipos obtenidos:', teams.length, teams);
        console.log('🎯 DEBUG: Llamando forceRenderTeams()...');
        forceRenderTeams();
        console.log('✅ Equipos cargados para cambio de logo:', teams.length);
    } catch (error) {
        console.error('Error loading teams:', error);
        teams = [];
        renderTeams();
    }
}

function renderTeams() {
    console.log('🔴 RENDERTEAMS: Iniciando renderizado...');
    const teamsGrid = document.getElementById('teamsGrid');
    console.log('🔴 RENDERTEAMS: teamsGrid encontrado:', !!teamsGrid);
    
    if (!teamsGrid) {
        console.error('❌ RENDERTEAMS: teamsGrid NO encontrado!');
        return;
    }

    teamsGrid.innerHTML = '';
    console.log('🔴 RENDERTEAMS: teamsGrid limpiado');

    if (!teams || teams.length === 0) {
        console.log('⚠️ RENDERTEAMS: No hay equipos');
        teamsGrid.innerHTML = `
            <div style="text-align: center; color: rgba(255,255,255,0.6); padding: 40px;">
                <i class="fas fa-users" style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;"></i>
                <p>No hay equipos registrados. Agrega el primer equipo usando el formulario de arriba.</p>
            </div>
        `;
        return;
    }

    console.log('🔴 RENDERTEAMS: Renderizando', teams.length, 'equipos');
    
    // Crear HTML directamente como string (más simple)
    let html = '';
    teams.forEach((team, index) => {
        console.log(`🏆 RENDERTEAMS: Procesando equipo ${index + 1}:`, team.name);
        
        html += `
            <div style="
                background: rgba(255, 255, 255, 0.05);
                border: 2px solid rgba(0, 255, 136, 0.2);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 20px;
            ">
                <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; background: rgba(0,255,136,0.1); display: flex; align-items: center; justify-content: center;">
                    ${team.logo ? 
                        `<img src="${team.logo}" alt="${team.name} Logo" style="width: 100%; height: 100%; object-fit: cover;">` :
                        `<i class="fas fa-users" style="color: #00ff88; font-size: 24px;"></i>`
                    }
                </div>
                <div style="flex: 1;">
                    <h3 style="color: #00ff88; margin: 0; font-size: 18px;">${team.name}</h3>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.editTeam(${team.id})" style="background: linear-gradient(45deg, #3498db, #2980b9); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button onclick="window.deleteTeam(${team.id})" style="background: linear-gradient(45deg, #e74c3c, #c0392b); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
    });
    
    teamsGrid.innerHTML = html;
    console.log('✅ RENDERTEAMS: Renderizado completado!');
}

function changeTeamLogo(teamId) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    // Crear input file temporal
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    
    fileInput.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('teamName', team.name);
        formData.append('logo', file);
        
        try {
            const response = await fetch(`/api/teams/${teamId}`, {
                method: 'PUT',
                body: formData
            });
            
            if (response.ok) {
                showNotification(`Logo de ${team.name} actualizado exitosamente`, 'success');
                await loadTeams(); // Recargar para mostrar el nuevo logo
            } else {
                const error = await response.json();
                showNotification(error.error || 'Error actualizando logo', 'error');
            }
        } catch (error) {
            console.error('Error updating team logo:', error);
            showNotification('Error de conexión', 'error');
        }
        
        // Limpiar el input
        document.body.removeChild(fileInput);
    };
    
    document.body.appendChild(fileInput);
    fileInput.click();
}

// Funciones de edición de equipos
function editTeam(teamId) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    // Llenar formulario con datos del equipo
    document.getElementById('teamId').value = team.id;
    document.getElementById('teamName').value = team.name;
    
    // Cambiar texto del botón y mostrar cancelar
    document.getElementById('teamFormAction').textContent = 'Actualizar Equipo';
    document.getElementById('cancelTeamBtn').style.display = 'inline-block';
    
    // Scroll al formulario
    document.getElementById('teamForm').scrollIntoView({ behavior: 'smooth' });
}

// Función para cancelar edición de equipo
function cancelTeamEdit() {
    // Limpiar formulario
    document.getElementById('teamForm').reset();
    document.getElementById('teamId').value = '';
    
    // Restaurar texto del botón y ocultar cancelar
    document.getElementById('teamFormAction').textContent = 'Agregar Equipo';
    document.getElementById('cancelTeamBtn').style.display = 'none';
}

// Función para eliminar equipo
async function deleteTeam(teamId) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    if (!confirm(`¿Estás seguro de que quieres eliminar el equipo "${team.name}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/teams/${teamId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification(`Equipo "${team.name}" eliminado exitosamente`, 'success');
            await loadTeams(); // Recargar lista
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error eliminando equipo', 'error');
        }
    } catch (error) {
        console.error('Error deleting team:', error);
        showNotification('Error de conexión', 'error');
    }
}

async function deleteTeam(teamId) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    
    if (!confirm(`¿Estás seguro de que quieres eliminar el equipo "${team.name}"?\n\nEsto también eliminará todos los jugadores del equipo.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/teams/${teamId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Equipo eliminado exitosamente', 'success');
            await loadTeams();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error eliminando equipo', 'error');
        }
    } catch (error) {
        console.error('Error deleting team:', error);
        showNotification('Error de conexión', 'error');
    }
}

async function handleTeamSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const teamId = formData.get('teamId');
    
    // Validar datos
    const teamName = formData.get('teamName').trim();
    if (!teamName) {
        showNotification('El nombre del equipo es requerido', 'error');
        return;
    }
    
    try {
        const url = teamId ? `/api/teams/${teamId}` : '/api/teams';
        const method = teamId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            body: formData
        });
        
        if (response.ok) {
            const action = teamId ? 'actualizado' : 'agregado';
            showNotification(`Equipo ${action} exitosamente`, 'success');
            
            // Limpiar formulario y recargar
            e.target.reset();
            cancelTeamEdit();
            await loadTeams();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error guardando equipo', 'error');
        }
    } catch (error) {
        console.error('Error submitting team:', error);
        showNotification('Error de conexión', 'error');
    }
}

// Exponer funciones globalmente
window.editTeam = editTeam;
window.cancelTeamEdit = cancelTeamEdit;
window.deleteTeam = deleteTeam;
window.changeTeamLogo = changeTeamLogo;

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
                <button class="btn btn-small" onclick="window.editClub(${club.id})">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-danger btn-small" onclick="window.deleteClub(${club.id})">
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
    console.log('🗑️ Intentando eliminar club ID:', clubId);
    
    const club = clubs.find(c => c.id == clubId || c.id === parseInt(clubId));
    if (!club) {
        console.error('❌ Club no encontrado con ID:', clubId);
        alert('Error: Club no encontrado');
        return;
    }
    
    const confirmed = confirm(`¿Estás seguro de que quieres eliminar el club "${club.name}"?\n\nEsto también eliminará:\n- Todos los jugadores del club`);
    
    if (!confirmed) {
        console.log('❌ Eliminación cancelada por el usuario');
        return;
    }
    
    try {
        console.log('🔄 Enviando solicitud DELETE al servidor...');
        
        const response = await fetch(`/api/clubs/${clubId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 Respuesta del servidor:', response.status, response.statusText);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Club eliminado exitosamente:', result);
            
            // Mostrar notificación de éxito
            if (typeof showNotification === 'function') {
                showNotification(`Club "${club.name}" eliminado exitosamente`, 'success');
            } else {
                alert(`✅ Club "${club.name}" eliminado exitosamente`);
            }
            
            // Recargar datos
            await loadClubs();
            await loadPlayers();
            
        } else {
            const error = await response.json();
            console.error('❌ Error del servidor:', error);
            
            if (typeof showNotification === 'function') {
                showNotification(error.error || 'Error eliminando club', 'error');
            } else {
                alert(`❌ Error: ${error.error || 'Error eliminando club'}`);
            }
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        
        if (typeof showNotification === 'function') {
            showNotification('Error de conexión con el servidor', 'error');
        } else {
            alert('❌ Error de conexión con el servidor');
        }
    }
}

// Exponer funciones de clubes globalmente
window.editClub = editClub;
window.deleteClub = deleteClub;
window.cancelClubEdit = cancelClubEdit;

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
        // No agregar manualmente - el WebSocket se encarga de la actualización
        // players.push(newPlayer); // Removido para evitar duplicación
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
    console.log('📊 Array de jugadores del equipo actual:', teamPlayers);
    console.log('📊 Array global de jugadores:', players);
    
    // Convertir playerId a número si es string
    const numericPlayerId = typeof playerId === 'string' ? parseInt(playerId) : playerId;
    console.log('🔢 PlayerId convertido a:', numericPlayerId, 'tipo:', typeof numericPlayerId);
    
    // Buscar primero en teamPlayers (jugadores del equipo actual)
    let player = teamPlayers.find(p => {
        console.log('Comparando en teamPlayers:', p.id, 'tipo:', typeof p.id, 'con', numericPlayerId, 'tipo:', typeof numericPlayerId);
        return p.id == numericPlayerId; // Usar == para comparación flexible
    });
    
    // Si no se encuentra en teamPlayers, buscar en el array global
    if (!player) {
        player = players.find(p => {
            console.log('Comparando en players:', p.id, 'tipo:', typeof p.id, 'con', numericPlayerId, 'tipo:', typeof numericPlayerId);
            return p.id == numericPlayerId; // Usar == para comparación flexible
        });
    }
    
    console.log('🔍 Jugador encontrado:', player);
    
    if (!player) {
        console.error('❌ Jugador no encontrado con ID:', playerId);
        console.error('❌ teamPlayers:', teamPlayers.map(p => ({ id: p.id, name: p.name })));
        console.error('❌ players:', players.map(p => ({ id: p.id, name: p.name })));
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

// Mostrar interfaz de emparejamientos personalizados
function showCustomPairings() {
    const format = document.getElementById('bracketFormat').value;
    const numTeams = parseInt(format);
    const numMatches = numTeams / 2;
    
    const customPairingsDiv = document.getElementById('customPairings');
    const pairingsInputsDiv = document.getElementById('pairingsInputs');
    
    // Ocultar otras secciones
    document.getElementById('manualSelection').style.display = 'none';
    
    // Generar inputs para cada emparejamiento
    let inputsHTML = '';
    for (let i = 0; i < numMatches; i++) {
        inputsHTML += `
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,165,0,0.3);">
                <label style="color: #ff6b35; font-weight: 600; margin-bottom: 8px; display: block;">
                    <i class="fas fa-vs"></i> Partido ${i + 1}
                </label>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="number" id="home_${i}" min="1" max="${numTeams}" placeholder="Pos." 
                           style="width: 60px; padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,165,0,0.5); border-radius: 4px; color: white; text-align: center;">
                    <span style="color: #ff6b35; font-weight: bold;">vs</span>
                    <input type="number" id="away_${i}" min="1" max="${numTeams}" placeholder="Pos." 
                           style="width: 60px; padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,165,0,0.5); border-radius: 4px; color: white; text-align: center;">
                    <small style="color: rgba(255,255,255,0.6); margin-left: 10px;">Posiciones en la tabla</small>
                </div>
            </div>
        `;
    }
    
    pairingsInputsDiv.innerHTML = inputsHTML;
    customPairingsDiv.style.display = 'block';
}

// Ocultar interfaz de emparejamientos personalizados
function hideCustomPairings() {
    document.getElementById('customPairings').style.display = 'none';
}

// Crear emparejamientos personalizados desde los inputs del usuario
function createCustomPairings(teams) {
    const format = document.getElementById('bracketFormat').value;
    const numTeams = parseInt(format);
    const numMatches = numTeams / 2;
    const customPairings = [];
    
    for (let i = 0; i < numMatches; i++) {
        const homePos = parseInt(document.getElementById(`home_${i}`).value);
        const awayPos = parseInt(document.getElementById(`away_${i}`).value);
        
        if (isNaN(homePos) || isNaN(awayPos) || homePos < 1 || homePos > numTeams || awayPos < 1 || awayPos > numTeams) {
            throw new Error(`Partido ${i + 1}: Posiciones inválidas. Deben ser números entre 1 y ${numTeams}`);
        }
        
        if (homePos === awayPos) {
            throw new Error(`Partido ${i + 1}: Un equipo no puede jugar contra sí mismo`);
        }
        
        customPairings.push({
            home: teams[homePos - 1], // -1 porque los arrays empiezan en 0
            away: teams[awayPos - 1]
        });
    }
    
    // Verificar que no haya equipos duplicados
    const usedTeams = new Set();
    customPairings.forEach((pairing, index) => {
        if (usedTeams.has(pairing.home)) {
            throw new Error(`El equipo en posición ${teams.indexOf(pairing.home) + 1} aparece más de una vez`);
        }
        if (usedTeams.has(pairing.away)) {
            throw new Error(`El equipo en posición ${teams.indexOf(pairing.away) + 1} aparece más de una vez`);
        }
        usedTeams.add(pairing.home);
        usedTeams.add(pairing.away);
    });
    
    console.log('🎯 Emparejamientos personalizados creados:', customPairings);
    return customPairings;
}

// Función para crear bracket con emparejamientos personalizados
async function createCustomBracket() {
    const format = document.getElementById('bracketFormat').value;
    const numTeams = parseInt(format);
    
    try {
        // Obtener tabla de posiciones actual (igual que generateBracket)
        const response = await fetch('/api/standings');
        if (!response.ok) throw new Error('Error fetching standings');
        
        const standings = await response.json();
        
        // Tomar los primeros N equipos según el formato
        const qualifiedTeams = standings.slice(0, numTeams).map(team => team.team);
        
        if (qualifiedTeams.length < numTeams) {
            showNotification(`Se necesitan al menos ${numTeams} equipos en la tabla`, 'error');
            return;
        }
        
        // Verificar si la interfaz de emparejamientos personalizados está activa
        const customPairingsDiv = document.getElementById('customPairings');
        if (!customPairingsDiv || customPairingsDiv.style.display === 'none') {
            showNotification('Primero debes configurar los emparejamientos personalizados', 'error');
            return;
        }
        
        // Crear emparejamientos personalizados
        let customPairings;
        try {
            customPairings = createCustomPairings(qualifiedTeams);
        } catch (pairingError) {
            showNotification('Error en emparejamientos: ' + pairingError.message, 'error');
            return;
        }
        
        const bracket = {
            format: format,
            teams: qualifiedTeams,
            matches: generateBracketMatches(qualifiedTeams, format, customPairings),
            createdAt: new Date().toISOString()
        };
        
        const bracketResponse = await fetch('/api/playoffs/bracket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bracket)
        });
        
        if (bracketResponse.ok) {
            currentBracket = bracket;
            renderBracket(bracket);
            showNotification('Bracket personalizado creado exitosamente', 'success');
            
            // Ocultar selección manual
            document.getElementById('manualSelection').style.display = 'none';
        } else {
            showNotification('Error creando bracket personalizado', 'error');
        }
        
    } catch (error) {
        console.error('Error creating custom bracket:', error);
        showNotification('Error generando bracket personalizado', 'error');
    }
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

function generateBracketMatches(teams, format, customPairings = null) {
    const matches = [];
    const numTeams = parseInt(format);
    let matchId = 1;
    
    if (numTeams === 16) {
        // OCTAVOS DE FINAL (16 equipos = 8 partidos)
        for (let i = 0; i < 8; i++) {
            let homeTeam, awayTeam;
            
            if (customPairings && customPairings.length === 8) {
                // Usar emparejamientos personalizados
                homeTeam = customPairings[i].home;
                awayTeam = customPairings[i].away;
            } else {
                // Usar emparejamientos automáticos (1vs16, 2vs15, etc.)
                homeTeam = teams[i];
                awayTeam = teams[15 - i];
            }
            
            matches.push({
                id: `match_${matchId++}`,
                round: 1,
                roundName: 'Octavos de Final',
                homeTeam: homeTeam,
                awayTeam: awayTeam,
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
window.cancelTeamEdit = cancelTeamEdit;

// Funciones de clubes
window.editClub = editClub;
window.deleteClub = deleteClub;
window.cancelClubEdit = cancelClubEdit;

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

// ============ LIMPIEZA DE JUGADORES HUÉRFANOS ============

// Función para limpiar jugadores de equipos eliminados
async function cleanOrphanedPlayers() {
    try {
        console.log('🧹 Iniciando limpieza de jugadores huérfanos...');
        
        // Obtener equipos actuales
        const teamsResponse = await fetch('/api/teams');
        if (!teamsResponse.ok) throw new Error('Error obteniendo equipos');
        const currentTeams = await teamsResponse.json();
        
        // Obtener todos los jugadores
        const playersResponse = await fetch('/api/players');
        if (!playersResponse.ok) throw new Error('Error obteniendo jugadores');
        const allPlayers = await playersResponse.json();
        
        // Encontrar IDs de equipos que existen
        const validTeamIds = currentTeams.map(team => team.id);
        console.log('📊 Equipos válidos:', validTeamIds);
        
        // Encontrar jugadores huérfanos
        const orphanedPlayers = allPlayers.filter(player => 
            !validTeamIds.includes(player.clubId)
        );
        
        console.log(`👥 Jugadores huérfanos encontrados: ${orphanedPlayers.length}`);
        
        if (orphanedPlayers.length === 0) {
            showNotification('No se encontraron jugadores huérfanos', 'success');
            return;
        }
        
        // Mostrar confirmación
        const playerNames = orphanedPlayers.map(p => p.name).join(', ');
        const confirmed = confirm(`¿Eliminar ${orphanedPlayers.length} jugadores huérfanos?\n\nJugadores: ${playerNames}`);
        
        if (!confirmed) {
            showNotification('Limpieza cancelada', 'info');
            return;
        }
        
        // Eliminar jugadores huérfanos
        let deletedCount = 0;
        for (const player of orphanedPlayers) {
            try {
                const deleteResponse = await fetch(`/api/players/${player.id}`, {
                    method: 'DELETE'
                });
                
                if (deleteResponse.ok) {
                    deletedCount++;
                    console.log(`✅ Jugador eliminado: ${player.name}`);
                } else {
                    console.error(`❌ Error eliminando jugador: ${player.name}`);
                }
            } catch (error) {
                console.error(`❌ Error eliminando jugador ${player.name}:`, error);
            }
        }
        
        showNotification(`Limpieza completada: ${deletedCount} jugadores eliminados`, 'success');
        
        // Recargar la sección de jugadores
        if (selectedTeamId) {
            loadTeamPlayers(selectedTeamId);
        }
        
    } catch (error) {
        console.error('❌ Error en limpieza de jugadores huérfanos:', error);
        showNotification('Error en la limpieza: ' + error.message, 'error');
    }
}

// Exponer la función globalmente
window.cleanOrphanedPlayers = cleanOrphanedPlayers;

// Función para limpiar tabla de posiciones cuando no hay equipos
async function cleanStandingsTable() {
    try {
        console.log('🧹 Iniciando limpieza de tabla de posiciones...');
        
        // Obtener equipos actuales
        const teamsResponse = await fetch('/api/teams');
        if (!teamsResponse.ok) throw new Error('Error obteniendo equipos');
        const currentTeams = await teamsResponse.json();
        
        // Obtener tabla de posiciones actual
        const standingsResponse = await fetch('/api/standings');
        if (!standingsResponse.ok) throw new Error('Error obteniendo tabla');
        const currentStandings = await standingsResponse.json();
        
        console.log(`📊 Equipos actuales: ${currentTeams.length}`);
        console.log(`📊 Equipos en tabla: ${currentStandings.length}`);
        
        if (currentTeams.length === 0 && currentStandings.length > 0) {
            // No hay equipos pero sí hay tabla - limpiar
            const confirmed = confirm(`¿Limpiar tabla de posiciones?\n\nSe eliminarán ${currentStandings.length} equipos de la tabla.`);
            
            if (!confirmed) {
                showNotification('Limpieza cancelada', 'info');
                return;
            }
            
            // Limpiar tabla enviando array vacío
            const cleanResponse = await fetch('/api/standings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([])
            });
            
            if (cleanResponse.ok) {
                showNotification('Tabla de posiciones limpiada exitosamente', 'success');
                console.log('✅ Tabla de posiciones limpiada');
            } else {
                showNotification('Error limpiando tabla de posiciones', 'error');
            }
            
        } else if (currentTeams.length > 0 && currentStandings.length === 0) {
            showNotification('Hay equipos pero no tabla. Usa "Generar Tabla" en la sección Equipos', 'info');
        } else if (currentTeams.length === 0 && currentStandings.length === 0) {
            showNotification('No hay equipos ni tabla. Todo está limpio', 'success');
        } else {
            showNotification('Equipos y tabla están sincronizados', 'success');
        }
        
    } catch (error) {
        console.error('❌ Error en limpieza de tabla:', error);
        showNotification('Error en la limpieza: ' + error.message, 'error');
    }
}

// Exponer la función globalmente
window.cleanStandingsTable = cleanStandingsTable;

// ============ FUNCIÓN PARA ELIMINAR EQUIPOS DE PRUEBA ============

// Función para eliminar equipos específicos de prueba
async function deleteTestTeams() {
    const testTeamNames = ['ss', 'sss', 'sss ss', 'jjj', '123'];
    let deletedCount = 0;
    
    console.log('🧹 Iniciando eliminación de equipos de prueba:', testTeamNames);
    
    try {
        // Obtener lista actual de equipos
        const response = await fetch('/api/teams');
        if (!response.ok) {
            throw new Error('No se pudo obtener la lista de equipos');
        }
        
        const currentTeams = await response.json();
        console.log('📊 Equipos actuales:', currentTeams.length);
        
        // Buscar y eliminar equipos de prueba
        for (const team of currentTeams) {
            if (testTeamNames.includes(team.name.toLowerCase().trim())) {
                console.log(`🗑️ Eliminando equipo de prueba: "${team.name}" (ID: ${team.id})`);
                
                try {
                    const deleteResponse = await fetch(`/api/teams/${team.id}`, {
                        method: 'DELETE'
                    });
                    
                    if (deleteResponse.ok) {
                        console.log(`✅ Equipo "${team.name}" eliminado exitosamente`);
                        deletedCount++;
                    } else {
                        console.error(`❌ Error eliminando equipo "${team.name}"`);
                    }
                } catch (deleteError) {
                    console.error(`❌ Error eliminando equipo "${team.name}":`, deleteError);
                }
            }
        }
        
        // Recargar equipos después de la limpieza
        if (deletedCount > 0) {
            console.log(`✅ Eliminación completada. ${deletedCount} equipos eliminados.`);
            loadTeams(); // Recargar la lista
            showNotification(`${deletedCount} equipos de prueba eliminados`, 'success');
        } else {
            console.log('ℹ️ No se encontraron equipos de prueba para eliminar');
            showNotification('No se encontraron equipos de prueba', 'info');
        }
        
    } catch (error) {
        console.error('❌ Error en la limpieza de equipos:', error);
        showNotification('Error al eliminar equipos de prueba', 'error');
    }
}

// Exponer la función globalmente
window.deleteTestTeams = deleteTestTeams;

// ============ FUNCIÓN PARA ELIMINAR CLUBES HUÉRFANOS ============

// Función para eliminar clubes específicos de prueba (huérfanos)
async function deleteOrphanedClubs() {
    const orphanedClubNames = ['ss', 'sss', 'sss ss', 'jjj', '123'];
    let deletedCount = 0;
    
    console.log('🧹 Iniciando eliminación de clubes huérfanos:', orphanedClubNames);
    
    try {
        // Obtener lista actual de clubes
        const response = await fetch('/api/clubs');
        if (!response.ok) {
            throw new Error('No se pudo obtener la lista de clubes');
        }
        
        const currentClubs = await response.json();
        console.log('📊 Clubes actuales:', currentClubs.length);
        
        // Buscar y eliminar clubes huérfanos
        for (const club of currentClubs) {
            if (orphanedClubNames.includes(club.name.toLowerCase().trim())) {
                console.log(`🗑️ Eliminando club huérfano: "${club.name}" (ID: ${club.id})`);
                
                try {
                    const deleteResponse = await fetch(`/api/clubs/${club.id}`, {
                        method: 'DELETE'
                    });
                    
                    if (deleteResponse.ok) {
                        console.log(`✅ Club "${club.name}" eliminado exitosamente`);
                        deletedCount++;
                    } else {
                        console.error(`❌ Error eliminando club "${club.name}"`);
                    }
                } catch (deleteError) {
                    console.error(`❌ Error eliminando club "${club.name}":`, deleteError);
                }
            }
        }
        
        // Recargar clubes después de la limpieza
        if (deletedCount > 0) {
            console.log(`✅ Eliminación completada. ${deletedCount} clubes huérfanos eliminados.`);
            loadClubs(); // Recargar la lista
            showNotification(`${deletedCount} clubes huérfanos eliminados`, 'success');
        } else {
            console.log('ℹ️ No se encontraron clubes huérfanos para eliminar');
            showNotification('No se encontraron clubes huérfanos', 'info');
        }
        
    } catch (error) {
        console.error('❌ Error en la limpieza de clubes:', error);
        showNotification('Error al eliminar clubes huérfanos', 'error');
    }
}

// Exponer la función globalmente
window.deleteOrphanedClubs = deleteOrphanedClubs;

// ============ VERIFICACIÓN OCR DE LISTAS DE JUGADORES ============

// Inicializar verificación OCR
function initializeOCRVerification() {
    const matchSelect = document.getElementById('matchSelect');
    const photoInput = document.getElementById('playerListPhoto');
    const verifyBtn = document.getElementById('verifyBtn');
    
    if (matchSelect) {
        loadMatchesForVerification();
    }
    
    if (photoInput) {
        photoInput.addEventListener('change', function() {
            const hasMatch = matchSelect && matchSelect.value;
            const hasPhoto = this.files && this.files.length > 0;
            
            if (verifyBtn) {
                verifyBtn.disabled = !(hasMatch && hasPhoto);
            }
        });
    }
    
    if (matchSelect) {
        matchSelect.addEventListener('change', function() {
            const hasMatch = this.value;
            const hasPhoto = photoInput && photoInput.files && photoInput.files.length > 0;
            
            if (verifyBtn) {
                verifyBtn.disabled = !(hasMatch && hasPhoto);
            }
        });
    }
}

// Cargar partidos para verificación
async function loadMatchesForVerification() {
    try {
        const response = await fetch('/api/matches');
        if (response.ok) {
            const matches = await response.json();
            const matchSelect = document.getElementById('matchSelect');
            
            if (matchSelect) {
                matchSelect.innerHTML = '<option value="">Seleccionar partido jugado...</option>';
                
                // Solo mostrar partidos con resultados (jugados)
                const playedMatches = matches.filter(match => 
                    match.homeScore !== null && match.awayScore !== null
                );
                
                playedMatches.forEach(match => {
                    const option = document.createElement('option');
                    option.value = match.id;
                    option.textContent = `${match.homeTeam} vs ${match.awayTeam} (${match.date})`;
                    matchSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error cargando partidos:', error);
    }
}

// Función principal de verificación OCR
window.verifyPlayerList = async function() {
    const matchSelect = document.getElementById('matchSelect');
    const photoInput = document.getElementById('playerListPhoto');
    const statusDiv = document.getElementById('ocrStatus');
    const resultsDiv = document.getElementById('verificationResults');
    const verifyBtn = document.getElementById('verifyBtn');
    
    if (!matchSelect.value || !photoInput.files[0]) {
        showNotification('Por favor selecciona un partido y sube una foto', 'error');
        return;
    }
    
    const matchId = matchSelect.value;
    const imageFile = photoInput.files[0];
    
    try {
        // Mostrar estado de procesamiento
        statusDiv.style.display = 'block';
        resultsDiv.style.display = 'none';
        verifyBtn.disabled = true;
        
        console.log('🤖 Iniciando verificación OCR...');
        
        // Procesar imagen con Tesseract.js
        const { data: { text } } = await Tesseract.recognize(imageFile, 'spa', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    statusDiv.innerHTML = `
                        <div style="color: #00ff88; font-size: 16px;">
                            <i class="fas fa-spinner fa-spin"></i> Procesando imagen... ${progress}%
                        </div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 14px; margin-top: 5px;">Extrayendo texto de la imagen</div>
                    `;
                }
            }
        });
        
        console.log('✅ Texto extraído:', text);
        
        // Procesar nombres detectados
        const detectedNames = parsePlayerNames(text);
        console.log('📝 Nombres detectados:', detectedNames);
        
        // Obtener jugadores registrados del partido
        const registeredPlayers = await getRegisteredPlayersForMatch(matchId);
        console.log('📊 Jugadores registrados:', registeredPlayers);
        
        // Comparar nombres
        const verification = comparePlayerNames(detectedNames, registeredPlayers);
        
        // Mostrar resultados
        displayVerificationResults(verification, detectedNames, registeredPlayers);
        
        // Limpiar imagen (como solicitó el usuario)
        photoInput.value = '';
        
        showNotification('Verificación completada exitosamente', 'success');
        
    } catch (error) {
        console.error('Error en verificación OCR:', error);
        showNotification('Error procesando la imagen', 'error');
    } finally {
        // Ocultar estado de procesamiento
        statusDiv.style.display = 'none';
        verifyBtn.disabled = false;
    }
};

// Procesar nombres de la lista extraída
function parsePlayerNames(text) {
    const lines = text.split('\n');
    const names = [];
    
    lines.forEach(line => {
        // Limpiar línea: remover números, guiones, puntos, etc.
        const cleanLine = line
            .replace(/^\d+\.?\s*|-\s*|•\s*/g, '') // Remover numeración
            .replace(/[^a-zA-ZÀ-ÿ\s]/g, '') // Solo letras y espacios
            .trim();
        
        // Solo agregar si parece un nombre (más de 2 caracteres, contiene espacios)
        if (cleanLine.length > 2 && cleanLine.includes(' ')) {
            names.push(cleanLine);
        }
    });
    
    return names;
}

// Obtener jugadores registrados para un partido
async function getRegisteredPlayersForMatch(matchId) {
    try {
        // Obtener información del partido
        const matchResponse = await fetch('/api/matches');
        const matches = await matchResponse.json();
        const match = matches.find(m => m.id == matchId);
        
        if (!match) {
            throw new Error('Partido no encontrado');
        }
        
        // Obtener jugadores de ambos equipos
        const playersResponse = await fetch('/api/players');
        const allPlayers = await playersResponse.json();
        
        // Obtener equipos del partido
        const teamsResponse = await fetch('/api/teams');
        const teams = await teamsResponse.json();
        
        const homeTeam = teams.find(t => t.name === match.homeTeam);
        const awayTeam = teams.find(t => t.name === match.awayTeam);
        
        if (!homeTeam || !awayTeam) {
            throw new Error('Equipos del partido no encontrados');
        }
        
        // Filtrar jugadores de ambos equipos
        const matchPlayers = allPlayers.filter(player => 
            player.clubId === homeTeam.id || player.clubId === awayTeam.id
        );
        
        console.log(`📋 Jugadores registrados para verificación:`);
        console.log(`🏠 ${match.homeTeam}: ${matchPlayers.filter(p => p.clubId === homeTeam.id).map(p => p.name).join(', ')}`);
        console.log(`🚌 ${match.awayTeam}: ${matchPlayers.filter(p => p.clubId === awayTeam.id).map(p => p.name).join(', ')}`);
        console.log(`📊 Total jugadores registrados: ${matchPlayers.length}`);
        
        return matchPlayers;
        
    } catch (error) {
        console.error('Error obteniendo jugadores del partido:', error);
        return [];
    }
}

// Comparar nombres detectados vs registrados
function comparePlayerNames(detectedNames, registeredPlayers) {
    const registeredNames = registeredPlayers.map(p => p.name.toLowerCase());
    const validPlayers = [];
    const invalidPlayers = [];
    const warnings = [];
    
    detectedNames.forEach(detectedName => {
        const lowerDetected = detectedName.toLowerCase();
        
        // Buscar coincidencia exacta
        const exactMatch = registeredNames.find(regName => regName === lowerDetected);
        
        if (exactMatch) {
            validPlayers.push(detectedName);
        } else {
            // Buscar coincidencia parcial (por si hay errores de OCR)
            const partialMatch = registeredNames.find(regName => {
                const similarity = calculateSimilarity(lowerDetected, regName);
                return similarity > 0.7; // 70% de similitud
            });
            
            if (partialMatch) {
                validPlayers.push(detectedName);
                warnings.push(`"${detectedName}" parece ser "${registeredPlayers.find(p => p.name.toLowerCase() === partialMatch).name}" (verificar OCR)`);
            } else {
                invalidPlayers.push(detectedName);
            }
        }
    });
    
    return {
        validPlayers,
        invalidPlayers,
        warnings,
        totalDetected: detectedNames.length,
        totalRegistered: registeredPlayers.length
    };
}

// Calcular similitud entre dos strings
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

// Calcular distancia de Levenshtein
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// Mostrar resultados de verificación
function displayVerificationResults(verification, detectedNames, registeredPlayers) {
    const resultsDiv = document.getElementById('verificationResults');
    
    const html = `
        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 15px; padding: 25px;">
            <h3 style="color: #00ff88; margin-bottom: 20px; text-align: center;">
                <i class="fas fa-clipboard-check"></i> Reporte de Verificación
            </h3>
            
            <!-- Resumen -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
                <div style="background: rgba(0, 255, 136, 0.1); padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="color: #00ff88; font-size: 24px; font-weight: bold;">${verification.totalDetected}</div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 14px;">Jugadores Detectados</div>
                </div>
                <div style="background: rgba(0, 255, 136, 0.1); padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="color: #00ff88; font-size: 24px; font-weight: bold;">${verification.validPlayers.length}</div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 14px;">Registrados</div>
                </div>
                <div style="background: rgba(255, 75, 87, 0.1); padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="color: #ff4757; font-size: 24px; font-weight: bold;">${verification.invalidPlayers.length}</div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 14px;">NO Registrados</div>
                </div>
            </div>
            
            ${verification.validPlayers.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #00ff88; margin-bottom: 10px;">
                        <i class="fas fa-check-circle"></i> Jugadores Registrados (${verification.validPlayers.length})
                    </h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${verification.validPlayers.map(name => 
                            `<span style="background: rgba(0, 255, 136, 0.2); color: #00ff88; padding: 5px 12px; border-radius: 15px; font-size: 14px;">${name}</span>`
                        ).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${verification.invalidPlayers.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #ff4757; margin-bottom: 10px;">
                        <i class="fas fa-exclamation-triangle"></i> Jugadores NO Registrados (${verification.invalidPlayers.length})
                    </h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${verification.invalidPlayers.map(name => 
                            `<span style="background: rgba(255, 75, 87, 0.2); color: #ff4757; padding: 5px 12px; border-radius: 15px; font-size: 14px;">${name}</span>`
                        ).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${verification.warnings.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #ffa500; margin-bottom: 10px;">
                        <i class="fas fa-exclamation-circle"></i> Advertencias (${verification.warnings.length})
                    </h4>
                    ${verification.warnings.map(warning => 
                        `<div style="background: rgba(255, 165, 0, 0.1); color: #ffa500; padding: 10px; border-radius: 8px; margin-bottom: 5px; font-size: 14px;">${warning}</div>`
                    ).join('')}
                </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                <small style="color: rgba(255,255,255,0.6);">La imagen ha sido eliminada automáticamente por seguridad</small>
            </div>
        </div>
    `;
    
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
}

// Funciones de playoffs
window.generateBracket = generateBracket;
window.createCustomBracket = createCustomBracket;
window.showCustomPairings = showCustomPairings;
window.hideCustomPairings = hideCustomPairings;

// Función de prueba para forzar renderizado
function forceRenderTeams() {
    console.log('🚀 FORZANDO RENDERIZADO DE EQUIPOS...');
    console.log('🎯 Teams array:', teams);
    
    const teamsGrid = document.getElementById('teamsGrid');
    console.log('🎯 TeamsGrid element:', teamsGrid);
    
    if (!teamsGrid) {
        console.error('❌ ERROR: teamsGrid no encontrado!');
        return;
    }
    
    if (!teams || teams.length === 0) {
        console.error('❌ ERROR: No hay equipos para renderizar!');
        return;
    }
    
    teamsGrid.innerHTML = '';
    console.log('🧹 TeamsGrid limpiado');
    
    teams.forEach((team, index) => {
        console.log(`🏆 Renderizando equipo ${index + 1}:`, team.name);
        
        const teamCard = document.createElement('div');
        teamCard.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(0, 255, 136, 0.2);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 20px;
        `;
        
        teamCard.innerHTML = `
            <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; background: rgba(0,255,136,0.1); display: flex; align-items: center; justify-content: center;">
                ${team.logo ? 
                    `<img src="${team.logo}" alt="${team.name} Logo" style="width: 100%; height: 100%; object-fit: cover;">` :
                    `<i class="fas fa-users" style="color: #00ff88; font-size: 24px;"></i>`
                }
            </div>
            <div style="flex: 1;">
                <h3 style="color: #00ff88; margin: 0; font-size: 18px;">${team.name}</h3>
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="editTeam(${team.id})" style="background: linear-gradient(45deg, #3498db, #2980b9); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button onclick="deleteTeam(${team.id})" style="background: linear-gradient(45deg, #e74c3c, #c0392b); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        `;
        teamsGrid.appendChild(teamCard);
    });
    
    console.log('✅ RENDERIZADO FORZADO COMPLETADO!');
}

// Funciones de navegación
window.switchTab = switchTab;
window.logout = logout;
window.forceRenderTeams = forceRenderTeams;

// Función simple y directa para agregar botones
function addEditButtonsToTeams() {
    console.log('🔧 INICIANDO: addEditButtonsToTeams');
    
    const teamsGrid = document.getElementById('teamsGrid');
    if (!teamsGrid) {
        console.error('❌ teamsGrid no encontrado');
        return;
    }
    
    console.log('🔧 teamsGrid encontrado:', teamsGrid);
    
    // Buscar todas las tarjetas de equipos existentes
    const teamCards = teamsGrid.children;
    console.log('🔧 Tarjetas encontradas:', teamCards.length);
    
    if (teamCards.length === 0) {
        console.log('⚠️ No hay tarjetas de equipos');
        return;
    }
    
    // Agregar botones a cada tarjeta
    for (let i = 0; i < teamCards.length; i++) {
        const card = teamCards[i];
        console.log(`🔧 Procesando tarjeta ${i + 1}`);
        
        // Verificar si ya tiene botones
        if (card.querySelector('.edit-buttons')) {
            console.log(`ℹ️ Tarjeta ${i + 1} ya tiene botones`);
            continue;
        }
        
        // Crear contenedor de botones
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'edit-buttons';
        buttonsDiv.style.cssText = 'display: flex !important; gap: 10px; margin-top: 15px; padding: 10px; background: rgba(255,0,0,0.1); border: 2px solid red; width: 100%; box-sizing: border-box; position: relative; z-index: 9999;';
        
        // Botón Editar
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Editar';
        editBtn.style.cssText = 'background: linear-gradient(45deg, #3498db, #2980b9); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;';
        editBtn.onclick = function() {
            alert('Botón Editar funciona! (Equipo ' + (i + 1) + ')');
        };
        
        // Botón Eliminar
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
        deleteBtn.style.cssText = 'background: linear-gradient(45deg, #e74c3c, #c0392b); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;';
        deleteBtn.onclick = function() {
            alert('Botón Eliminar funciona! (Equipo ' + (i + 1) + ')');
        };
        
        // Agregar botones al contenedor
        buttonsDiv.appendChild(editBtn);
        buttonsDiv.appendChild(deleteBtn);
        
        // Agregar contenedor a la tarjeta
        card.appendChild(buttonsDiv);
        
        console.log(`✅ Botones agregados a tarjeta ${i + 1}`);
    }
    
    console.log('✅ COMPLETADO: addEditButtonsToTeams');
}

// Funciones de equipos
window.editTeam = editTeam;
window.deleteTeam = deleteTeam;
window.cancelTeamEdit = cancelTeamEdit;
window.addEditButtonsToTeams = addEditButtonsToTeams;

console.log('✅ Funciones globales expuestas correctamente');
