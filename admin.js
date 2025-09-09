// Admin panel functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Inicializando panel de administración...');
    
    initializeAdmin();
    setupEventListeners();
    loadInitialData();
    initializeWebSocket(); // Inicializar WebSocket para sincronización
    
    // Poblar selectores de equipos para formulario de partidos
    setTimeout(() => {
        populateTeamSelects();
    }, 1000); // Esperar 1 segundo para que se carguen los equipos
    
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

window.deleteTeam = async function(teamId, event) {
    console.group('🗑️ [DELETE TEAM] Iniciando eliminación de equipo...');
    console.log('🔍 [DELETE TEAM] ID recibido:', teamId);
    console.log('🔍 [DELETE TEAM] Tipo de ID:', typeof teamId);
    console.log('🔍 [DELETE TEAM] Evento:', event);
    
    // Si no se proporcionó teamId, intentar obtenerlo del botón que disparó el evento
    if ((!teamId || teamId === 'undefined') && event) {
        const button = event.target.closest('button');
        if (button) {
            teamId = button.getAttribute('data-team-id');
            console.log('🔍 [DELETE TEAM] ID obtenido del botón:', teamId);
        }
    }
    
    // Verificar que teamId no sea undefined o vacío
    if (!teamId && teamId !== 0) {
        const errorMsg = '❌ [DELETE TEAM] Error: No se pudo obtener un ID de equipo válido';
        console.error(errorMsg);
        console.log('🔍 [DELETE TEAM] Equipos disponibles:', teams);
        alert('Error: No se pudo identificar el equipo a eliminar. Por favor, recarga la página e intenta de nuevo.');
        console.groupEnd();
        return;
    }
    
    // Buscar el equipo en el array local
    const team = teams.find(t => t.id == teamId || t._id == teamId || t.id === teamId || t._id === teamId);
    
    if (!team) {
        const errorMsg = `❌ [DELETE TEAM] No se encontró ningún equipo con el ID: ${teamId}`;
        console.error(errorMsg);
        console.log('🔍 [DELETE TEAM] Equipos disponibles:', teams);
        alert('Error: Equipo no encontrado. Por favor, recarga la página e intenta de nuevo.');
        return;
    }
    
    console.log('🔍 [DELETE TEAM] Equipo encontrado:', team.name, '(ID:', team.id || team._id, ')');
    
    const confirmed = confirm(`¿Estás seguro de que quieres eliminar el equipo "${team.name}"?\n\nEsto también eliminará:\n- Todos los jugadores del equipo\n- El club asociado\n- Los partidos relacionados`);
    
    if (!confirmed) {
        console.log('❌ [DELETE TEAM] Eliminación cancelada por el usuario');
        return;
    }
    
    try {
        // Usar el ID correcto (puede ser _id o id)
        const actualTeamId = team._id || team.id;
        console.log('🔄 [DELETE TEAM] Enviando solicitud DELETE a:', `/api/teams/${actualTeamId}`);
        
        const response = await fetch(`/api/teams/${actualTeamId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 [DELETE TEAM] Respuesta del servidor:', response.status, response.statusText);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ [DELETE TEAM] Equipo eliminado exitosamente:', result);
            
            // Mostrar notificación de éxito
            const successMsg = `Equipo "${team.name}" eliminado exitosamente`;
            if (typeof showNotification === 'function') {
                showNotification(successMsg, 'success');
            } else {
                alert(`✅ ${successMsg}`);
            }
            
            // Recargar datos
            console.log('🔄 [DELETE TEAM] Recargando datos...');
            await loadTeams();
            await loadClubs();
            await loadPlayers();
            
        } else {
            let errorMsg;
            try {
                const errorData = await response.json();
                console.error('❌ [DELETE TEAM] Error del servidor:', errorData);
                errorMsg = errorData.error || `Error ${response.status}: ${response.statusText}`;
            } catch (e) {
                errorMsg = `Error ${response.status}: ${response.statusText}`;
                console.error('❌ [DELETE TEAM] No se pudo analizar la respuesta de error:', e);
            }
            
            const fullErrorMsg = `Error eliminando equipo: ${errorMsg}`;
            console.error('❌ [DELETE TEAM]', fullErrorMsg);
            
            if (typeof showNotification === 'function') {
                showNotification(fullErrorMsg, 'error');
            } else {
                alert(`❌ ${fullErrorMsg}`);
            }
        }
    } catch (error) {
        const errorMsg = 'Error de conexión con el servidor';
        console.error(`❌ [DELETE TEAM] ${errorMsg}:`, error);
        
        if (typeof showNotification === 'function') {
            showNotification(errorMsg, 'error');
        } else {
            alert(`❌ ${errorMsg}: ${error.message}`);
        }
    }
};

// FUNCIÓN DE PRUEBA SIMPLE
window.testButton = function() {
    alert('¡Los botones SÍ funcionan! El problema está resuelto.');
    console.log(' Función de prueba ejecutada correctamente');
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
            console.log('🏢 Actualización de clubes recibida:', updatedClubs?.length || 0);
            if (updatedClubs) {
                clubs = updatedClubs;
                if (currentTab === 'clubs') {
                    renderClubs();
                }
            }
        });
        
        // Handler para actualizaciones de equipos
        socket.on('teamsUpdate', (updatedTeams) => {
            console.log(' Equipos actualizados vía WebSocket:', updatedTeams.length);
            teams = updatedTeams;
            
            // Actualizar vista de equipos automáticamente
            forceRenderTeams();
            
            // Actualizar selectores de equipos en partidos
            populateTeamSelects();
            
            // Actualizar pestañas de equipos en jugadores
            loadTeamTabs();
            
            showNotification('Equipos actualizados', 'success');
        });
        
        socket.on('teamCreated', (newTeam) => {
            console.log(' Nuevo equipo creado:', newTeam.name);
            teams.push(newTeam);
            forceRenderTeams();
            populateTeamSelects();
            loadTeamTabs();
            showNotification(`Equipo "${newTeam.name}" creado`, 'success');
        });
        
        socket.on('teamDeleted', (deletedTeamId) => {
            console.log(' Equipo eliminado:', deletedTeamId);
            teams = teams.filter(t => t._id !== deletedTeamId && t.id !== deletedTeamId);
            forceRenderTeams();
            populateTeamSelects();
            loadTeamTabs();
            showNotification('Equipo eliminado', 'success');
        });
        
        // Handler para actualizaciones de clubes
        socket.on('clubsUpdate', (updatedClubs) => {
            console.log(' Clubes actualizados vía WebSocket:', updatedClubs.length);
            clubs = updatedClubs;
            renderClubs();
            showNotification('Clubes actualizados', 'success');
        });
        
        socket.on('clubCreated', (newClub) => {
            console.log(' Nuevo club creado:', newClub.name);
            clubs.push(newClub);
            renderClubs();
            showNotification(`Club "${newClub.name}" creado`, 'success');
        });
        
        socket.on('clubDeleted', (deletedClubId) => {
            console.log(' Club eliminado:', deletedClubId);
            clubs = clubs.filter(c => c._id !== deletedClubId && c.id !== deletedClubId);
            renderClubs();
            showNotification('Club eliminado', 'success');
        });
        
        // Handler para actualizaciones de brackets de playoffs
        socket.on('bracketUpdated', (updatedBracket) => {
            console.log('🏆 Bracket actualizado vía WebSocket:', updatedBracket);
            if (currentTab === 'playoffs' && updatedBracket) {
                currentBracket = updatedBracket;
                renderBracket(updatedBracket);
                showNotification('Bracket actualizado automáticamente', 'success');
            }
        });
        
        socket.on('playoffMatchUpdated', (matchData) => {
            console.log('🎯 Partido de playoff actualizado:', matchData);
            if (currentTab === 'playoffs') {
                showNotification(`Partido actualizado: ${matchData.winner} ganó`, 'success');
            }
        });
        
        // Handler para actualizaciones de jugadores
        socket.on('playersUpdate', (updatedPlayers) => {
            console.log('🏅 Jugadores actualizados vía WebSocket:', updatedPlayers.length);
            players = updatedPlayers;
            
            // Actualizar la vista si estamos en la pestaña de jugadores
            const selectedTeamId = document.querySelector('.team-tab.active')?.getAttribute('data-team-id');
            if (selectedTeamId) {
                loadTeamPlayers(selectedTeamId);
            }
        });
        
        socket.on('playerCreated', (newPlayer) => {
            console.log(' Nuevo jugador creado:', newPlayer.name);
            // NO agregar manualmente - ya se actualiza con playersUpdate
            
            // Actualizar vista si estamos viendo el equipo del jugador
            const selectedTeamId = document.querySelector('.team-tab.active')?.getAttribute('data-team-id');
            if (selectedTeamId === newPlayer.team._id || selectedTeamId === newPlayer.team) {
                setTimeout(() => loadTeamPlayers(selectedTeamId), 100); // Pequeño delay para asegurar que playersUpdate se procese primero
            }
            
            showNotification(`Jugador "${newPlayer.name}" creado`, 'success');
        });
        
        socket.on('playerDeleted', (deletedPlayerId) => {
            console.log(' Jugador eliminado:', deletedPlayerId);
            players = players.filter(p => p._id !== deletedPlayerId && p.id !== deletedPlayerId);
            
            // Actualizar vista actual
            const selectedTeamId = document.querySelector('.team-tab.active')?.getAttribute('data-team-id');
            if (selectedTeamId) {
                loadTeamPlayers(selectedTeamId);
            }
            
            showNotification('Jugador eliminado', 'success');
        });
        
        // Handler para cambios específicos de estadísticas
        socket.on('playerStatsChanged', (data) => {
            console.log(` Estadística actualizada: ${data.playerName} - ${data.statType}: ${data.value}`);
            showNotification(`${data.playerName}: ${data.statType === 'goals' ? 'Goles' : 'Asistencias'} actualizado a ${data.value}`, 'success');
        });
        
        // Handler para actualizaciones de partidos
        socket.on('matchesUpdate', (updatedMatches) => {
            console.log(' Partidos actualizados vía WebSocket:', updatedMatches.length);
            matches = updatedMatches;
            renderMatches();
            showNotification('Partidos actualizados', 'success');
        });
        
        socket.on('matchCreated', (newMatch) => {
            console.log(' Nuevo partido creado:', `${newMatch.homeTeam} vs ${newMatch.awayTeam}`);
            matches.push(newMatch);
            renderMatches();
            showNotification(`Partido "${newMatch.homeTeam} vs ${newMatch.awayTeam}" creado`, 'success');
        });
        
        socket.on('matchDeleted', (deletedMatchId) => {
            console.log(' Partido eliminado:', deletedMatchId);
            matches = matches.filter(m => m._id !== deletedMatchId && m.id !== deletedMatchId);
            renderMatches();
            showNotification('Partido eliminado', 'success');
        });
        
        socket.on('disconnect', () => {
            console.log(' Admin desconectado del servidor WebSocket');
        });
        
        // Hacer socket disponible globalmente
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
            // Add delay to ensure DOM is ready
            setTimeout(() => {
                console.log('🔄 Ejecutando setTimeout para initializeMatchGeneration...');
                initializeMatchGeneration();
            }, 500);
            // Also try immediate call as backup
            initializeMatchGeneration();
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
        console.log(`🏆 RENDERTEAMS: Procesando equipo ${index + 1}:`, team);
        
        // Asegurarse de que el equipo tenga un ID
        const teamId = team._id || team.id;
        if (!teamId) {
            console.error(`❌ RENDERTEAMS: El equipo "${team.name}" no tiene ID válido`, team);
            return; // Saltar este equipo si no tiene ID
        }
        
        html += `
            <div class="team-card" data-team-id="${teamId}" style="
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
                    <small style="color: rgba(255,255,255,0.5);">ID: ${teamId}</small>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.editTeam('${teamId}')" class="btn-edit">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button onclick="window.deleteTeam('${teamId}', event)" class="btn-delete" data-team-id="${teamId}">
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

// Las funciones deleteTeam duplicadas han sido eliminadas
// La función window.deleteTeam ya está definida al inicio del archivo

async function handleTeamSubmit(e) {
    e.preventDefault();
    
    const originalFormData = new FormData(e.target);
    const teamId = originalFormData.get('teamId');
    
    // Validar datos
    const teamName = originalFormData.get('teamName')?.trim();
    if (!teamName) {
        showNotification('El nombre del equipo es requerido', 'error');
        return;
    }
    
    // Crear nuevo FormData con los campos correctos para el backend
    const formData = new FormData();
    formData.append('name', teamName); // Backend espera 'name', no 'teamName'
    
    // Agregar logo si existe
    const logoFile = originalFormData.get('teamLogo');
    if (logoFile && logoFile.size > 0) {
        formData.append('logo', logoFile); // Backend espera 'logo', no 'teamLogo'
    }
    
    // Agregar teamId si existe (para edición)
    if (teamId) {
        formData.append('teamId', teamId);
    }
    
    try {
        const url = teamId ? `/api/teams/${teamId}` : '/api/teams';
        const method = teamId ? 'PUT' : 'POST';
        
        console.log('🚀 Enviando equipo:', {
            name: teamName,
            hasLogo: logoFile && logoFile.size > 0,
            method: method,
            url: url
        });
        
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
// window.deleteTeam ya está definido al inicio del archivo
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
        const clubId = club._id || club.id; // MongoDB usa _id
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
                <span>ID: ${clubId}</span>
            </div>
            <div class="club-actions">
                <button class="btn btn-small" data-club-id="${clubId}" onclick="window.editClub('${clubId}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-danger btn-small" data-club-id="${clubId}" onclick="window.deleteClub('${clubId}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        `;
        clubsGrid.appendChild(clubCard);
    });
}

async function handleClubSubmit(e) {
    e.preventDefault();
    
    const originalFormData = new FormData(e.target);
    const clubId = originalFormData.get('clubId');
    
    // Validar datos
    const clubName = originalFormData.get('clubName')?.trim();
    const clubDescription = originalFormData.get('clubDescription')?.trim();
    const clubFounded = parseInt(originalFormData.get('clubFounded'));
    const clubPlayers = parseInt(originalFormData.get('clubPlayers'));
    
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
        // Crear nuevo FormData con los nombres correctos que espera el backend
        const formData = new FormData();
        formData.append('name', clubName);
        formData.append('description', clubDescription);
        formData.append('founded', clubFounded);
        formData.append('players', clubPlayers);
        
        // Agregar logo si existe
        const logoFile = originalFormData.get('clubLogo');
        if (logoFile && logoFile.size > 0) {
            formData.append('logo', logoFile);
        }
        
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
    const club = clubs.find(c => (c._id || c.id) === clubId);
    if (!club) {
        console.error('❌ Club no encontrado con ID:', clubId);
        return;
    }
    
    // Llenar formulario con datos del club
    document.getElementById('clubId').value = club._id || club.id;
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
    
    const club = clubs.find(c => (c._id || c.id) === clubId || (c._id || c.id) === parseInt(clubId));
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
    console.log('🎯 INICIANDO loadPlayers()...');
    try {
        const response = await fetch('/api/players');
        if (!response.ok) throw new Error('Error fetching players');
        
        players = await response.json();
        console.log('✅ Jugadores cargados:', players.length);
        
        // Cargar equipos y crear pestañas
        console.log('🏆 Cargando equipos para pestañas...');
        await loadTeamsForPlayerManagement();
        setupPlayerEventListeners();
        
    } catch (error) {
        console.error('❌ Error loading players:', error);
        showNotification('Error cargando jugadores', 'error');
        players = [];
    }
}

// Cargar equipos para el sistema de pestañas
async function loadTeamsForPlayerManagement() {
    try {
        console.log('🔄 Obteniendo equipos desde /api/teams...');
        const response = await fetch('/api/teams');
        if (!response.ok) throw new Error('Error fetching teams');
        
        const teams = await response.json();
        console.log('🏆 Equipos obtenidos para pestañas:', teams.length, teams);
        renderTeamTabs(teams);
        
    } catch (error) {
        console.error('❌ Error loading teams:', error);
        showNotification('Error cargando equipos', 'error');
    }
}

// Renderizar pestañas de equipos
function renderTeamTabs(teams) {
    console.log('🎨 RENDERIZANDO PESTAÑAS DE EQUIPOS...');
    const teamTabsContainer = document.getElementById('teamTabs');
    if (!teamTabsContainer) {
        console.error('❌ Elemento teamTabs no encontrado!');
        return;
    }
    
    console.log('📋 Contenedor teamTabs encontrado:', teamTabsContainer);
    teamTabsContainer.innerHTML = '';
    
    if (teams.length === 0) {
        console.log('⚠️ No hay equipos para mostrar');
        teamTabsContainer.innerHTML = `
            <div style="text-align: center; color: rgba(255,255,255,0.6); padding: 20px;">
                <p>No hay equipos disponibles. Agrega equipos primero en la pestaña de Equipos.</p>
            </div>
        `;
        return;
    }
    
    console.log('🏆 Renderizando', teams.length, 'equipos como pestañas...');
    
    teams.forEach(team => {
        const tabElement = document.createElement('div');
        tabElement.className = 'team-tab';
        const teamId = team._id || team.id; // MongoDB usa _id
        tabElement.dataset.teamId = teamId;
        tabElement.innerHTML = `
            <i class="fas fa-users"></i>
            ${team.name}
        `;
        
        tabElement.addEventListener('click', () => selectTeam(teamId, team.name));
        teamTabsContainer.appendChild(tabElement);
    });
}

// Seleccionar equipo
function selectTeam(teamId, teamName) {
    console.log('🎯 SELECCIONANDO EQUIPO:', teamId, teamName);
    selectedTeamId = teamId;
    
    // Actualizar pestañas activas
    document.querySelectorAll('.team-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const targetTab = document.querySelector(`[data-team-id="${teamId}"]`);
    if (targetTab) {
        targetTab.classList.add('active');
        console.log('✅ Pestaña activada:', targetTab);
    } else {
        console.error('❌ No se encontró la pestaña para el equipo:', teamId);
    }
    
    // Mostrar contenedor de input rápido
    const quickAddContainer = document.getElementById('quickAddContainer');
    const teamPlayersContainer = document.getElementById('teamPlayersContainer');
    const selectedTeamNameElement = document.getElementById('selectedTeamName');
    
    console.log('🔍 Elementos encontrados:', {
        quickAddContainer: !!quickAddContainer,
        teamPlayersContainer: !!teamPlayersContainer,
        selectedTeamNameElement: !!selectedTeamNameElement
    });
    
    if (quickAddContainer) {
        quickAddContainer.style.display = 'block';
        console.log('✅ quickAddContainer mostrado');
    }
    if (teamPlayersContainer) {
        teamPlayersContainer.style.display = 'block';
        console.log('✅ teamPlayersContainer mostrado');
    }
    if (selectedTeamNameElement) {
        selectedTeamNameElement.textContent = teamName;
        console.log('✅ Nombre del equipo actualizado:', teamName);
    }
    
    // Cargar jugadores del equipo seleccionado
    loadTeamPlayers(teamId);
    
    // Enfocar el input
    const quickInput = document.getElementById('quickPlayerInput');
    if (quickInput) {
        setTimeout(() => quickInput.focus(), 100);
        console.log('✅ Input enfocado');
    }
}

// Cargar jugadores del equipo seleccionado
function loadTeamPlayers(teamId) {
    console.log('🔄 CARGANDO JUGADORES DEL EQUIPO:', teamId);
    console.log('📋 Array global players:', players.length, players);
    
    // Filtrar jugadores por team ID (no clubId)
    teamPlayers = players.filter(player => {
        const playerTeamId = player.team?._id || player.team;
        const match = playerTeamId === teamId;
        console.log(`🏆 Jugador ${player.name}: team=${playerTeamId}, match=${match}`);
        return match;
    });
    
    console.log('✅ Jugadores del equipo encontrados:', teamPlayers.length, teamPlayers);
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
                        <button onclick="editPlayerQuick('${player._id || player.id}')" style="background: rgba(0,255,136,0.2); border: 1px solid #00ff88; color: #00ff88; padding: 4px; border-radius: 4px; cursor: pointer; font-size: 10px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deletePlayerQuick('${player._id || player.id}')" style="background: rgba(255,0,0,0.2); border: 1px solid #ff4444; color: #ff4444; padding: 4px; border-radius: 4px; cursor: pointer; font-size: 10px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
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
                               onchange="updatePlayerStats('${player._id || player.id}', 'goals', this.value)"
                               style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 2px 4px; border-radius: 3px; width: 35px; font-size: 10px; text-align: center;">
                    </div>
                    <div style="flex: 1; display: flex; align-items: center; gap: 4px;">
                        <i class="fas fa-hands-helping" style="color: #00ff88; font-size: 10px;"></i>
                        <span style="color: rgba(255,255,255,0.7); font-size: 10px;">Asist:</span>
                        <input type="number" 
                               value="${player.assists || 0}" 
                               min="0" 
                               max="999"
                               onchange="updatePlayerStats('${player._id || player.id}', 'assists', this.value)"
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
    console.log('🔧 CONFIGURANDO EVENT LISTENERS DE JUGADORES...');
    const quickInput = document.getElementById('quickPlayerInput');
    const quickAddBtn = document.getElementById('quickAddBtn');
    
    console.log('🔍 Elementos encontrados:', {
        quickInput: !!quickInput,
        quickAddBtn: !!quickAddBtn
    });
    
    if (quickInput) {
        // Remover listeners existentes para evitar duplicados
        quickInput.removeEventListener('keypress', handleQuickInputKeypress);
        quickInput.addEventListener('keypress', handleQuickInputKeypress);
        console.log('✅ Event listener agregado al input');
    }
    
    if (quickAddBtn) {
        // Remover listeners existentes para evitar duplicados
        quickAddBtn.removeEventListener('click', addPlayerQuick);
        quickAddBtn.addEventListener('click', addPlayerQuick);
        console.log('✅ Event listener agregado al botón +');
    }
}

// Función separada para manejar el keypress del input
function handleQuickInputKeypress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        addPlayerQuick();
    }
}

// Variable global para prevenir doble envío
let isAddingPlayer = false;

// Agregar jugador rápidamente
async function addPlayerQuick() {

    // Prevenir doble envío
    if (isAddingPlayer) {
        console.log('⚠️ Ya se está agregando un jugador, ignorando...');
        return;
    }
    
    const quickInput = document.getElementById('quickPlayerInput');
    const quickAddBtn = document.getElementById('quickAddBtn');
    const playerName = quickInput.value.trim();
    
    console.log('🏃 addPlayerQuick iniciada con nombre:', playerName);
    console.log('🎯 selectedTeamId:', selectedTeamId);
    
    if (!playerName) {
        console.log('⚠️ Nombre vacío, cancelando...');
        showNotification('Por favor ingresa un nombre', 'error');
        return;
    }
    
    if (!selectedTeamId) {
        console.log('⚠️ No hay equipo seleccionado, cancelando...');
        showNotification('Selecciona un equipo primero', 'error');
        return;
    }
    
    // Marcar como ocupado y dar feedback visual
    isAddingPlayer = true;
    quickInput.disabled = true;
    quickAddBtn.disabled = true;
    quickAddBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    quickInput.placeholder = 'Agregando jugador...';
    
    console.log('🔒 UI bloqueada, procesando...');
    
    const playerData = {
        name: playerName,
        teamId: selectedTeamId,
        position: 'Jugador',
        age: 25,
        number: getNextAvailableNumber(),
        nationality: 'Panamá'
    };
    
    console.log('📦 Datos del jugador a enviar:', playerData);
    
    try {
        console.log('🚀 Enviando POST a /api/players...');
        
        const response = await fetch('/api/players', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(playerData)
        });
        
        console.log('📡 Respuesta del servidor:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.log('❌ Error del servidor:', errorData);
            throw new Error(errorData.error || 'Error al agregar jugador');
        }
        
        const newPlayer = await response.json();
        console.log('✅ Jugador creado exitosamente:', newPlayer);
        
        // No agregar manualmente - el WebSocket se encarga de la actualización
        // players.push(newPlayer); // Removido para evitar duplicación
        console.log('🔄 Recargando jugadores del equipo...');
        loadTeamPlayers(selectedTeamId);
        
        quickInput.value = '';
        quickInput.focus();
        
        showNotification(`Jugador "${playerName}" agregado exitosamente`, 'success');
        console.log('✅ addPlayerQuick completado exitosamente');
        
    } catch (error) {
        console.error('❌ Error completo en addPlayerQuick:', error);
        console.error('❌ Stack trace:', error.stack);
        showNotification(error.message || 'Error al agregar jugador', 'error');
    } finally {
        // Restaurar UI siempre (éxito o error)
        isAddingPlayer = false;
        quickInput.disabled = false;
        quickAddBtn.disabled = false;
        quickAddBtn.innerHTML = '<i class="fas fa-plus"></i>';
        quickInput.placeholder = 'Nombre del jugador...';
        console.log('🔓 UI desbloqueada');
    }
}

// Obtener siguiente número disponible
function getNextAvailableNumber() {
    console.log('🔢 Calculando siguiente número disponible...');
    console.log('📄 teamPlayers:', teamPlayers);
    
    // Obtener jugadores del equipo seleccionado desde el array global players
    const teamPlayersFiltered = players.filter(p => {
        const playerTeamId = p.team?._id || p.team;
        return playerTeamId === selectedTeamId;
    });
    
    console.log('🏆 Jugadores del equipo seleccionado:', teamPlayersFiltered);
    
    const usedNumbers = teamPlayersFiltered.map(p => p.number).filter(n => n && !isNaN(n));
    console.log('🔢 Números ocupados:', usedNumbers);
    
    for (let i = 1; i <= 99; i++) {
        if (!usedNumbers.includes(i)) {
            console.log('✅ Siguiente número disponible:', i);
            return i;
        }
    }
    
    console.log('⚠️ No hay números disponibles, usando 99');
    return 99;
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

// Eliminar jugador (versión rápida)
async function deletePlayerQuick(playerId) {
    console.log('🗑️ INICIANDO deletePlayerQuick:', playerId);
    
    // Buscar jugador por ID (MongoDB usa _id)
    const player = players.find(p => (p._id || p.id) === playerId);
    if (!player) {
        console.error('❌ Jugador no encontrado con ID:', playerId);
        showNotification('Error: Jugador no encontrado', 'error');
        return;
    }
    
    console.log('🔍 Jugador encontrado:', player.name);
    
    const confirmed = confirm(`¿Estás seguro de que quieres eliminar al jugador "${player.name}"?`);
    if (!confirmed) {
        console.log('❌ Eliminación cancelada por el usuario');
        return;
    }
    
    try {
        console.log('🚀 Enviando DELETE a /api/players/' + playerId);
        
        const response = await fetch(`/api/players/${playerId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 Respuesta del servidor:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Error del servidor:', errorData);
            throw new Error(errorData.error || 'Error al eliminar jugador');
        }
        
        console.log('✅ Jugador eliminado exitosamente del servidor');
        
        // Actualizar array local
        const playerIndex = players.findIndex(p => (p._id || p.id) === playerId);
        if (playerIndex !== -1) {
            players.splice(playerIndex, 1);
            console.log('✅ Jugador eliminado del array local');
        }
        
        // Recargar lista de jugadores del equipo
        loadTeamPlayers(selectedTeamId);
        
        showNotification(`Jugador "${player.name}" eliminado exitosamente`, 'success');
        console.log('✅ deletePlayerQuick completado exitosamente');
        
    } catch (error) {
        console.error('❌ Error completo en deletePlayerQuick:', error);
        console.error('❌ Stack trace:', error.stack);
        showNotification(error.message || 'Error al eliminar jugador', 'error');
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
    
    // NO convertir a número - mantener como string para MongoDB IDs
    console.log('🔍 Buscando jugador con ID:', playerId);
    
    // Buscar primero en teamPlayers (jugadores del equipo actual)
    let player = teamPlayers.find(p => {
        const playerIdToCompare = p._id || p.id;
        console.log('Comparando en teamPlayers:', playerIdToCompare, 'con', playerId);
        return playerIdToCompare === playerId || playerIdToCompare == playerId;
    });
    
    // Si no se encuentra en teamPlayers, buscar en el array global
    if (!player) {
        player = players.find(p => {
            const playerIdToCompare = p._id || p.id;
            console.log('Comparando en players:', playerIdToCompare, 'con', playerId);
            return playerIdToCompare === playerId || playerIdToCompare == playerId;
        });
    }
    
    console.log('🔍 Jugador encontrado:', player);
    
    if (!player) {
        console.error('❌ Jugador no encontrado con ID:', playerId);
        console.error('❌ teamPlayers IDs:', teamPlayers.map(p => ({ id: p._id || p.id, name: p.name })));
        console.error('❌ players IDs:', players.map(p => ({ id: p._id || p.id, name: p.name })));
        showNotification('Jugador no encontrado', 'error');
        return;
    }
    
    console.log('❓ Mostrando diálogo de confirmación...');
    if (confirm(`¿Estás seguro de que quieres eliminar a "${player.name}"?`)) {
        console.log('✅ Usuario confirmó eliminación, llamando deletePlayerFromAPI...');
        deletePlayerFromAPI(playerId);
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

// Función loadTeams duplicada eliminada
// La función loadTeams principal ya está definida al inicio del archivo

// Función handleTeamSubmit duplicada eliminada
// La función handleTeamSubmit principal ya está definida al inicio del archivo

// Función deleteTeam duplicada eliminada
// La función window.deleteTeam ya está definida al inicio del archivo

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

// ==================== TEAM SELECTS POPULATION ====================

function populateTeamSelects() {
    console.log('🏆 POBLANDO SELECTORES DE EQUIPOS...');
    const homeTeamSelect = document.getElementById('homeTeam');
    const awayTeamSelect = document.getElementById('awayTeam');
    
    console.log('🏠 homeTeamSelect:', homeTeamSelect);
    console.log('✈️ awayTeamSelect:', awayTeamSelect);
    
    if (!homeTeamSelect || !awayTeamSelect) {
        console.error('❌ Selectores de equipos no encontrados');
        return;
    }
    
    // Limpiar selects
    homeTeamSelect.innerHTML = '<option value="">Cargando equipos...</option>';
    awayTeamSelect.innerHTML = '<option value="">Cargando equipos...</option>';
    
    // Cargar equipos desde la API
    fetch('/api/teams')
        .then(response => response.json())
        .then(teams => {
            console.log('🏆 Equipos obtenidos para selectores:', teams);
            
            // Limpiar selects
            homeTeamSelect.innerHTML = '<option value="">Seleccionar equipo...</option>';
            awayTeamSelect.innerHTML = '<option value="">Seleccionar equipo...</option>';
            
            // Agregar equipos a ambos selects
            teams.forEach(team => {
                const option1 = document.createElement('option');
                option1.value = team.name; // Usar team.name como valor
                option1.textContent = team.name;
                homeTeamSelect.appendChild(option1);
                
                const option2 = document.createElement('option');
                option2.value = team.name; // Usar team.name como valor
                option2.textContent = team.name;
                awayTeamSelect.appendChild(option2);
                
                console.log('✅ Equipo agregado a selectores:', team.name);
            });
            
            console.log('✅ Selectores de equipos poblados exitosamente');
        })
        .catch(error => {
            console.error('❌ Error cargando equipos:', error);
            homeTeamSelect.innerHTML = '<option value="">Error al cargar equipos</option>';
            awayTeamSelect.innerHTML = '<option value="">Error al cargar equipos</option>';
        });
}

// ==================== MATCHES MANAGEMENT ====================

async function loadMatches() {
    console.log('🎯 DEPURACIÓN: Iniciando loadMatches()');
    const matchesGrid = document.getElementById('matchesGrid');
    console.log('🎯 DEPURACIÓN: matchesGrid encontrado:', !!matchesGrid);
    
    if (!matchesGrid) {
        console.error('❌ DEPURACIÓN: matchesGrid NO encontrado!');
        return;
    }
    
    // Mostrar indicador de carga
    matchesGrid.innerHTML = '<div class="loading">Cargando partidos...</div>';
    console.log('🎯 DEPURACIÓN: Indicador de carga mostrado');
    
    try {
        // Agregar timeout para evitar que se quede cargando indefinidamente
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout
        
        const response = await fetch('/api/matches', {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        matches = await response.json();
        console.log('🎯 DEPURACIÓN: Partidos cargados desde API:', matches.length, matches);
        
        // Siempre renderizar los partidos cuando se cargan
        console.log('🎯 DEPURACIÓN: Llamando renderMatches()...');
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
    console.log('🎯 DEPURACIÓN: Iniciando renderMatches...');
    console.log('🎯 DEPURACIÓN: Variable matches:', matches);
    console.log('🎯 DEPURACIÓN: matches.length:', matches ? matches.length : 'undefined');
    
    const matchesGrid = document.getElementById('matchesGrid');
    console.log('🎯 DEPURACIÓN: matchesGrid encontrado en renderMatches:', !!matchesGrid);
    
    if (!matchesGrid) {
        console.error('❌ DEPURACIÓN: matchesGrid NO encontrado en renderMatches!');
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
            const matchId = match._id || match.id || 'unknown';

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

    console.log('🏆 DATOS DEL PARTIDO:', matchData);
    console.log('🏠 Equipo local:', matchData.homeTeam, 'tipo:', typeof matchData.homeTeam);
    console.log('✈️ Equipo visitante:', matchData.awayTeam, 'tipo:', typeof matchData.awayTeam);
    console.log('🔍 Comparación ===:', matchData.homeTeam === matchData.awayTeam);
    console.log('🔍 Comparación ==:', matchData.homeTeam == matchData.awayTeam);
    
    if (!matchData.homeTeam || !matchData.awayTeam || !matchData.date || !matchData.time) {
        showNotification('Todos los campos son requeridos', 'error');
        return;
    }

    if (matchData.homeTeam === matchData.awayTeam) {
        console.error('❌ ERROR: Equipos iguales detectados!');
        console.error('❌ homeTeam:', JSON.stringify(matchData.homeTeam));
        console.error('❌ awayTeam:', JSON.stringify(matchData.awayTeam));
        showNotification('Un equipo no puede jugar contra sí mismo', 'error');
        return;
    }
    
    console.log('✅ Validación de equipos pasada - equipos diferentes');
    console.log('✅ homeTeam:', matchData.homeTeam);
    console.log('✅ awayTeam:', matchData.awayTeam);

    try {
        const response = await fetch('/api/matches', {
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
        const response = await fetch(`/api/matches/${matchId}`, {
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

// ==================== AUTOMATIC MATCH GENERATION ====================

async function initializeMatchGeneration() {
    console.log('🔧 Inicializando generación de partidos...');
    
    // Wait a bit more for DOM to be ready
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const generateBtn = document.getElementById('generateMatchesBtn');
    console.log('🔧 Botón encontrado:', !!generateBtn);
    console.log('🔧 Elemento completo:', generateBtn);
    
    if (generateBtn) {
        // Remove any existing listeners first
        generateBtn.removeEventListener('click', generateMatches);
        generateBtn.addEventListener('click', generateMatches);
        console.log('✅ Event listener agregado al botón');
        
        // Test click manually with direct onclick
        generateBtn.onclick = function(e) {
            e.preventDefault();
            console.log('🎯 CLICK DETECTADO EN EL BOTÓN!');
            generateMatches();
        };
        
        // Also add a direct test
        console.log('🧪 Agregando test directo al botón...');
        generateBtn.style.cursor = 'pointer';
        generateBtn.setAttribute('data-initialized', 'true');
        
    } else {
        console.log('❌ No se encontró el botón generateMatchesBtn');
        // Try to find it by class or other means
        const allButtons = document.querySelectorAll('button');
        console.log('🔍 Todos los botones encontrados:', allButtons.length);
        allButtons.forEach((btn, index) => {
            console.log(`Botón ${index}:`, btn.id, btn.textContent?.trim());
        });
        
        // Try to find by text content
        const matchBtn = Array.from(allButtons).find(btn => 
            btn.textContent?.includes('Generar') && btn.textContent?.includes('Partidos')
        );
        if (matchBtn) {
            console.log('🎯 Encontrado botón por texto:', matchBtn);
            matchBtn.onclick = function(e) {
                e.preventDefault();
                console.log('🎯 CLICK DETECTADO POR TEXTO!');
                generateMatches();
            };
        }
    }
}

async function generateMatches() {
    console.log('🎯 generateMatches() iniciado');
    
    if (!confirm('¿Estás seguro de que quieres generar todos los partidos?')) {
        console.log('❌ Usuario canceló la generación');
        return;
    }
    
    console.log('✅ Usuario confirmó la generación');
    
    const teams = await getTeamsForGeneration();
    console.log('📊 Equipos obtenidos:', teams.length, teams);
    
    if (teams.length < 2) {
        console.log('❌ No hay suficientes equipos');
        showNotification('Se necesitan al menos 2 equipos para generar partidos', 'error');
        return;
    }
    
    const startDate = document.getElementById('startDate').value || null;
    const defaultTime = document.getElementById('defaultTime').value || null;
    const roundTrip = document.getElementById('roundTrip').checked;
    
    console.log('⚙️ Configuración:', { startDate, defaultTime, roundTrip });
    
    const matches = generateMatchSchedule(teams, startDate, defaultTime, roundTrip);
    console.log('🎮 Partidos generados:', matches.length, matches);
    
    if (matches.length === 0) {
        console.log('❌ No se generaron partidos');
        showNotification('No se pudieron generar partidos', 'error');
        return;
    }
    
    try {
        showNotification('Generando partidos...', 'info');
        console.log('📡 Enviando al servidor...');
        
        const response = await fetch('/api/matches/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ matches })
        });
        
        console.log('📡 Respuesta del servidor:', response.status);
        
        const result = await response.json();
        console.log('📊 Resultado:', result);
        
        if (response.ok) {
            showNotification(`${result.created} partidos generados exitosamente`, 'success');
            await loadMatches();
        } else {
            console.log('❌ Error del servidor:', result.error);
            showNotification(result.error || 'Error generando partidos', 'error');
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        showNotification('Error de conexión', 'error');
    }
}

async function getTeamsForGeneration() {
    try {
        const response = await fetch('/api/teams');
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Error fetching teams:', error);
        return [];
    }
}

function generateMatchSchedule(teams, startDate, defaultTime, roundTrip) {
    console.log('🏗️ generateMatchSchedule iniciado');
    console.log('📊 Parámetros:', { teams: teams.length, startDate, defaultTime, roundTrip });
    
    const matches = [];
    const numTeams = teams.length;
    
    if (numTeams < 2) {
        console.log('❌ No hay suficientes equipos');
        return matches;
    }
    
    // Algoritmo Round Robin clásico - garantiza exactamente (n-1) jornadas con n/2 partidos cada una
    function generateRoundRobin(teamsArray, isSecondLeg = false) {
        const n = teamsArray.length;
        const rounds = n - 1; // Siempre n-1 jornadas para n equipos pares
        
        let currentMatchday = isSecondLeg ? rounds + 1 : 1;
        
        // Crear lista de equipos (el primer equipo se mantiene fijo)
        const teams = [...teamsArray];
        
        for (let round = 0; round < rounds; round++) {
            console.log(`🔄 Generando jornada ${currentMatchday}${isSecondLeg ? ' (vuelta)' : ''}`);
            
            const roundMatches = [];
            
            // Generar partidos para esta jornada usando rotación circular
            for (let i = 0; i < n / 2; i++) {
                let homeIndex, awayIndex;
                
                if (i === 0) {
                    // Primer partido: equipo fijo (0) vs equipo rotativo
                    homeIndex = 0;
                    awayIndex = n - 1 - round;
                    if (awayIndex <= 0) awayIndex = n - 1;
                } else {
                    // Otros partidos: rotación circular
                    homeIndex = (round + i) % (n - 1) + 1;
                    awayIndex = (round + n - 1 - i) % (n - 1) + 1;
                    
                    // Ajustar si coincide con el equipo fijo
                    if (homeIndex >= n) homeIndex = 1;
                    if (awayIndex >= n) awayIndex = 1;
                }
                
                // Evitar que un equipo juegue contra sí mismo
                if (homeIndex === awayIndex) continue;
                
                const homeTeam = teams[homeIndex];
                const awayTeam = teams[awayIndex];
                
                // Para la segunda vuelta, intercambiar local y visitante
                const finalHome = isSecondLeg ? awayTeam : homeTeam;
                const finalAway = isSecondLeg ? homeTeam : awayTeam;
                
                const matchData = {
                    homeTeam: finalHome.name,
                    awayTeam: finalAway.name,
                    date: startDate || '2024-01-01',
                    time: defaultTime || '15:00',
                    matchday: currentMatchday
                };
                
                roundMatches.push(matchData);
            }
            
            // Agregar partidos de esta jornada
            roundMatches.forEach(match => {
                matches.push(match);
                console.log(`✅ J${currentMatchday}: ${match.homeTeam} vs ${match.awayTeam}`);
            });
            
            currentMatchday++;
        }
    }
    
    // Primera vuelta
    generateRoundRobin(teams, false);
    
    // Segunda vuelta si está activada
    if (roundTrip) {
        console.log('🔄 Generando partidos de vuelta...');
        generateRoundRobin(teams, true);
    }
    
    const totalJornadas = roundTrip ? 2 * (numTeams - 1) : (numTeams - 1);
    const partidosPorEquipo = roundTrip ? 2 * (numTeams - 1) : (numTeams - 1);
    
    console.log(`🏆 Total partidos generados: ${matches.length}`);
    console.log(`📊 Jornadas totales: ${totalJornadas}`);
    console.log(`📊 Partidos por equipo: ${partidosPorEquipo}`);
    console.log(`📊 Partidos por jornada: ${Math.floor(numTeams / 2)}`);
    
    return matches;
}


// ==================== DELETE ALL MATCHES ====================

async function initializeDeleteAllMatches() {
    console.log('🗑️ Inicializando botón eliminar todos los partidos...');
    
    const deleteBtn = document.getElementById('deleteAllMatchesBtn');
    if (deleteBtn) {
        deleteBtn.removeEventListener('click', deleteAllMatches);
        deleteBtn.addEventListener('click', deleteAllMatches);
        console.log('✅ Event listener agregado al botón eliminar');
    } else {
        console.log('❌ Botón eliminar no encontrado');
    }
}

async function deleteAllMatches() {
    console.log('🗑️ deleteAllMatches iniciado');
    
    if (!confirm('⚠️ ¿Estás seguro de que quieres eliminar TODOS los partidos? Esta acción no se puede deshacer.')) {
        console.log('❌ Eliminación cancelada por el usuario');
        return;
    }
    
    try {
        showNotification('Eliminando todos los partidos...', 'info');
        
        const response = await fetch('/api/matches/delete-all', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        console.log('📊 Respuesta del servidor:', result);
        
        if (response.ok) {
            showNotification(`${result.deleted} partidos eliminados exitosamente`, 'success');
            await loadMatches(); // Recargar la lista de partidos
        } else {
            showNotification(result.error || 'Error eliminando partidos', 'error');
        }
    } catch (error) {
        console.error('❌ Error eliminando partidos:', error);
        showNotification('Error de conexión eliminando partidos', 'error');
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
    console.log('🎯 DEPURACIÓN: Iniciando loadPendingMatches()');
    const resultsGrid = document.getElementById('resultsGrid');
    console.log('🎯 DEPURACIÓN: resultsGrid encontrado:', !!resultsGrid);
    
    if (!resultsGrid) {
        console.error('❌ DEPURACIÓN: resultsGrid NO encontrado!');
        return;
    }
    
    // Mostrar indicador de carga
    resultsGrid.innerHTML = '<div class="loading">Cargando partidos...</div>';
    console.log('🎯 DEPURACIÓN: Indicador de carga mostrado en results');
    
    try {
        // Cargar TODOS los partidos (programados y finalizados)
        const response = await fetch('/api/matches');
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

    const scheduledMatches = allMatches.filter(match => match.status === 'scheduled');
    const finishedMatches = allMatches.filter(match => match.status === 'finished');

    // Render scheduled matches organized by matchday
    if (scheduledMatches.length > 0) {
        const pendingTitle = document.createElement('h3');
        pendingTitle.innerHTML = '<i class="fas fa-clock"></i> Partidos Pendientes';
        pendingTitle.style.color = '#00ff88';
        pendingTitle.style.marginBottom = '30px';
        pendingTitle.style.fontSize = '24px';
        resultsGrid.appendChild(pendingTitle);

        // Group scheduled matches by matchday
        const matchesByMatchday = {};
        scheduledMatches.forEach(match => {
            const matchday = match.matchday || 1;
            if (!matchesByMatchday[matchday]) {
                matchesByMatchday[matchday] = [];
            }
            matchesByMatchday[matchday].push(match);
        });

        // Sort matchdays numerically
        const sortedMatchdays = Object.keys(matchesByMatchday).sort((a, b) => parseInt(a) - parseInt(b));

        sortedMatchdays.forEach(matchday => {
            // Create matchday container
            const matchdayContainer = document.createElement('div');
            matchdayContainer.style.cssText = 'margin: 40px 0; border-top: 2px solid #00ff88; border-bottom: 2px solid #00ff88; padding: 20px 0;';

            // Create matchday title
            const matchdayTitle = document.createElement('h3');
            matchdayTitle.innerHTML = 'JORNADA ' + matchday;
            matchdayTitle.style.cssText = 'color: #00ff88; text-align: center; margin: 0 0 25px 0; font-size: 24px; font-weight: bold;';
            matchdayContainer.appendChild(matchdayTitle);

            // Create matches grid for this matchday
            const matchdayGrid = document.createElement('div');
            matchdayGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 15px;';

            matchesByMatchday[matchday].forEach(match => {
                const matchCard = document.createElement('div');
                matchCard.className = 'match-card';
                matchCard.innerHTML = `
                    <div class="match-info">
                        <h4>${match.homeTeam} vs ${match.awayTeam}</h4>
                        <p><i class="fas fa-calendar"></i> ${match.date || '2024-01-01'}T${match.time || '00:00:00.000Z'} - undefined</p>
                        <p><i class="fas fa-info-circle"></i> Programado</p>
                        <div style="display: flex; align-items: center; gap: 10px; margin-top: 15px;">
                            <span style="color: #00ff88; font-weight: bold;">${match.homeTeam}:</span>
                            <input type="number" id="homeScore_${match._id}" min="0" max="99" 
                                   style="width: 60px; padding: 5px; border: 1px solid #00ff88; border-radius: 4px; background: rgba(255,255,255,0.1); color: white; text-align: center;" 
                                   placeholder="0">
                            <span style="color: white; font-weight: bold;">-</span>
                            <input type="number" id="awayScore_${match._id}" min="0" max="99" 
                                   style="width: 60px; padding: 5px; border: 1px solid #00ff88; border-radius: 4px; background: rgba(255,255,255,0.1); color: white; text-align: center;" 
                                   placeholder="0">
                            <span style="color: #00ff88; font-weight: bold;">${match.awayTeam}</span>
                        </div>
                    </div>
                    <div class="match-actions">
                        <button class="btn btn-primary" onclick="updateMatchResult('${match._id}')">
                            <i class="fas fa-save"></i> Guardar Resultado
                        </button>
                    </div>
                `;
                matchdayGrid.appendChild(matchCard);
            });

            matchdayContainer.appendChild(matchdayGrid);
            resultsGrid.appendChild(matchdayContainer);
        });
    }

    // Render finished matches organized by matchday
    if (finishedMatches.length > 0) {
        const finishedTitle = document.createElement('h3');
        finishedTitle.innerHTML = '<i class="fas fa-check-circle"></i> Partidos Finalizados';
        finishedTitle.style.color = '#00ff88';
        finishedTitle.style.marginTop = '40px';
        finishedTitle.style.marginBottom = '30px';
        finishedTitle.style.fontSize = '24px';
        resultsGrid.appendChild(finishedTitle);

        // Group finished matches by matchday
        const finishedByMatchday = {};
        finishedMatches.forEach(match => {
            const matchday = match.matchday || 1;
            if (!finishedByMatchday[matchday]) {
                finishedByMatchday[matchday] = [];
            }
            finishedByMatchday[matchday].push(match);
        });

        // Sort matchdays numerically
        const sortedFinishedMatchdays = Object.keys(finishedByMatchday).sort((a, b) => parseInt(a) - parseInt(b));

        sortedFinishedMatchdays.forEach(matchday => {
            // Create matchday container
            const matchdayContainer = document.createElement('div');
            matchdayContainer.style.cssText = 'margin: 40px 0; border-top: 2px solid #28a745; border-bottom: 2px solid #28a745; padding: 20px 0;';

            // Create matchday title
            const matchdayTitle = document.createElement('h3');
            matchdayTitle.innerHTML = 'JORNADA ' + matchday + ' - FINALIZADA';
            matchdayTitle.style.cssText = 'color: #28a745; text-align: center; margin: 0 0 25px 0; font-size: 24px; font-weight: bold;';
            matchdayContainer.appendChild(matchdayTitle);

            // Create matches grid for this matchday
            const matchdayGrid = document.createElement('div');
            matchdayGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 15px;';

            finishedByMatchday[matchday].forEach(match => {
                const matchCard = document.createElement('div');
                matchCard.className = 'match-card';
                matchCard.innerHTML = `
                    <div class="match-info">
                        <h4>${match.homeTeam} ${match.homeScore || 0} - ${match.awayScore || 0} ${match.awayTeam}</h4>
                        <p><i class="fas fa-calendar"></i> ${match.date || '2024-01-01'}T${match.time || '00:00:00.000Z'} - undefined</p>
                        <p><i class="fas fa-check-circle"></i> Finalizado</p>
                        <div style="display: flex; align-items: center; gap: 10px; margin-top: 15px;">
                            <span style="color: #28a745; font-weight: bold;">${match.homeTeam}:</span>
                            <input type="number" id="homeScore_${match._id}" min="0" max="99" value="${match.homeScore || 0}"
                                   style="width: 60px; padding: 5px; border: 1px solid #28a745; border-radius: 4px; background: rgba(255,255,255,0.1); color: white; text-align: center;">
                            <span style="color: white; font-weight: bold;">-</span>
                            <input type="number" id="awayScore_${match._id}" min="0" max="99" value="${match.awayScore || 0}"
                                   style="width: 60px; padding: 5px; border: 1px solid #28a745; border-radius: 4px; background: rgba(255,255,255,0.1); color: white; text-align: center;">
                            <span style="color: #28a745; font-weight: bold;">${match.awayTeam}</span>
                        </div>
                    </div>
                    <div class="match-actions">
                        <button class="btn btn-secondary" onclick="updateMatchResult('${match._id}')" style="margin-right: 10px;">
                            <i class="fas fa-edit"></i> Editar Resultado
                        </button>
                        <button class="btn btn-danger" onclick="removeMatchResult('${match._id}')" style="background: #dc3545; border: none; padding: 8px 16px; border-radius: 4px; color: white; cursor: pointer;">
                            <i class="fas fa-trash"></i> Eliminar Resultado
                        </button>
                    </div>
                `;
                matchdayGrid.appendChild(matchCard);
            });

            matchdayContainer.appendChild(matchdayGrid);
            resultsGrid.appendChild(matchdayContainer);
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
        const response = await fetch(`/api/matches/${matchId}`, {
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

// Función para eliminar resultado de un partido
async function removeMatchResult(matchId) {
    if (!confirm('¿Estás seguro de que quieres eliminar el resultado de este partido?\n\nEl partido volverá al estado "Programado".')) {
        return;
    }

    try {
        const response = await fetch(`/api/matches/${matchId}`, {
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
            loadPendingMatches();
        } else {
            showNotification(result.error || 'Error eliminando resultado', 'error');
        }
    } catch (error) {
        console.error('Error removing match result:', error);
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
        const response = await fetch(`/api/matches/${matchId}`, {
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
// (Sistema de zonas de clasificación eliminado)

async function loadConfiguration() {
    try {
        console.log('🔧 Cargando configuración desde MongoDB...');
        
        // Cargar configuraciones del endpoint general
        const settingsResponse = await fetch('/api/settings');
        if (settingsResponse.ok) {
            const settings = await settingsResponse.json();
            
            // Cargar configuraciones del torneo
            document.getElementById('seasonName').value = settings.seasonName || 'Temporada 2025';
            document.getElementById('playoffFormat').value = settings.playoffFormat || '8';
        }
        
    } catch (error) {
        console.error('❌ Error loading configuration:', error);
    }
}

// Función de renderizado de zonas eliminada

// Función de agregar zona eliminada

// Función de limpiar zonas eliminada

// Función de actualizar zona eliminada

// Función de remover zona eliminada

// Función helper de zonas eliminada

// Función de guardar configuración de tabla eliminada

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

// ==================== PLAYOFFS MANAGEMENT ====================

async function loadPlayoffsManagement() {
    console.log('🏆 Cargando gestión de playoffs...');
    
    try {
        // Cargar equipos para selección
        await loadTeamsForSelection();
        
        // Cargar bracket actual si existe
        await loadCurrentBracket();
        
        console.log('✅ Gestión de playoffs cargada correctamente');
    } catch (error) {
        console.error('❌ Error cargando playoffs:', error);
        showNotification('Error cargando playoffs: ' + error.message, 'error');
    }
}

async function loadTeamsForSelection() {
    const teamSelection = document.getElementById('teamSelection');
    if (!teamSelection) {
        console.warn('⚠️ Elemento teamSelection no encontrado');
        return;
    }
    
    try {
        console.log('🏆 Cargando equipos para selección de playoffs...');
        
        // Obtener equipos desde la API
        const response = await fetch('/api/teams');
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const teams = await response.json();
        console.log('✅ Equipos cargados:', teams.length);
        
        // Limpiar contenedor
        teamSelection.innerHTML = '';
        
        // Crear checkboxes para cada equipo
        teams.forEach(team => {
            const teamCheckbox = document.createElement('div');
            teamCheckbox.innerHTML = `
                <label style="display: flex; align-items: center; color: white; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px; margin-bottom: 5px;">
                    <input type="checkbox" value="${team.name}" data-team-id="${team._id}" style="margin-right: 10px; transform: scale(1.2);">
                    <i class="fas fa-shield-alt" style="margin-right: 8px; color: #00ff88;"></i>
                    ${team.name}
                </label>
            `;
            teamSelection.appendChild(teamCheckbox);
        });
        
        console.log('✅ Checkboxes de equipos creados');
        
    } catch (error) {
        console.error('❌ Error cargando equipos para playoffs:', error);
        teamSelection.innerHTML = '<p style="color: #ff4757; text-align: center;">Error cargando equipos</p>';
    }
}

async function loadCurrentBracket() {
    const bracketContainer = document.getElementById('bracketContainer');
    if (!bracketContainer) {
        console.warn('⚠️ Elemento bracketContainer no encontrado');
        return;
    }
    
    try {
        console.log('🏆 Cargando bracket actual...');
        
        const response = await fetch('/api/playoffs/bracket');
        
        if (response.status === 404) {
            // No hay bracket generado
            bracketContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.6);">
                    <i class="fas fa-trophy" style="font-size: 48px; margin-bottom: 20px; color: rgba(255,255,255,0.3);"></i>
                    <h3>No hay bracket generado</h3>
                    <p>Usa los botones de arriba para crear un bracket de playoffs</p>
                </div>
            `;
            console.log('⚠️ No hay bracket generado');
            return;
        }
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const bracket = data.bracket || data;
        
        console.log('✅ Bracket cargado:', bracket);
        
        // Renderizar bracket
        renderBracket(bracket);
        
    } catch (error) {
        console.error('❌ Error cargando bracket:', error);
        bracketContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ff4757;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                <h3>Error cargando bracket</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function renderBracket(bracket) {
    const bracketContainer = document.getElementById('bracketContainer');
    if (!bracketContainer) return;
    
    console.log('🏆 Renderizando bracket:', bracket.format, 'equipos, ida y vuelta:', bracket.isRoundTrip);
    
    let html = `
        <div style="background: rgba(0,255,136,0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(0,255,136,0.3);">
            <h4 style="color: #00ff88; margin: 0 0 10px 0;">
                <i class="fas fa-info-circle"></i> Información del Bracket
            </h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <strong>Formato:</strong> ${bracket.format} equipos
                </div>
                <div>
                    <strong>Modalidad:</strong> ${bracket.isRoundTrip ? '🔄 Ida y Vuelta' : '⚡ Partido Único'}
                </div>
                <div>
                    <strong>Partidos:</strong> ${bracket.matches ? bracket.matches.length : 0}
                </div>
                <div>
                    <strong>Estado:</strong> <span style="color: #00ff88;">Activo</span>
                </div>
            </div>
        </div>
    `;
    
    if (bracket.matches && bracket.matches.length > 0) {
        html += '<div style="display: grid; gap: 15px;">';
        
        if (bracket.isRoundTrip) {
            // Para ida y vuelta, agrupar partidos por enfrentamiento
            const matchups = {};
            
            bracket.matches.forEach(match => {
                const key = `${match.homeTeam}_vs_${match.awayTeam}_R${match.round}`;
                if (!matchups[key]) {
                    matchups[key] = {
                        round: match.round,
                        homeTeam: match.homeTeam,
                        awayTeam: match.awayTeam,
                        ida: null,
                        vuelta: null
                    };
                }
                
                if (match.legNumber === 1) {
                    matchups[key].ida = match;
                } else {
                    matchups[key].vuelta = match;
                }
            });
            
            // Renderizar cada enfrentamiento con ida y vuelta
            Object.values(matchups).forEach(matchup => {
                const roundName = getRoundDisplayName(matchup.round, bracket.format);
                const idaFinished = matchup.ida && matchup.ida.status === 'finished';
                const vueltaFinished = matchup.vuelta && matchup.vuelta.status === 'finished';
                const bothFinished = idaFinished && vueltaFinished;
                
                html += `
                    <div style="background: rgba(255,255,255,0.05); border: 2px solid ${bothFinished ? '#00ff88' : 'rgba(0,255,136,0.3)'}; border-radius: 10px; padding: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h5 style="color: #00ff88; margin: 0;">${roundName}</h5>
                            <span style="background: ${bothFinished ? '#00ff88' : '#ffa502'}; color: ${bothFinished ? '#0a0a0a' : 'white'}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                ${bothFinished ? 'Completado' : 'En Progreso'}
                            </span>
                        </div>
                        
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <i class="fas fa-shield-alt" style="margin-right: 8px; color: #00ff88;"></i>
                            <strong style="font-size: 16px;">${matchup.homeTeam} vs ${matchup.awayTeam}</strong>
                        </div>
                        
                        <!-- PARTIDO DE IDA -->
                        <div style="background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.2); border-radius: 6px; padding: 12px; margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <h6 style="color: #00ff88; margin: 0; font-size: 14px;">
                                    <i class="fas fa-play"></i> PARTIDO DE IDA
                                </h6>
                                <span style="font-size: 12px; color: rgba(255,255,255,0.6);">
                                    ${idaFinished ? 'Terminado' : 'Programado'}
                                </span>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <div style="display: flex; align-items: center; margin-bottom: 3px;">
                                        <i class="fas fa-home" style="margin-right: 8px; color: #00ff88; font-size: 12px;"></i>
                                        <span>${matchup.homeTeam}</span>
                                        ${idaFinished ? `<span style="margin-left: 10px; font-weight: bold; color: #00ff88;">${matchup.ida.homeScore}</span>` : ''}
                                    </div>
                                    <div style="display: flex; align-items: center;">
                                        <i class="fas fa-plane" style="margin-right: 8px; color: rgba(255,255,255,0.6); font-size: 12px;"></i>
                                        <span>${matchup.awayTeam}</span>
                                        ${idaFinished ? `<span style="margin-left: 10px; font-weight: bold; color: #00ff88;">${matchup.ida.awayScore}</span>` : ''}
                                    </div>
                                </div>
                                
                                ${!idaFinished && matchup.ida ? `
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <input type="number" id="homeScore_${matchup.ida.id}" placeholder="0" min="0" style="width: 45px; padding: 4px; text-align: center; background: rgba(255,255,255,0.1); border: 1px solid rgba(0,255,136,0.3); border-radius: 3px; color: white; font-size: 12px;">
                                        <span style="color: rgba(255,255,255,0.6); font-size: 12px;">-</span>
                                        <input type="number" id="awayScore_${matchup.ida.id}" placeholder="0" min="0" style="width: 45px; padding: 4px; text-align: center; background: rgba(255,255,255,0.1); border: 1px solid rgba(0,255,136,0.3); border-radius: 3px; color: white; font-size: 12px;">
                                        <button onclick="updatePlayoffMatch('${matchup.ida.id}')" style="background: #00ff88; color: #0a0a0a; border: none; padding: 6px 8px; border-radius: 3px; cursor: pointer; font-weight: 600; font-size: 11px;">
                                            <i class="fas fa-check"></i>
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        <!-- PARTIDO DE VUELTA -->
                        <div style="background: rgba(255,165,0,0.05); border: 1px solid rgba(255,165,0,0.2); border-radius: 6px; padding: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <h6 style="color: #ffa502; margin: 0; font-size: 14px;">
                                    <i class="fas fa-undo"></i> PARTIDO DE VUELTA
                                </h6>
                                <span style="font-size: 12px; color: rgba(255,255,255,0.6);">
                                    ${vueltaFinished ? 'Terminado' : 'Programado'}
                                </span>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <div style="display: flex; align-items: center; margin-bottom: 3px;">
                                        <i class="fas fa-home" style="margin-right: 8px; color: #ffa502; font-size: 12px;"></i>
                                        <span>${matchup.awayTeam}</span>
                                        ${vueltaFinished ? `<span style="margin-left: 10px; font-weight: bold; color: #ffa502;">${matchup.vuelta.homeScore}</span>` : ''}
                                    </div>
                                    <div style="display: flex; align-items: center;">
                                        <i class="fas fa-plane" style="margin-right: 8px; color: rgba(255,255,255,0.6); font-size: 12px;"></i>
                                        <span>${matchup.homeTeam}</span>
                                        ${vueltaFinished ? `<span style="margin-left: 10px; font-weight: bold; color: #ffa502;">${matchup.vuelta.awayScore}</span>` : ''}
                                    </div>
                                </div>
                                
                                ${!vueltaFinished && matchup.vuelta ? `
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <input type="number" id="homeScore_${matchup.vuelta.id}" placeholder="0" min="0" style="width: 45px; padding: 4px; text-align: center; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,165,0,0.3); border-radius: 3px; color: white; font-size: 12px;">
                                        <span style="color: rgba(255,255,255,0.6); font-size: 12px;">-</span>
                                        <input type="number" id="awayScore_${matchup.vuelta.id}" placeholder="0" min="0" style="width: 45px; padding: 4px; text-align: center; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,165,0,0.3); border-radius: 3px; color: white; font-size: 12px;">
                                        <button onclick="updatePlayoffMatch('${matchup.vuelta.id}')" style="background: #ffa502; color: #0a0a0a; border: none; padding: 6px 8px; border-radius: 3px; cursor: pointer; font-weight: 600; font-size: 11px;">
                                            <i class="fas fa-check"></i>
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        ${bothFinished ? `
                            <div style="margin-top: 10px; padding: 8px; background: rgba(0,255,136,0.1); border-radius: 4px; text-align: center;">
                                <span style="color: #00ff88; font-weight: bold; font-size: 12px;">
                                    <i class="fas fa-calculator"></i> 
                                    Resultado Global: ${matchup.homeTeam} ${(matchup.ida.homeScore + matchup.vuelta.awayScore)} - ${(matchup.ida.awayScore + matchup.vuelta.homeScore)} ${matchup.awayTeam}
                                </span>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            
        } else {
            // Para partido único, renderizado normal
            bracket.matches.forEach((match, index) => {
                const isFinished = match.status === 'finished';
                const roundName = getRoundDisplayName(match.round, bracket.format);
                
                html += `
                    <div style="background: rgba(255,255,255,0.05); border: 2px solid ${isFinished ? '#00ff88' : 'rgba(0,255,136,0.3)'}; border-radius: 10px; padding: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h5 style="color: #00ff88; margin: 0;">${roundName}</h5>
                            <span style="background: ${isFinished ? '#00ff88' : '#ffa502'}; color: ${isFinished ? '#0a0a0a' : 'white'}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                ${isFinished ? 'Terminado' : 'Programado'}
                            </span>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                                    <i class="fas fa-home" style="margin-right: 8px; color: #00ff88;"></i>
                                    <strong>${match.homeTeam}</strong>
                                    ${isFinished ? `<span style="margin-left: 10px; font-size: 18px; color: #00ff88;">${match.homeScore}</span>` : ''}
                                </div>
                                <div style="display: flex; align-items: center;">
                                    <i class="fas fa-plane" style="margin-right: 8px; color: rgba(255,255,255,0.6);"></i>
                                    <strong>${match.awayTeam}</strong>
                                    ${isFinished ? `<span style="margin-left: 10px; font-size: 18px; color: #00ff88;">${match.awayScore}</span>` : ''}
                                </div>
                            </div>
                            
                            ${!isFinished ? `
                                <div style="display: flex; gap: 10px; align-items: center;">
                                    <input type="number" id="homeScore_${match.id}" placeholder="0" min="0" style="width: 50px; padding: 5px; text-align: center; background: rgba(255,255,255,0.1); border: 1px solid rgba(0,255,136,0.3); border-radius: 4px; color: white;">
                                    <span style="color: rgba(255,255,255,0.6);">-</span>
                                    <input type="number" id="awayScore_${match.id}" placeholder="0" min="0" style="width: 50px; padding: 5px; text-align: center; background: rgba(255,255,255,0.1); border: 1px solid rgba(0,255,136,0.3); border-radius: 4px; color: white;">
                                    <button onclick="updatePlayoffMatch('${match.id}')" style="background: #00ff88; color: #0a0a0a; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;">
                                        <i class="fas fa-check"></i> Actualizar
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                        
                        ${match.date ? `<div style="margin-top: 10px; color: rgba(255,255,255,0.6); font-size: 14px;"><i class="fas fa-calendar"></i> ${new Date(match.date).toLocaleDateString()}</div>` : ''}
                    </div>
                `;
            });
        }
        
        html += '</div>';
    } else {
        html += '<p style="text-align: center; color: rgba(255,255,255,0.6);">No hay partidos generados</p>';
    }
    
    bracketContainer.innerHTML = html;
}

function getRoundDisplayName(round, format) {
    const numTeams = parseInt(format);
    const roundNum = parseInt(round);
    
    if (numTeams === 4) {
        return roundNum === 1 ? 'Semifinal' : 'Final';
    } else if (numTeams === 8) {
        if (roundNum === 1) return 'Cuartos de Final';
        if (roundNum === 2) return 'Semifinal';
        return 'Final';
    } else if (numTeams === 16) {
        if (roundNum === 1) return 'Octavos de Final';
        if (roundNum === 2) return 'Cuartos de Final';
        if (roundNum === 3) return 'Semifinal';
        return 'Final';
    }
    
    return `Ronda ${roundNum}`;
}

function showManualSelection() {
    const manualSelection = document.getElementById('manualSelection');
    if (manualSelection) {
        const isVisible = manualSelection.style.display !== 'none';
        manualSelection.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            // Cargar equipos si se muestra la selección manual
            loadTeamsForSelection();
        }
    }
}

async function generateBracket(format) {
    console.log(`🏆 Generando bracket automático para ${format} equipos...`);
    
    try {
        const isRoundTrip = document.getElementById('roundTripCheckbox')?.checked || false;
        
        const response = await fetch('/api/playoffs/bracket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                format: format,
                isRoundTrip: isRoundTrip,
                type: 'automatic'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Bracket generado:', data);
        
        showNotification(`Bracket de ${format} equipos generado correctamente${isRoundTrip ? ' (ida y vuelta)' : ''}`, 'success');
        
        // Recargar bracket
        await loadCurrentBracket();
        
    } catch (error) {
        console.error('❌ Error generando bracket:', error);
        showNotification('Error generando bracket: ' + error.message, 'error');
    }
}

async function createCustomBracket() {
    console.log('🏆 Creando bracket personalizado...');
    
    try {
        // Obtener equipos seleccionados
        const selectedTeams = [];
        const checkboxes = document.querySelectorAll('#teamSelection input[type="checkbox"]:checked');
        
        checkboxes.forEach(checkbox => {
            selectedTeams.push({
                name: checkbox.value,
                id: checkbox.dataset.teamId
            });
        });
        
        if (selectedTeams.length === 0) {
            throw new Error('Debes seleccionar al menos un equipo');
        }
        
        // Validar formato
        const validFormats = [4, 8, 16];
        if (!validFormats.includes(selectedTeams.length)) {
            throw new Error(`Número de equipos inválido: ${selectedTeams.length}. Debe ser 4, 8 o 16 equipos.`);
        }
        
        const isRoundTrip = document.getElementById('roundTripCheckbox')?.checked || false;
        
        const response = await fetch('/api/playoffs/bracket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                format: selectedTeams.length,
                teams: selectedTeams,
                isRoundTrip: isRoundTrip,
                type: 'custom'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Bracket personalizado creado:', data);
        
        showNotification(`Bracket personalizado de ${selectedTeams.length} equipos creado correctamente${isRoundTrip ? ' (ida y vuelta)' : ''}`, 'success');
        
        // Ocultar selección manual
        const manualSelection = document.getElementById('manualSelection');
        if (manualSelection) {
            manualSelection.style.display = 'none';
        }
        
        // Recargar bracket
        await loadCurrentBracket();
        
    } catch (error) {
        console.error('❌ Error creando bracket personalizado:', error);
        showNotification('Error creando bracket personalizado: ' + error.message, 'error');
    }
}

async function updatePlayoffMatch(matchId) {
    console.log(`🏆 Actualizando resultado del partido: ${matchId}`);
    
    try {
        const homeScoreInput = document.getElementById(`homeScore_${matchId}`);
        const awayScoreInput = document.getElementById(`awayScore_${matchId}`);
        
        if (!homeScoreInput || !awayScoreInput) {
            throw new Error('No se encontraron los campos de resultado');
        }
        
        const homeScore = parseInt(homeScoreInput.value) || 0;
        const awayScore = parseInt(awayScoreInput.value) || 0;
        
        if (homeScore < 0 || awayScore < 0) {
            throw new Error('Los resultados no pueden ser negativos');
        }
        
        const response = await fetch(`/api/playoffs/bracket/match/${matchId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                homeScore: homeScore,
                awayScore: awayScore
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Error ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Resultado actualizado:', data);
        
        showNotification('Resultado actualizado correctamente', 'success');
        
        // Recargar bracket para mostrar cambios
        await loadCurrentBracket();
        
    } catch (error) {
        console.error('❌ Error actualizando resultado:', error);
        showNotification('Error actualizando resultado: ' + error.message, 'error');
    }
}

// Exponer funciones globalmente
window.loadPlayoffsManagement = loadPlayoffsManagement;
window.showManualSelection = showManualSelection;
window.generateBracket = generateBracket;
window.createCustomBracket = createCustomBracket;
window.updatePlayoffMatch = updatePlayoffMatch;
window.loadCurrentBracket = loadCurrentBracket;

console.log('✅ Funciones de playoffs expuestas globalmente');

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
    
    // Obtener opción de ida y vuelta
    const roundTripCheckbox = document.getElementById('roundTripOption');
    const isRoundTrip = roundTripCheckbox ? roundTripCheckbox.checked : false;
    
    try {
        // Obtener equipos disponibles (usar /api/teams que sí existe)
        const response = await fetch('/api/teams');
        if (!response.ok) throw new Error('Error fetching teams');
        
        const teams = await response.json();
        
        console.log('🏆 Equipos obtenidos para bracket:', teams);
        console.log('🔄 Modalidad ida y vuelta:', isRoundTrip ? 'Sí' : 'No');
        
        // Tomar los primeros N equipos según el formato
        const qualifiedTeams = teams.slice(0, numTeams);
        
        if (qualifiedTeams.length < numTeams) {
            showNotification(`Se necesitan al menos ${numTeams} equipos registrados. Tienes ${qualifiedTeams.length}, necesitas ${numTeams}`, 'error');
            return;
        }
        
        console.log('🎯 Equipos clasificados para bracket:', qualifiedTeams);
        
        await createBracket(qualifiedTeams, format, isRoundTrip);
        
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
    const usedPositions = new Set();
    
    for (let i = 0; i < numMatches; i++) {
        const homePos = parseInt(document.getElementById(`home_${i}`).value);
        const awayPos = parseInt(document.getElementById(`away_${i}`).value);
        
        console.log(`🎯 Partido ${i + 1}: Posición local=${homePos}, Posición visitante=${awayPos}`);
        
        if (isNaN(homePos) || isNaN(awayPos) || homePos < 1 || homePos > numTeams || awayPos < 1 || awayPos > numTeams) {
            throw new Error(`Partido ${i + 1}: Posiciones inválidas. Deben ser números entre 1 y ${numTeams}`);
        }
        
        if (homePos === awayPos) {
            throw new Error(`Partido ${i + 1}: Un equipo no puede jugar contra sí mismo`);
        }
        
        // Verificar duplicados usando las posiciones originales
        if (usedPositions.has(homePos)) {
            throw new Error(`El equipo en posición ${homePos} aparece más de una vez`);
        }
        if (usedPositions.has(awayPos)) {
            throw new Error(`El equipo en posición ${awayPos} aparece más de una vez`);
        }
        
        usedPositions.add(homePos);
        usedPositions.add(awayPos);
        
        customPairings.push({
            home: teams[homePos - 1], // -1 porque los arrays empiezan en 0
            away: teams[awayPos - 1],
            homePos: homePos,
            awayPos: awayPos
        });
    }
    
    console.log('✅ Emparejamientos personalizados creados:', customPairings);
    console.log('✅ Posiciones usadas:', Array.from(usedPositions).sort((a, b) => a - b));
    return customPairings;
}

// Función para crear bracket con emparejamientos personalizados
async function createCustomBracket() {
    const format = document.getElementById('bracketFormat').value;
    const numTeams = parseInt(format);
    
    // Obtener opción de ida y vuelta
    const roundTripCheckbox = document.getElementById('roundTripOption');
    const isRoundTrip = roundTripCheckbox ? roundTripCheckbox.checked : false;
    
    try {
        // Obtener equipos ordenados por posición en la tabla de posiciones
        const standingsResponse = await fetch('/api/standings');
        if (!standingsResponse.ok) {
            showNotification('Error obteniendo tabla de posiciones', 'error');
            return;
        }
        
        const standings = await standingsResponse.json();
        console.log('🏆 Tabla de posiciones obtenida:', standings);
        
        // Ordenar por posición y tomar solo los primeros N equipos
        const sortedStandings = standings.sort((a, b) => {
            // Ordenar por puntos (descendente), luego por diferencia de goles (descendente)
            if (b.points !== a.points) return b.points - a.points;
            return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
        });
        
        // Extraer equipos en orden de posición
        const qualifiedTeams = sortedStandings.slice(0, parseInt(format)).map(standing => ({
            name: standing.team || standing.teamName,
            _id: standing.teamId || standing._id
        }));
        
        console.log('🏆 Equipos calificados en orden de posición:', qualifiedTeams);
        
        if (qualifiedTeams.length < numTeams) {
            showNotification(`Se necesitan al menos ${numTeams} equipos registrados. Tienes ${qualifiedTeams.length}, necesitas ${numTeams}`, 'error');
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
        
        // Enviar datos en el formato que espera el backend
        const requestData = {
            format: format,
            selectedTeams: qualifiedTeams,  // Backend espera "selectedTeams"
            customPairings: customPairings,  // Incluir emparejamientos personalizados
            isRoundTrip: isRoundTrip  // Incluir opción de ida y vuelta
        };
        
        console.log('🎯 Enviando bracket personalizado al backend:', requestData);
        console.log('🔄 Modalidad ida y vuelta:', isRoundTrip ? 'Sí' : 'No');
        
        const bracketResponse = await fetch('/api/playoffs/bracket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (bracketResponse.ok) {
            const result = await bracketResponse.json();
            const bracket = result.bracket;
            
            console.log('✅ Bracket personalizado creado exitosamente:', bracket);
            
            currentBracket = bracket;
            renderBracket(bracket);
            showNotification('Bracket personalizado creado exitosamente', 'success');
            
            // Ocultar selección manual
            document.getElementById('manualSelection').style.display = 'none';
            document.getElementById('customPairings').style.display = 'none';
        } else {
            const errorData = await bracketResponse.json();
            console.error('❌ Error del servidor:', errorData);
            showNotification(`Error creando bracket personalizado: ${errorData.error || 'Error desconocido'}`, 'error');
        }
        
    } catch (error) {
        console.error('Error creating custom bracket:', error);
        showNotification('Error generando bracket personalizado', 'error');
    }
}

async function createBracket(teams, format, isRoundTrip = false) {
    // Enviar datos en el formato que espera el backend
    const requestData = {
        format: format,
        selectedTeams: teams,  // Backend espera "selectedTeams", no "teams"
        isRoundTrip: isRoundTrip  // Incluir opción de ida y vuelta
    };
    
    console.log('🏆 Enviando datos al backend:', requestData);
    console.log('🔄 Modalidad ida y vuelta:', isRoundTrip ? 'Sí' : 'No');
    
    try {
        const response = await fetch('/api/playoffs/bracket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (response.ok) {
            const result = await response.json();
            const bracket = result.bracket;
            
            console.log('✅ Bracket creado exitosamente:', bracket);
            
            currentBracket = bracket;
            renderBracket(bracket);
            showNotification('Bracket creado exitosamente', 'success');
            
            // Ocultar selección manual
            document.getElementById('manualSelection').style.display = 'none';
        } else {
            const errorData = await response.json();
            console.error('❌ Error del servidor:', errorData);
            showNotification(`Error creando bracket: ${errorData.error || 'Error desconocido'}`, 'error');
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
    const numTeams = parseInt(format);
    
    // Lógica corregida para nomenclatura correcta
    if (numTeams === 4) {
        switch (roundNum) {
            case 1: return 'Semifinales';
            case 2: return 'Final';
            default: return `Ronda ${roundNum}`;
        }
    } else if (numTeams === 8) {
        switch (roundNum) {
            case 1: return 'Cuartos de Final';
            case 2: return 'Semifinales';
            case 3: return 'Final';
            default: return `Ronda ${roundNum}`;
        }
    } else if (numTeams === 16) {
        switch (roundNum) {
            case 1: return 'Octavos de Final';
            case 2: return 'Cuartos de Final';
            case 3: return 'Semifinales';
            case 4: return 'Final';
            default: return `Ronda ${roundNum}`;
        }
    }
    
    // Fallback para otros formatos
    const totalRounds = Math.log2(numTeams);
    if (roundNum === totalRounds) return 'Final';
    if (roundNum === totalRounds - 1) return 'Semifinales';
    if (roundNum === totalRounds - 2) return 'Cuartos de Final';
    if (roundNum === totalRounds - 3) return 'Octavos de Final';
    
    return `Ronda ${roundNum}`;
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
        
        // Encontrar el jugador en el array local usando _id o id
        let playerIndex = players.findIndex(p => {
            const playerIdToCompare = p._id || p.id;
            return playerIdToCompare === playerId || playerIdToCompare == playerId;
        });
        
        if (playerIndex === -1) {
            console.error('❌ Jugador no encontrado con ID:', playerId);
            console.error('❌ IDs disponibles:', players.map(p => ({ id: p._id || p.id, name: p.name })));
            showNotification('Jugador no encontrado', 'error');
            return;
        }
        
        console.log('✅ Jugador encontrado:', players[playerIndex].name, 'en índice', playerIndex);
        
        // Actualizar localmente primero para respuesta rápida
        const oldValue = players[playerIndex][statType] || 0;
        players[playerIndex][statType] = numValue;
        
        // Actualizar en el backend - solo enviar el campo específico
        const updateData = {
            [statType]: numValue
        };
        
        console.log('📤 Enviando actualización al backend:', updateData);
        
        const response = await fetch(`/api/players/${playerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            const responseData = await response.json();
            const updatedPlayer = responseData.player || responseData;
            players[playerIndex] = updatedPlayer;
            
            console.log('✅ Respuesta del backend:', responseData);
            console.log('🔄 Jugador actualizado:', updatedPlayer);
            
            // Actualizar también el array de teamPlayers si es necesario
            const teamPlayerIndex = teamPlayers.findIndex(p => {
                const playerIdToCompare = p._id || p.id;
                return playerIdToCompare === playerId || playerIdToCompare == playerId;
            });
            if (teamPlayerIndex !== -1) {
                teamPlayers[teamPlayerIndex] = updatedPlayer.player || updatedPlayer;
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
        const playerIndex = players.findIndex(p => {
            const playerIdToCompare = p._id || p.id;
            return playerIdToCompare === playerId || playerIdToCompare == playerId;
        });
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
// window.deleteTeam ya está definido al inicio del archivo
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
// window.updateZone = updateZone; // Function removed
// window.removeZone = removeZone; // Function removed
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

// Función para editar equipo
function editTeam(teamId) {
    console.log('🔧 Editando equipo:', teamId);
    
    const team = teams.find(t => (t._id || t.id) === teamId);
    if (!team) {
        showNotification('Equipo no encontrado', 'error');
        return;
    }

    // Crear modal de edición
    const modal = document.createElement('div');
    modal.id = 'editTeamModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    modal.innerHTML = `
        <div style="
            background: #1a1a1a;
            border: 2px solid #00ff88;
            border-radius: 15px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0, 255, 136, 0.3);
        ">
            <h2 style="color: #00ff88; margin: 0 0 25px 0; text-align: center;">
                <i class="fas fa-edit"></i> Editar Equipo
            </h2>
            
            <div style="margin-bottom: 20px;">
                <label style="color: white; display: block; margin-bottom: 8px; font-weight: bold;">
                    <i class="fas fa-tag"></i> Nombre del Equipo:
                </label>
                <input type="text" id="editTeamName" value="${team.name}" style="
                    width: 100%;
                    padding: 12px;
                    border: 2px solid rgba(0, 255, 136, 0.3);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    font-size: 16px;
                    outline: none;
                    box-sizing: border-box;
                " placeholder="Ingresa el nombre del equipo">
            </div>

            <div style="margin-bottom: 25px;">
                <label style="color: white; display: block; margin-bottom: 8px; font-weight: bold;">
                    <i class="fas fa-image"></i> Logo del Equipo:
                </label>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="
                        width: 80px;
                        height: 80px;
                        border-radius: 8px;
                        overflow: hidden;
                        background: rgba(0,255,136,0.1);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 2px solid rgba(0, 255, 136, 0.3);
                    ">
                        ${team.logo ? 
                            `<img id="editTeamLogoPreview" src="${team.logo}" alt="Logo" style="width: 100%; height: 100%; object-fit: cover;">` :
                            `<i id="editTeamLogoPreview" class="fas fa-users" style="color: #00ff88; font-size: 32px;"></i>`
                        }
                    </div>
                    <div style="flex: 1;">
                        <input type="file" id="editTeamLogoFile" accept="image/*" style="display: none;">
                        <button onclick="document.getElementById('editTeamLogoFile').click()" style="
                            background: #00ff88;
                            color: #0a0a0a;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: bold;
                            margin-bottom: 10px;
                            width: 100%;
                        ">
                            <i class="fas fa-upload"></i> Cambiar Logo
                        </button>
                        <button onclick="removeTeamLogo()" style="
                            background: #ff4444;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            width: 100%;
                        ">
                            <i class="fas fa-trash"></i> Quitar Logo
                        </button>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 15px; justify-content: center;">
                <button onclick="saveTeamChanges('${teamId}')" style="
                    background: #00ff88;
                    color: #0a0a0a;
                    border: none;
                    padding: 12px 25px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 16px;
                ">
                    <i class="fas fa-save"></i> Guardar Cambios
                </button>
                <button onclick="cancelTeamEdit()" style="
                    background: #666;
                    color: white;
                    border: none;
                    padding: 12px 25px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 16px;
                ">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Agregar event listener para preview del logo
    const fileInput = document.getElementById('editTeamLogoFile');
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.getElementById('editTeamLogoPreview');
                if (preview.tagName === 'IMG') {
                    preview.src = e.target.result;
                } else {
                    // Reemplazar el icono con una imagen
                    preview.outerHTML = `<img id="editTeamLogoPreview" src="${e.target.result}" alt="Logo" style="width: 100%; height: 100%; object-fit: cover;">`;
                }
            };
            reader.readAsDataURL(file);
        }
    });

    // Focus en el input de nombre
    setTimeout(() => {
        document.getElementById('editTeamName').focus();
    }, 100);
}

// Función para guardar cambios del equipo
async function saveTeamChanges(teamId) {
    const nameInput = document.getElementById('editTeamName');
    const fileInput = document.getElementById('editTeamLogoFile');
    
    if (!nameInput) {
        showNotification('Error: No se pudo encontrar el campo de nombre', 'error');
        return;
    }

    const newName = nameInput.value.trim();
    if (!newName) {
        showNotification('El nombre del equipo no puede estar vacío', 'error');
        return;
    }

    try {
        showNotification('Guardando cambios...', 'info');
        
        // Verificar si se debe eliminar el logo
        const preview = document.getElementById('editTeamLogoPreview');
        const shouldRemoveLogo = preview && preview.hasAttribute('data-remove-logo');
        
        // Crear FormData para enviar tanto el nombre como el logo (si existe)
        const formData = new FormData();
        formData.append('name', newName);
        
        // Si hay un archivo seleccionado, agregarlo al FormData
        if (fileInput && fileInput.files[0]) {
            formData.append('logo', fileInput.files[0]);
        } else if (shouldRemoveLogo) {
            // Enviar una cadena vacía para indicar que se debe eliminar el logo
            formData.append('removeLogo', 'true');
        }

        // Actualizar el equipo usando el endpoint existente
        const response = await fetch(`/api/teams/${teamId}`, {
            method: 'PUT',
            body: formData // Usar FormData en lugar de JSON
        });

        if (response.ok) {
            const updatedTeam = await response.json();
            
            // Actualizar el equipo en el array local
            const teamIndex = teams.findIndex(t => (t._id || t.id) === teamId);
            if (teamIndex !== -1) {
                teams[teamIndex] = { ...teams[teamIndex], ...updatedTeam };
            }
            
            showNotification('Equipo actualizado exitosamente', 'success');
            cancelTeamEdit();
            forceRenderTeams();
            loadTeamTabs(); // Actualizar pestañas si el nombre cambió
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Error al actualizar el equipo');
        }
    } catch (error) {
        console.error('Error saving team changes:', error);
        showNotification('Error al guardar cambios: ' + error.message, 'error');
    }
}

// Función para cancelar edición del equipo
function cancelTeamEdit() {
    const modal = document.getElementById('editTeamModal');
    if (modal) {
        modal.remove();
    }
}

// Función para quitar logo del equipo
function removeTeamLogo() {
    const preview = document.getElementById('editTeamLogoPreview');
    if (preview) {
        if (preview.tagName === 'IMG') {
            // Reemplazar imagen con icono y marcar para eliminación
            preview.outerHTML = `<i id="editTeamLogoPreview" class="fas fa-users" style="color: #00ff88; font-size: 32px;" data-remove-logo="true"></i>`;
        }
        
        // Limpiar el input de archivo
        const fileInput = document.getElementById('editTeamLogoFile');
        if (fileInput) {
            fileInput.value = '';
        }
        
        showNotification('Logo removido (se guardará al confirmar cambios)', 'info');
    }
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
// window.deleteTeam ya está definido al inicio del archivo
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



// Sistema de Copa de la Liga eliminado

// Función de Copa eliminada

// Función de grupos eliminada

// Función de eliminatorias eliminada

// Función eliminada

// Referencias a Copa eliminadas

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
        
        // Asegurarse de que el equipo tenga un ID válido
        const teamId = team._id || team.id;
        if (!teamId) {
            console.error(`❌ ERROR: El equipo "${team.name}" no tiene ID válido`, team);
            return; // Saltar este equipo si no tiene ID
        }
        
        console.log(`🆔 Equipo ID: ${teamId}`);
        
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
                <small style="color: rgba(255,255,255,0.5);">ID: ${teamId}</small>
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="window.editTeam('${teamId}')" style="background: linear-gradient(45deg, #3498db, #2980b9); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button onclick="window.deleteTeam('${teamId}', event)" data-team-id="${teamId}" style="background: linear-gradient(45deg, #e74c3c, #c0392b); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">
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

// Función para agregar botones de edición/eliminación a las tarjetas de equipos
function addEditButtonsToTeams() {
    console.log('🔧 INICIANDO: addEditButtonsToTeams');
    
    const teamsGrid = document.getElementById('teamsGrid');
    if (!teamsGrid) {
        console.error('❌ teamsGrid no encontrado');
        return;
    }
    
    console.log('🔧 teamsGrid encontrado:', teamsGrid);
    
    // No necesitamos agregar botones manualmente ya que ya están en el HTML generado
    // Solo verificamos que los botones funcionen correctamente
    
    // Buscar todos los botones de eliminar existentes
    const deleteButtons = document.querySelectorAll('button[onclick^="window.deleteTeam"]');
    console.log('🔍 Botones de eliminar encontrados:', deleteButtons.length);
    
    // Verificar que los botones tengan el ID correcto
    deleteButtons.forEach((btn, index) => {
        const onclickAttr = btn.getAttribute('onclick');
        if (!onclickAttr || !onclickAttr.includes('deleteTeam')) {
            console.warn(`⚠️ Botón ${index} no tiene el manejador correcto`);
            return;
        }
        
        // Extraer el ID del equipo del atributo onclick
        const match = onclickAttr.match(/deleteTeam\('?([^')]*)'?\)/);
        if (!match || !match[1]) {
            console.warn(`⚠️ No se pudo extraer el ID del equipo del botón ${index}`);
            return;
        }
        
        const teamId = match[1];
        console.log(`✅ Botón ${index} vinculado correctamente al equipo ID: ${teamId}`);
    });
    
    console.log('✅ VERIFICACIÓN DE BOTONES COMPLETADA');
}

// Funciones de equipos
window.editTeam = editTeam;
window.saveTeamChanges = saveTeamChanges;
window.cancelTeamEdit = cancelTeamEdit;
window.removeTeamLogo = removeTeamLogo;
// window.deleteTeam ya está definido al inicio del archivo
window.addEditButtonsToTeams = addEditButtonsToTeams;

// Funciones de partidos
window.removeMatchResult = removeMatchResult;

// Función de limpieza de MongoDB
window.cleanupMongoDB = async function() {
    const resultDiv = document.getElementById('cleanupResult');
    const button = event.target;
    
    if (!confirm('⚠️ ¿Estás seguro de que quieres eliminar TODOS los datos de MongoDB Atlas?\n\nEsto incluye: equipos, clubes, jugadores y partidos.\n\nEsta acción NO se puede deshacer.')) {
        return;
    }
    
    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Limpiando...';
        resultDiv.innerHTML = '<span style="color: #ffa502;">🔄 Limpiando MongoDB Atlas...</span>';
        
        const response = await fetch('/api/admin/cleanup/all', { method: 'DELETE' });
        const result = await response.json();
        
        if (response.ok && result.success) {
            resultDiv.innerHTML = `
                <div style="color: #2ed573;">
                    <i class="fas fa-check-circle"></i> <strong>MongoDB Atlas limpiado</strong><br>
                    <small>Total: ${result.details.total} registros eliminados</small>
                </div>
            `;
            
            setTimeout(() => {
                loadTeams();
                loadClubs();
                resultDiv.innerHTML += '<br><span style="color: #00ff88;">Recarga la página (Ctrl+F5) para ver los cambios</span>';
            }, 1000);
            
        } else {
            resultDiv.innerHTML = `<span style="color: #ff4757;"><i class="fas fa-exclamation-triangle"></i> Error: ${result.error || 'Error desconocido'}</span>`;
        }
        
    } catch (error) {
        resultDiv.innerHTML = '<span style="color: #ff4757;"><i class="fas fa-exclamation-triangle"></i> Error de conexión</span>';
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-broom"></i> Limpiar MongoDB Atlas';
    }
};

// Exponer funciones de clubes globalmente
window.editClub = editClub;
window.deleteClub = deleteClub;
window.cancelClubEdit = cancelClubEdit;

// Exponer funciones de jugadores globalmente
window.deletePlayerQuick = deletePlayerQuick;
window.editPlayerQuick = editPlayerQuick;
window.updatePlayerStats = updatePlayerStats;

// ==================== FUNCIONES DE RENDERIZADO PARA TIEMPO REAL ====================

// Función para renderizar clubes automáticamente
function renderClubs() {
    console.log('🏢 RENDERIZANDO CLUBES EN TIEMPO REAL...');
    const clubsGrid = document.getElementById('clubsGrid');
    if (!clubsGrid) {
        console.warn('⚠️ clubsGrid no encontrado');
        return;
    }
    
    if (!clubs || clubs.length === 0) {
        clubsGrid.innerHTML = '<p style="text-align: center; color: #666; margin: 20px;">No hay clubes registrados</p>';
        return;
    }
    
    clubsGrid.innerHTML = clubs.map(club => `
        <div class="team-card">
            <div class="team-logo">
                <img src="${club.logo || '/images/default-logo.png'}" alt="${club.name}" onerror="this.src='/images/default-logo.png'">
            </div>
            <div class="team-info">
                <h3>${club.name}</h3>
                <p><strong>Fundado:</strong> ${club.founded || 'N/A'}</p>
                <p><strong>Jugadores:</strong> ${club.players || 0}</p>
                <p><strong>Descripción:</strong> ${club.description || 'Sin descripción'}</p>
            </div>
            <div class="team-actions">
                <button class="btn-edit" onclick="window.editClub('${club._id || club.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-delete" onclick="window.deleteClub('${club._id || club.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    console.log('✅ Clubes renderizados:', clubs.length);
}

// Función para renderizar partidos automáticamente
function renderMatches() {
    console.log('⚽ RENDERIZANDO PARTIDOS EN TIEMPO REAL...');
    const matchesGrid = document.getElementById('matchesGrid');
    if (!matchesGrid) {
        console.warn('⚠️ matchesGrid no encontrado');
        return;
    }
    
    if (!matches || matches.length === 0) {
        matchesGrid.innerHTML = '<p style="text-align: center; color: #666; margin: 20px;">No hay partidos programados</p>';
        return;
    }
    
    matchesGrid.innerHTML = matches.map(match => {
        const matchDate = new Date(match.date);
        const formattedDate = matchDate.toLocaleDateString('es-ES');
        const formattedTime = match.time || '00:00';
        
        return `
            <div class="match-card">
                <div class="match-header">
                    <span class="match-date">${formattedDate}</span>
                    <span class="match-time">${formattedTime}</span>
                </div>
                <div class="match-teams">
                    <div class="team-home">
                        <span class="team-name">${match.homeTeam}</span>
                        ${match.homeScore !== null ? `<span class="score">${match.homeScore}</span>` : ''}
                    </div>
                    <div class="vs">VS</div>
                    <div class="team-away">
                        ${match.awayScore !== null ? `<span class="score">${match.awayScore}</span>` : ''}
                        <span class="team-name">${match.awayTeam}</span>
                    </div>
                </div>
                <div class="match-status">
                    <span class="status ${match.status}">${match.status === 'scheduled' ? 'Programado' : match.status === 'live' ? 'En vivo' : 'Finalizado'}</span>
                    ${match.round ? `<span class="round">Jornada ${match.round}</span>` : ''}
                </div>
                <div class="match-actions">
                    <button class="btn-edit" onclick="editMatch('${match._id || match.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete" onclick="deleteMatch('${match._id || match.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    console.log('✅ Partidos renderizados:', matches.length);
}

// Función para cargar pestañas de equipos automáticamente
function loadTeamTabs() {
    console.log('🏆 CARGANDO PESTAÑAS DE EQUIPOS EN TIEMPO REAL...');
    const teamTabs = document.getElementById('teamTabs');
    if (!teamTabs) {
        console.warn('⚠️ teamTabs no encontrado');
        return;
    }
    
    if (!teams || teams.length === 0) {
        teamTabs.innerHTML = '<p style="text-align: center; color: #666; margin: 20px;">No hay equipos para mostrar jugadores</p>';
        return;
    }
    
    teamTabs.innerHTML = teams.map((team, index) => `
        <button class="team-tab ${index === 0 ? 'active' : ''}" 
                data-team-id="${team._id || team.id}" 
                onclick="selectTeam('${team._id || team.id}', '${team.name}')">
            ${team.name}
        </button>
    `).join('');
    
    // Cargar jugadores del primer equipo automáticamente
    if (teams.length > 0) {
        const firstTeamId = teams[0]._id || teams[0].id;
        const firstTeamName = teams[0].name;
        selectTeam(firstTeamId, firstTeamName);
    }
    
    console.log('✅ Pestañas de equipos cargadas:', teams.length);
}

// ==================== FUNCIONES DE PARTIDOS ====================

// Función para editar partido
function editMatch(matchId) {
    console.log('✏️ EDITANDO PARTIDO:', matchId);
    const match = matches.find(m => (m._id || m.id) === matchId);
    if (!match) {
        console.error('❌ Partido no encontrado:', matchId);
        return;
    }
    
    // Aquí puedes implementar la lógica de edición
    // Por ejemplo, abrir un modal o formulario de edición
    console.log('📝 Partido a editar:', match);
    alert(`Función de edición para el partido: ${match.homeTeam} vs ${match.awayTeam}\n\nEsta funcionalidad se puede implementar según tus necesidades.`);
}

// Función para eliminar partido
function deleteMatch(matchId) {
    console.log('🗑️ ELIMINANDO PARTIDO:', matchId);
    
    if (!confirm('¿Estás seguro de que quieres eliminar este partido?')) {
        return;
    }
    
    fetch(`/api/matches/${matchId}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('✅ Partido eliminado exitosamente:', data);
        showNotification('Partido eliminado exitosamente', 'success');
        // No necesitamos recargar manualmente - el WebSocket se encarga
    })
    .catch(error => {
        console.error('❌ Error eliminando partido:', error);
        showNotification('Error eliminando partido', 'error');
    });
}

// Funciones de Copa eliminadas

// Función eliminada

// Render Copa groups
function renderCopaGroups() {
    const groupsContainer = document.getElementById('copaGroupsDisplay');
    if (!groupsContainer) return;
    
    if (!copaData || !copaData.groups) {
        groupsContainer.innerHTML = '<p style="color: rgba(255,255,255,0.6); text-align: center;">No hay grupos configurados</p>';
        return;
    }
    
    let groupsHTML = '';
    
    ['A', 'B', 'C', 'D'].forEach(groupKey => {
        const group = copaData.groups[groupKey];
        
        groupsHTML += `
            <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px;">
                <h4 style="color: #00ff88; margin-bottom: 15px; text-align: center;">Grupo ${groupKey}</h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="border-bottom: 2px solid #00ff88;">
                                <th style="padding: 8px; text-align: left; color: #00ff88;">Equipo</th>
                                <th style="padding: 8px; text-align: center; color: #00ff88;">PJ</th>
                                <th style="padding: 8px; text-align: center; color: #00ff88;">Pts</th>
                                <th style="padding: 8px; text-align: center; color: #00ff88;">DG</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        if (group && group.length > 0) {
            group.forEach((team, index) => {
                const qualification = index < 2 ? 'style="background: rgba(0,255,136,0.1);"' : '';
                groupsHTML += `
                    <tr ${qualification}>
                        <td style="padding: 8px; color: white;">${team.name}</td>
                        <td style="padding: 8px; text-align: center; color: white;">${team.played}</td>
                        <td style="padding: 8px; text-align: center; color: white; font-weight: bold;">${team.points}</td>
                        <td style="padding: 8px; text-align: center; color: white;">${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}</td>
                    </tr>
                `;
            });
        } else {
            groupsHTML += `
                <tr>
                    <td colspan="4" style="padding: 20px; text-align: center; color: rgba(255,255,255,0.6);">
                        No hay equipos en este grupo
                    </td>
                </tr>
            `;
        }
        
        groupsHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
    
    groupsContainer.innerHTML = groupsHTML;
}

// Render Copa knockout
function renderCopaKnockout() {
    const knockoutContainer = document.getElementById('copaKnockoutDisplay');
    if (!knockoutContainer) return;
    
    if (!copaData || !copaData.knockout) {
        knockoutContainer.innerHTML = '<p style="color: rgba(255,255,255,0.6); text-align: center;">No hay eliminatorias configuradas</p>';
        return;
    }
    
    const knockout = copaData.knockout;
    
    let knockoutHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 20px;">
            <!-- Cuartos de Final -->
            <div>
                <h4 style="color: #00ff88; text-align: center; margin-bottom: 15px;">Cuartos de Final</h4>
    `;
    
    if (knockout.quarterfinals && knockout.quarterfinals.length > 0) {
        knockout.quarterfinals.forEach((match, index) => {
            const scoreDisplay = match.status === 'finished' ? 
                `${match.score1} - ${match.score2}` : 
                (match.team1 && match.team2 ? 'vs' : 'TBD');
            
            knockoutHTML += `
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 10px; text-align: center;">
                    <div style="color: white; font-weight: bold;">${match.team1 || 'TBD'}</div>
                    <div style="color: #00ff88; margin: 5px 0;">${scoreDisplay}</div>
                    <div style="color: white; font-weight: bold;">${match.team2 || 'TBD'}</div>
                    ${match.status === 'finished' ? `<div style="color: #ffaa00; font-size: 12px; margin-top: 5px;">Ganador: ${match.winner}</div>` : ''}
                </div>
            `;
        });
    } else {
        knockoutHTML += '<p style="color: rgba(255,255,255,0.6); text-align: center;">No configurado</p>';
    }
    
    knockoutHTML += `
            </div>
            <!-- Semifinales -->
            <div>
                <h4 style="color: #00ff88; text-align: center; margin-bottom: 15px;">Semifinales</h4>
    `;
    
    if (knockout.semifinals && knockout.semifinals.length > 0) {
        knockout.semifinals.forEach((match, index) => {
            const scoreDisplay = match.status === 'finished' ? 
                `${match.score1} - ${match.score2}` : 
                (match.team1 && match.team2 ? 'vs' : 'TBD');
            
            knockoutHTML += `
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 10px; text-align: center;">
                    <div style="color: white; font-weight: bold;">${match.team1 || 'TBD'}</div>
                    <div style="color: #00ff88; margin: 5px 0;">${scoreDisplay}</div>
                    <div style="color: white; font-weight: bold;">${match.team2 || 'TBD'}</div>
                    ${match.status === 'finished' ? `<div style="color: #ffaa00; font-size: 12px; margin-top: 5px;">Ganador: ${match.winner}</div>` : ''}
                </div>
            `;
        });
    } else {
        knockoutHTML += '<p style="color: rgba(255,255,255,0.6); text-align: center;">No configurado</p>';
    }
    
    knockoutHTML += `
            </div>
            <!-- Final -->
            <div>
                <h4 style="color: #00ff88; text-align: center; margin-bottom: 15px;">Final</h4>
    `;
    
    if (knockout.final) {
        const match = knockout.final;
        const scoreDisplay = match.status === 'finished' ? 
            `${match.score1} - ${match.score2}` : 
            (match.team1 && match.team2 ? 'vs' : 'TBD');
        
        knockoutHTML += `
            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; text-align: center;">
                <div style="color: white; font-weight: bold;">${match.team1 || 'TBD'}</div>
                <div style="color: #00ff88; margin: 5px 0;">${scoreDisplay}</div>
                <div style="color: white; font-weight: bold;">${match.team2 || 'TBD'}</div>
                ${match.status === 'finished' ? `<div style="color: #ffaa00; font-size: 12px; margin-top: 5px;">🏆 Campeón: ${match.winner}</div>` : ''}
            </div>
        `;
    } else {
        knockoutHTML += '<p style="color: rgba(255,255,255,0.6); text-align: center;">No configurado</p>';
    }
    
    knockoutHTML += `
            </div>
        </div>
    `;
    
    knockoutContainer.innerHTML = knockoutHTML;
}

// Generate Copa groups (admin function)
async function generateCopaGroupsAdmin() {
    if (!confirm('¿Generar grupos automáticamente? Esto sobrescribirá los grupos existentes.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/copa/generate-groups', {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            copaData = result.copa;
            
            showNotification('Grupos generados exitosamente', 'success');
            
            // Refresh displays
            renderCopaStatus();
            renderCopaGroups();
            updateGroupTeamSelects();
            
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error generando grupos', 'error');
        }
    } catch (error) {
        console.error('❌ Error generando grupos:', error);
        showNotification('Error de conexión', 'error');
    }
}

// Advance to knockout stage (admin function)
async function advanceToKnockoutAdmin() {
    if (!confirm('¿Avanzar a fase eliminatoria? Esto configurará los cuartos de final automáticamente.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/copa/advance-knockout', {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            copaData = result.copa;
            
            showNotification('Avanzado a fase eliminatoria exitosamente', 'success');
            
            // Refresh displays
            renderCopaStatus();
            renderCopaKnockout();
            updateKnockoutMatchSelect();
            
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error avanzando a eliminatoria', 'error');
        }
    } catch (error) {
        console.error('❌ Error avanzando a eliminatoria:', error);
        showNotification('Error de conexión', 'error');
    }
}


// Referencias a Copa eliminadas

// ==================== CONFIGURACIÓN DE ZONAS DE CLASIFICACIÓN ====================

// Función para guardar configuración de zonas de clasificación
async function saveTableConfig() {
    try {
        console.log('🎯 INICIANDO GUARDADO DE CONFIGURACIÓN...');
        
        // Obtener todas las zonas de clasificación del contenedor correcto
        const zonesContainer = document.getElementById('classificationZones');
        if (!zonesContainer) {
            console.error('❌ No se encontró el contenedor classificationZones');
            showNotification('Error: No se encontró el contenedor de zonas', 'error');
            return;
        }
        
        const zoneElements = zonesContainer.querySelectorAll('.zone-config');
        const classificationZones = [];
        
        console.log('🔍 Elementos de zona encontrados:', zoneElements.length);
        
        zoneElements.forEach((zoneElement, index) => {
            const nameInput = zoneElement.querySelector('input[type="text"]');
            const positionsInput = zoneElement.querySelector('input[placeholder*="1-4"], input[placeholder*="posici"]');
            const colorInput = zoneElement.querySelector('input[type="color"]');
            
            console.log(`🔍 Zona ${index + 1}:`, {
                nameInput: nameInput?.value,
                positionsInput: positionsInput?.value,
                colorInput: colorInput?.value
            });
            
            if (nameInput && positionsInput && colorInput) {
                classificationZones.push({
                    id: index + 1,
                    name: nameInput.value.trim(),
                    positions: positionsInput.value.trim(),
                    color: colorInput.value
                });
            }
        });
        
        console.log('📋 Configuración a guardar:', classificationZones);
        
        if (classificationZones.length === 0) {
            showNotification('No hay configuración para guardar', 'warning');
            return;
        }
        
        // Validar que todos los campos estén completos
        for (const zone of classificationZones) {
            if (!zone.name || !zone.positions || !zone.color) {
                showNotification('Todos los campos son obligatorios', 'error');
                return;
            }
        }
        
        // Enviar al backend
        const response = await fetch('/api/settings/classification-zones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ classificationZones })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Configuración guardada exitosamente:', data);
            showNotification('Configuración guardada correctamente', 'success');
        } else {
            throw new Error(data.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('❌ Error saving classification zones:', error);
        showNotification('Error guardando configuración: ' + error.message, 'error');
    }
}

// Función para cargar configuración de zonas de clasificación
async function loadTableConfig() {
    try {
        console.log('🔄 CARGANDO CONFIGURACIÓN DE ZONAS...');
        
        const response = await fetch('/api/settings/classification-zones');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.classificationZones) {
            console.log('✅ Configuración cargada:', data.classificationZones);
            renderTableConfig(data.classificationZones);
        } else {
            throw new Error(data.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('❌ Error loading classification zones:', error);
        showNotification('Error cargando configuración: ' + error.message, 'error');
    }
}

// Función para renderizar la configuración directamente desde MongoDB
function renderTableConfig(zones) {
    console.log('🔄 Renderizando zonas directamente desde MongoDB');
    
    const container = document.getElementById('classificationZones');
    if (!container) {
        console.error('❌ No se encontró classificationZones');
        return;
    }
    
    container.innerHTML = '';
    
    zones.forEach((zone, index) => {
        const zoneDiv = document.createElement('div');
        zoneDiv.className = 'zone-config';
        zoneDiv.style.cssText = `
            display: grid;
            grid-template-columns: 2fr 1fr 100px 80px;
            gap: 15px;
            align-items: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
        `;
        
        zoneDiv.innerHTML = `
            <input type="text" value="${zone.name}" placeholder="Nombre de la zona" 
                   style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.3); color: white; padding: 8px; border-radius: 4px;">
            <input type="text" value="${zone.positions}" placeholder="1-4" 
                   style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.3); color: white; padding: 8px; border-radius: 4px;">
            <input type="color" value="${zone.color}" 
                   style="width: 50px; height: 35px; border: none; border-radius: 4px; cursor: pointer;">
        `;
        
        container.appendChild(zoneDiv);
    });
    
    console.log('✅ Configuración renderizada en el contenedor:', zones.length, 'zonas');
}

// Función para agregar una nueva zona de clasificación
function addClassificationZone() {
    const container = document.getElementById('classificationZones');
    if (!container) {
        console.error('❌ No se encontró classificationZones');
        return;
    }
    
    const zoneDiv = document.createElement('div');
    zoneDiv.className = 'zone-config';
    zoneDiv.style.cssText = `
        display: grid;
        grid-template-columns: 2fr 1fr 100px 40px;
        gap: 15px;
        align-items: center;
        background: rgba(255, 255, 255, 0.1);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 10px;
    `;
    
    zoneDiv.innerHTML = `
        <input type="text" placeholder="Nombre de la zona" 
               style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.3); color: white; padding: 8px; border-radius: 4px;">
        <input type="text" placeholder="1-4" 
               style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.3); color: white; padding: 8px; border-radius: 4px;">
        <input type="color" value="#00ff88" 
               style="width: 50px; height: 35px; border: none; border-radius: 4px; cursor: pointer;">
        <button onclick="this.parentElement.remove()" 
                style="background: #ff4757; color: white; border: none; padding: 6px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    container.appendChild(zoneDiv);
    console.log('✅ Nueva zona de clasificación agregada');
}

// Función para cargar configuración automáticamente al inicializar
function initializeClassificationZones() {
    // Cargar configuración existente al inicializar el admin
    if (document.getElementById('classificationZones')) {
        loadTableConfig();
    }
}

// Exponer funciones globalmente
window.saveTableConfig = saveTableConfig;

console.log('✅ Funciones globales expuestas correctamente');

// Inicializar zonas de clasificación automáticamente
// REMOVIDO: setTimeout para evitar timing inconsistente
// Las zonas se cargarán cuando se acceda a la pestaña config

// ==================== FUNCIÓN SWITCHTAB ACTUALIZADA ====================

// Función para cambiar entre pestañas del admin
function switchTab(tabName) {
    console.log('🔄 Cambiando a pestaña:', tabName);
    
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.admin-section');
    sections.forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    
    // Remover clase active de todos los botones de pestaña
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Mostrar la sección correspondiente
    const targetSection = document.getElementById(tabName);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
    }
    
    // Activar el botón de pestaña correspondiente
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Cargar contenido específico según la pestaña
    switch (tabName) {
        case 'teams':
            loadTeams();
            break;
        case 'clubs':
            loadClubs();
            break;
        case 'matches':
            loadMatches();
            populateTeamSelects();
            console.log('🔄 Ejecutando initializeMatchGeneration desde switchTab...');
            setTimeout(() => {
                initializeMatchGeneration();
                initializeDeleteAllMatches();
            }, 500);
            initializeMatchGeneration();
            initializeDeleteAllMatches();
            break;
        case 'results':
            loadPendingMatches();
            break;
        case 'config':
            loadTableConfig();
            break;
        case 'players':
            loadTeamTabs();
            setupPlayerEventListeners();
            break;
        case 'playoffs':
            // Cargar playoffs si es necesario
            break;
        case 'clips':
            loadAllClips();
            break;
        default:
            console.warn('⚠️ Pestaña no reconocida:', tabName);
    }
}

// Exponer función switchTab globalmente
window.switchTab = switchTab;

// Exponer funciones globalmente para que funcionen desde HTML
window.selectTeam = selectTeam;
window.loadTeamTabs = loadTeamTabs;
window.setupPlayerEventListeners = setupPlayerEventListeners;
window.addPlayerQuick = addPlayerQuick;
