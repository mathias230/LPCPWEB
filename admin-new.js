// ==================== SISTEMA DE ADMINISTRACIÓN LPCP ====================
// Sistema completo de gestión de equipos, jugadores, partidos y clips
// Con sincronización automática entre todas las entidades

class LPCPAdmin {
    constructor() {
        this.teams = [];
        this.players = [];
        this.clubs = [];
        this.matches = [];
        this.clips = [];
        this.standings = [];
        this.socket = null;
        
        this.init();
    }

    // ==================== INICIALIZACIÓN ====================
    async init() {
        console.log('🚀 Inicializando sistema de administración LPCP...');
        
        // Conectar WebSocket para actualizaciones en tiempo real
        this.connectWebSocket();
        
        // Cargar datos iniciales
        await this.loadAllData();
        
        // Configurar event listeners
        this.setupEventListeners();
        
        // Renderizar interfaz inicial
        this.renderAll();
        
        console.log('✅ Sistema de administración inicializado correctamente');
    }

    // ==================== WEBSOCKET ====================
    connectWebSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('🔌 Conectado al servidor via WebSocket');
        });

        // Escuchar actualizaciones del servidor
        this.socket.on('teamsUpdate', (data) => {
            this.teams = data;
            this.renderTeams();
            this.updateStandings();
        });

        this.socket.on('playersUpdate', (data) => {
            this.players = data;
            this.renderPlayers();
        });

        this.socket.on('clubsUpdate', (data) => {
            this.clubs = data;
            this.renderClubs();
        });

        this.socket.on('matchesUpdate', (data) => {
            this.matches = data;
            this.renderMatches();
            this.updateStandings();
        });

        this.socket.on('clipsUpdate', (data) => {
            this.clips = data;
            this.renderClips();
        });
    }

    // ==================== CARGA DE DATOS ====================
    async loadAllData() {
        try {
            console.log('📥 Cargando datos del servidor...');
            
            // Cargar equipos
            const teamsResponse = await fetch('/api/teams');
            this.teams = await teamsResponse.json();
            
            // Cargar jugadores
            const playersResponse = await fetch('/api/players');
            this.players = await playersResponse.json();
            
            // Cargar clubes
            const clubsResponse = await fetch('/api/clubs');
            this.clubs = await clubsResponse.json();
            
            // Cargar partidos
            const matchesResponse = await fetch('/api/matches');
            this.matches = await matchesResponse.json();
            
            // Cargar clips
            const clipsResponse = await fetch('/api/clips');
            this.clips = await clipsResponse.json();
            
            console.log(`✅ Datos cargados: ${this.teams.length} equipos, ${this.players.length} jugadores, ${this.clubs.length} clubes`);
            
        } catch (error) {
            console.error('❌ Error cargando datos:', error);
            this.showError('Error cargando datos del servidor');
        }
    }

    // ==================== GESTIÓN DE EQUIPOS ====================
    async createTeam(teamData) {
        try {
            console.log('➕ Creando nuevo equipo:', teamData.name);
            
            const response = await fetch('/api/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(teamData)
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const newTeam = await response.json();
            
            // Actualizar localmente
            this.teams.push(newTeam);
            
            // Crear club asociado automáticamente
            await this.createClub({
                name: teamData.name,
                teamId: newTeam.id,
                founded: teamData.founded || new Date().getFullYear(),
                stadium: teamData.stadium || '',
                logo: teamData.logo || ''
            });
            
            this.showSuccess(`Equipo "${teamData.name}" creado exitosamente`);
            this.renderTeams();
            this.updateStandings();
            
            return newTeam;
            
        } catch (error) {
            console.error('❌ Error creando equipo:', error);
            this.showError(`Error creando equipo: ${error.message}`);
            throw error;
        }
    }

    async deleteTeam(teamId) {
        try {
            console.log('🗑️ Eliminando equipo ID:', teamId);
            
            // Confirmar eliminación
            const team = this.teams.find(t => t.id == teamId);
            if (!team) {
                throw new Error('Equipo no encontrado');
            }
            
            const confirmed = confirm(`¿Estás seguro de eliminar el equipo "${team.name}"?\n\nEsto también eliminará:\n- Todos los jugadores del equipo\n- El club asociado\n- Los partidos relacionados\n- Los clips del equipo`);
            
            if (!confirmed) {
                return;
            }
            
            const response = await fetch(`/api/teams/${teamId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            // Actualizar localmente
            this.teams = this.teams.filter(t => t.id != teamId);
            this.players = this.players.filter(p => p.clubName !== team.name);
            this.clubs = this.clubs.filter(c => c.name !== team.name);
            
            this.showSuccess(`Equipo "${team.name}" eliminado exitosamente`);
            this.renderAll();
            
        } catch (error) {
            console.error('❌ Error eliminando equipo:', error);
            this.showError(`Error eliminando equipo: ${error.message}`);
        }
    }

    async updateTeam(teamId, teamData) {
        try {
            console.log('✏️ Actualizando equipo ID:', teamId);
            
            const response = await fetch(`/api/teams/${teamId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(teamData)
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const updatedTeam = await response.json();
            
            // Actualizar localmente
            const index = this.teams.findIndex(t => t.id == teamId);
            if (index !== -1) {
                this.teams[index] = updatedTeam;
            }
            
            this.showSuccess(`Equipo actualizado exitosamente`);
            this.renderTeams();
            
            return updatedTeam;
            
        } catch (error) {
            console.error('❌ Error actualizando equipo:', error);
            this.showError(`Error actualizando equipo: ${error.message}`);
            throw error;
        }
    }

    // ==================== GESTIÓN DE JUGADORES ====================
    async createPlayer(playerData) {
        try {
            console.log('➕ Creando nuevo jugador:', playerData.name);
            
            const response = await fetch('/api/players', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(playerData)
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const newPlayer = await response.json();
            this.players.push(newPlayer);
            
            this.showSuccess(`Jugador "${playerData.name}" creado exitosamente`);
            this.renderPlayers();
            
            return newPlayer;
            
        } catch (error) {
            console.error('❌ Error creando jugador:', error);
            this.showError(`Error creando jugador: ${error.message}`);
            throw error;
        }
    }

    async deletePlayer(playerId) {
        try {
            console.log('🗑️ Eliminando jugador ID:', playerId);
            
            const player = this.players.find(p => p.id == playerId);
            if (!player) {
                throw new Error('Jugador no encontrado');
            }
            
            const confirmed = confirm(`¿Estás seguro de eliminar al jugador "${player.name}"?`);
            if (!confirmed) return;
            
            const response = await fetch(`/api/players/${playerId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            this.players = this.players.filter(p => p.id != playerId);
            
            this.showSuccess(`Jugador "${player.name}" eliminado exitosamente`);
            this.renderPlayers();
            
        } catch (error) {
            console.error('❌ Error eliminando jugador:', error);
            this.showError(`Error eliminando jugador: ${error.message}`);
        }
    }

    // ==================== GESTIÓN DE CLUBES ====================
    async createClub(clubData) {
        try {
            const response = await fetch('/api/clubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clubData)
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const newClub = await response.json();
            this.clubs.push(newClub);
            
            return newClub;
            
        } catch (error) {
            console.error('❌ Error creando club:', error);
            throw error;
        }
    }

    async deleteClub(clubId) {
        try {
            console.log('🗑️ Eliminando club ID:', clubId);
            
            const club = this.clubs.find(c => c.id == clubId);
            if (!club) {
                throw new Error('Club no encontrado');
            }
            
            const confirmed = confirm(`¿Estás seguro de eliminar el club "${club.name}"?`);
            if (!confirmed) return;
            
            const response = await fetch(`/api/clubs/${clubId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            this.clubs = this.clubs.filter(c => c.id != clubId);
            
            this.showSuccess(`Club "${club.name}" eliminado exitosamente`);
            this.renderClubs();
            
        } catch (error) {
            console.error('❌ Error eliminando club:', error);
            this.showError(`Error eliminando club: ${error.message}`);
        }
    }

    // ==================== RENDERIZADO ====================
    renderAll() {
        this.renderTeams();
        this.renderPlayers();
        this.renderClubs();
        this.renderMatches();
        this.renderClips();
        this.updateStandings();
    }

    renderTeams() {
        const container = document.getElementById('teamsGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.teams.forEach(team => {
            const teamCard = document.createElement('div');
            teamCard.className = 'team-card';
            teamCard.innerHTML = `
                <div class="team-header">
                    <div class="team-logo">
                        ${team.logo && team.logo !== 'img/default-team.png' 
                            ? `<img src="${team.logo}" alt="${team.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                            : ''
                        }
                        <div class="team-initial" ${team.logo && team.logo !== 'img/default-team.png' ? 'style="display:none"' : ''}>
                            ${team.name.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <h3>${team.name}</h3>
                </div>
                <div class="team-info">
                    <p><strong>Fundado:</strong> ${team.founded || 'N/A'}</p>
                    <p><strong>Estadio:</strong> ${team.stadium || 'N/A'}</p>
                    <p><strong>Jugadores:</strong> ${this.players.filter(p => p.clubName === team.name).length}</p>
                </div>
                <div class="team-actions">
                    <button class="btn-edit" onclick="adminSystem.editTeam(${team.id})">
                        ✏️ Editar
                    </button>
                    <button class="btn-delete" onclick="adminSystem.deleteTeam(${team.id})">
                        🗑️ Eliminar
                    </button>
                </div>
            `;
            container.appendChild(teamCard);
        });
    }

    renderPlayers() {
        const container = document.getElementById('playersGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.innerHTML = `
                <div class="player-header">
                    <div class="player-photo">
                        ${player.photo 
                            ? `<img src="${player.photo}" alt="${player.name}">`
                            : `<div class="player-initial">${player.name.charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <h3>${player.name}</h3>
                </div>
                <div class="player-info">
                    <p><strong>Club:</strong> ${player.clubName}</p>
                    <p><strong>Posición:</strong> ${player.position || 'Jugador'}</p>
                    <p><strong>Número:</strong> ${player.number || 'N/A'}</p>
                    <p><strong>Edad:</strong> ${player.age || 'N/A'}</p>
                </div>
                <div class="player-actions">
                    <button class="btn-edit" onclick="adminSystem.editPlayer(${player.id})">
                        ✏️ Editar
                    </button>
                    <button class="btn-delete" onclick="adminSystem.deletePlayer(${player.id})">
                        🗑️ Eliminar
                    </button>
                </div>
            `;
            container.appendChild(playerCard);
        });
    }

    renderClubs() {
        const container = document.getElementById('clubsGrid');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.clubs.forEach(club => {
            const clubCard = document.createElement('div');
            clubCard.className = 'club-card';
            clubCard.innerHTML = `
                <div class="club-header">
                    <div class="club-logo">
                        ${club.logo 
                            ? `<img src="${club.logo}" alt="${club.name}">`
                            : `<div class="club-initial">${club.name.charAt(0).toUpperCase()}</div>`
                        }
                    </div>
                    <h3>${club.name}</h3>
                </div>
                <div class="club-info">
                    <p><strong>Fundado:</strong> ${club.founded || 'N/A'}</p>
                    <p><strong>Estadio:</strong> ${club.stadium || 'N/A'}</p>
                    <p><strong>Jugadores:</strong> ${club.players || 0}</p>
                </div>
                <div class="club-actions">
                    <button class="btn-edit" onclick="adminSystem.editClub(${club.id})">
                        ✏️ Editar
                    </button>
                    <button class="btn-delete" onclick="adminSystem.deleteClub(${club.id})">
                        🗑️ Eliminar
                    </button>
                </div>
            `;
            container.appendChild(clubCard);
        });
    }

    renderMatches() {
        // Implementar renderizado de partidos
        console.log('🏆 Renderizando partidos...');
    }

    renderClips() {
        // Implementar renderizado de clips
        console.log('🎬 Renderizando clips...');
    }

    updateStandings() {
        // Actualizar tabla de posiciones basada en partidos
        console.log('📊 Actualizando tabla de posiciones...');
    }

    // ==================== UTILIDADES ====================
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
        
        console.log(`${type.toUpperCase()}: ${message}`);
    }

    // ==================== EVENT LISTENERS ====================
    setupEventListeners() {
        // Configurar event listeners para formularios y botones
        console.log('🎯 Configurando event listeners...');
        
        // Formulario de equipos
        const teamForm = document.getElementById('teamForm');
        if (teamForm) {
            teamForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleTeamSubmit(e);
            });
        }
        
        // Formulario de jugadores
        const playerForm = document.getElementById('playerForm');
        if (playerForm) {
            playerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handlePlayerSubmit(e);
            });
        }
    }

    async handleTeamSubmit(event) {
        const formData = new FormData(event.target);
        const teamData = {
            name: formData.get('name'),
            founded: parseInt(formData.get('founded')) || new Date().getFullYear(),
            stadium: formData.get('stadium') || '',
            logo: formData.get('logo') || ''
        };
        
        try {
            await this.createTeam(teamData);
            event.target.reset();
        } catch (error) {
            // Error ya manejado en createTeam
        }
    }

    async handlePlayerSubmit(event) {
        const formData = new FormData(event.target);
        const playerData = {
            name: formData.get('name'),
            clubName: formData.get('clubName'),
            position: formData.get('position') || 'Jugador',
            number: parseInt(formData.get('number')) || null,
            age: parseInt(formData.get('age')) || null,
            nationality: formData.get('nationality') || 'Panamá'
        };
        
        try {
            await this.createPlayer(playerData);
            event.target.reset();
        } catch (error) {
            // Error ya manejado en createPlayer
        }
    }

    // ==================== MÉTODOS DE EDICIÓN ====================
    editTeam(teamId) {
        const team = this.teams.find(t => t.id == teamId);
        if (!team) {
            this.showError('Equipo no encontrado');
            return;
        }
        
        // Implementar modal de edición
        console.log('✏️ Editando equipo:', team.name);
        // TODO: Implementar modal de edición
    }

    editPlayer(playerId) {
        const player = this.players.find(p => p.id == playerId);
        if (!player) {
            this.showError('Jugador no encontrado');
            return;
        }
        
        // Implementar modal de edición
        console.log('✏️ Editando jugador:', player.name);
        // TODO: Implementar modal de edición
    }

    editClub(clubId) {
        const club = this.clubs.find(c => c.id == clubId);
        if (!club) {
            this.showError('Club no encontrado');
            return;
        }
        
        // Implementar modal de edición
        console.log('✏️ Editando club:', club.name);
        // TODO: Implementar modal de edición
    }
}

// ==================== INICIALIZACIÓN GLOBAL ====================
let adminSystem = null;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    adminSystem = new LPCPAdmin();
    
    // Exponer globalmente para compatibilidad
    window.adminSystem = adminSystem;
    window.deleteTeam = (id) => adminSystem.deleteTeam(id);
    window.deletePlayer = (id) => adminSystem.deletePlayer(id);
    window.deleteClub = (id) => adminSystem.deleteClub(id);
    window.editTeam = (id) => adminSystem.editTeam(id);
    window.editPlayer = (id) => adminSystem.editPlayer(id);
    window.editClub = (id) => adminSystem.editClub(id);
});

console.log('📋 Sistema de administración LPCP cargado');
