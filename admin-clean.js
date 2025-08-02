// Admin panel functionality - VERSIÓN LIMPIA Y CONSOLIDADA
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Inicializando panel de administración...');
    
    initializeAdmin();
    setupEventListeners();
    loadInitialData();
    initializeWebSocket();
    
    console.log('✅ Panel de administración inicializado');
});

// Global variables
let teams = [];
let clubs = [];
let players = [];
let matches = [];
let currentTab = 'teams';
let socket = null;

// ==================== WEBSOCKET INITIALIZATION ====================
function initializeWebSocket() {
    if (typeof io !== 'undefined') {
        socket = io();
        
        socket.on('connect', () => {
            console.log('✅ WebSocket conectado');
        });
        
        socket.on('teamsUpdate', (updatedTeams) => {
            console.log('📡 Equipos actualizados vía WebSocket');
            teams = updatedTeams;
            if (currentTab === 'teams') renderTeams();
        });
        
        socket.on('clubsUpdate', (updatedClubs) => {
            console.log('📡 Clubes actualizados vía WebSocket');
            clubs = updatedClubs;
            if (currentTab === 'clubs') renderClubs();
        });
        
        socket.on('playersUpdate', (updatedPlayers) => {
            console.log('📡 Jugadores actualizados vía WebSocket');
            players = updatedPlayers;
            if (currentTab === 'players') loadPlayers();
        });
        
        socket.on('disconnect', () => {
            console.log('❌ WebSocket desconectado');
        });
    }
}

// ==================== INITIALIZATION ====================
function initializeAdmin() {
    console.log('🔧 Inicializando administrador...');
    
    // Verificar elementos del DOM
    const teamsGrid = document.getElementById('teamsGrid');
    const clubsGrid = document.getElementById('clubsGrid');
    
    if (!teamsGrid) console.error('❌ teamsGrid no encontrado');
    if (!clubsGrid) console.error('❌ clubsGrid no encontrado');
    
    // Inicializar pestaña por defecto
    switchTab('teams');
}

function setupEventListeners() {
    // Event listeners para formularios
    const teamForm = document.getElementById('teamForm');
    const clubForm = document.getElementById('clubForm');
    
    if (teamForm) {
        teamForm.addEventListener('submit', handleTeamSubmit);
    }
    
    if (clubForm) {
        clubForm.addEventListener('submit', handleClubSubmit);
    }
}

function loadInitialData() {
    loadTeams();
    loadClubs();
    loadPlayers();
}

// ==================== TAB NAVIGATION ====================
function switchTab(tabId) {
    console.log('🔄 Cambiando a pestaña:', tabId);
    
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.admin-section');
    sections.forEach(section => section.style.display = 'none');
    
    // Remover clase activa de todos los tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Mostrar sección seleccionada
    const targetSection = document.getElementById(tabId);
    const targetTab = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    
    if (targetSection) {
        targetSection.style.display = 'block';
        currentTab = tabId;
    }
    
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Cargar datos específicos de la pestaña
    switch(tabId) {
        case 'teams':
            loadTeams();
            break;
        case 'clubs':
            loadClubs();
            break;
        case 'players':
            loadPlayers();
            break;
    }
}

// ==================== TEAMS MANAGEMENT ====================
async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        if (response.ok) {
            teams = await response.json();
            console.log('✅ Equipos cargados:', teams.length);
            renderTeams();
        } else {
            console.error('❌ Error cargando equipos:', response.status);
        }
    } catch (error) {
        console.error('❌ Error de conexión cargando equipos:', error);
    }
}

function renderTeams() {
    const teamsGrid = document.getElementById('teamsGrid');
    if (!teamsGrid) {
        console.error('❌ teamsGrid no encontrado');
        return;
    }
    
    teamsGrid.innerHTML = '';
    
    if (teams.length === 0) {
        teamsGrid.innerHTML = '<p style="color: rgba(255,255,255,0.7); text-align: center;">No hay equipos registrados</p>';
        return;
    }
    
    teams.forEach(team => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';
        teamCard.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(0, 255, 136, 0.3);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            transition: all 0.3s ease;
        `;
        
        teamCard.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="width: 60px; height: 60px; background: rgba(0,255,136,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #00ff88;">
                    ${team.name ? team.name.charAt(0).toUpperCase() : 'T'}
                </div>
                <div>
                    <h3 style="color: #00ff88; margin: 0; font-size: 18px;">${team.name || 'Sin nombre'}</h3>
                    <p style="color: rgba(255,255,255,0.7); margin: 5px 0 0 0; font-size: 14px;">ID: ${team.id}</p>
                </div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="editTeam(${team.id})" style="background: linear-gradient(45deg, #3498db, #2980b9); color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button onclick="deleteTeam(${team.id})" style="background: linear-gradient(45deg, #e74c3c, #c0392b); color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        `;
        
        teamsGrid.appendChild(teamCard);
    });
    
    console.log('✅ Equipos renderizados:', teams.length);
}

async function handleTeamSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const teamData = {
        name: formData.get('name')
    };
    
    try {
        const response = await fetch('/api/teams', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(teamData)
        });
        
        if (response.ok) {
            console.log('✅ Equipo creado exitosamente');
            e.target.reset();
            loadTeams();
        } else {
            const error = await response.json();
            console.error('❌ Error creando equipo:', error);
            alert('Error creando equipo: ' + (error.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        alert('Error de conexión con el servidor');
    }
}

function editTeam(teamId) {
    const team = teams.find(t => t.id == teamId);
    if (!team) {
        console.error('❌ Equipo no encontrado:', teamId);
        return;
    }
    
    // Llenar formulario
    const nameInput = document.querySelector('#teamForm input[name="name"]');
    if (nameInput) {
        nameInput.value = team.name;
    }
    
    console.log('✏️ Editando equipo:', team.name);
}

async function deleteTeam(teamId) {
    console.log('🗑️ Intentando eliminar equipo ID:', teamId);
    
    const team = teams.find(t => t.id == teamId);
    if (!team) {
        console.error('❌ Equipo no encontrado:', teamId);
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
            alert(`✅ Equipo "${team.name}" eliminado exitosamente`);
            
            // Recargar datos
            await loadTeams();
            await loadClubs();
            
        } else {
            const error = await response.json();
            console.error('❌ Error del servidor:', error);
            alert(`❌ Error: ${error.error || 'Error eliminando equipo'}`);
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        alert('❌ Error de conexión con el servidor');
    }
}

// ==================== CLUBS MANAGEMENT ====================
async function loadClubs() {
    try {
        const response = await fetch('/api/clubs');
        if (response.ok) {
            clubs = await response.json();
            console.log('✅ Clubes cargados:', clubs.length);
            renderClubs();
        } else {
            console.error('❌ Error cargando clubes:', response.status);
        }
    } catch (error) {
        console.error('❌ Error de conexión cargando clubes:', error);
    }
}

function renderClubs() {
    const clubsGrid = document.getElementById('clubsGrid');
    if (!clubsGrid) {
        console.error('❌ clubsGrid no encontrado');
        return;
    }
    
    clubsGrid.innerHTML = '';
    
    if (clubs.length === 0) {
        clubsGrid.innerHTML = '<p style="color: rgba(255,255,255,0.7); text-align: center;">No hay clubes registrados</p>';
        return;
    }
    
    clubs.forEach(club => {
        const clubCard = document.createElement('div');
        clubCard.className = 'club-card';
        clubCard.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(0, 255, 136, 0.3);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            transition: all 0.3s ease;
        `;
        
        clubCard.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="width: 60px; height: 60px; background: rgba(0,255,136,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #00ff88;">
                    ${club.name ? club.name.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                    <h3 style="color: #00ff88; margin: 0; font-size: 18px;">${club.name || 'Sin nombre'}</h3>
                    <p style="color: rgba(255,255,255,0.7); margin: 5px 0 0 0; font-size: 14px;">ID: ${club.id}</p>
                </div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="editClub(${club.id})" style="background: linear-gradient(45deg, #3498db, #2980b9); color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button onclick="deleteClub(${club.id})" style="background: linear-gradient(45deg, #e74c3c, #c0392b); color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        `;
        
        clubsGrid.appendChild(clubCard);
    });
    
    console.log('✅ Clubes renderizados:', clubs.length);
}

async function handleClubSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const clubData = {
        name: formData.get('name')
    };
    
    try {
        const response = await fetch('/api/clubs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(clubData)
        });
        
        if (response.ok) {
            console.log('✅ Club creado exitosamente');
            e.target.reset();
            loadClubs();
        } else {
            const error = await response.json();
            console.error('❌ Error creando club:', error);
            alert('Error creando club: ' + (error.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        alert('Error de conexión con el servidor');
    }
}

function editClub(clubId) {
    const club = clubs.find(c => c.id == clubId);
    if (!club) {
        console.error('❌ Club no encontrado:', clubId);
        return;
    }
    
    // Llenar formulario
    const nameInput = document.querySelector('#clubForm input[name="name"]');
    if (nameInput) {
        nameInput.value = club.name;
    }
    
    console.log('✏️ Editando club:', club.name);
}

async function deleteClub(clubId) {
    console.log('🗑️ Intentando eliminar club ID:', clubId);
    
    const club = clubs.find(c => c.id == clubId);
    if (!club) {
        console.error('❌ Club no encontrado:', clubId);
        alert('Error: Club no encontrado');
        return;
    }
    
    const confirmed = confirm(`¿Estás seguro de que quieres eliminar el club "${club.name}"?`);
    
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
            alert(`✅ Club "${club.name}" eliminado exitosamente`);
            
            // Recargar datos
            await loadClubs();
            
        } else {
            const error = await response.json();
            console.error('❌ Error del servidor:', error);
            alert(`❌ Error: ${error.error || 'Error eliminando club'}`);
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        alert('❌ Error de conexión con el servidor');
    }
}

// ==================== PLAYERS MANAGEMENT ====================
async function loadPlayers() {
    try {
        const response = await fetch('/api/players');
        if (response.ok) {
            players = await response.json();
            console.log('✅ Jugadores cargados:', players.length);
        } else {
            console.error('❌ Error cargando jugadores:', response.status);
        }
    } catch (error) {
        console.error('❌ Error de conexión cargando jugadores:', error);
    }
}

// ==================== GLOBAL FUNCTIONS ====================
// Exponer funciones globalmente para que los botones HTML puedan acceder a ellas
window.switchTab = switchTab;
window.editTeam = editTeam;
window.deleteTeam = deleteTeam;
window.editClub = editClub;
window.deleteClub = deleteClub;

console.log('✅ Admin.js limpio cargado - Funciones globales expuestas correctamente');
