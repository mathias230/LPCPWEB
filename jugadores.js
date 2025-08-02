// Jugadores page functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏃 Inicializando página de jugadores...');
    
    initializePlayersPage();
    setupEventListeners();
    loadInitialData();
    
    console.log('✅ Página de jugadores inicializada');
});

// Global variables
let allPlayers = [];
let allClubs = [];
let currentClubId = 'all';
let socket = null;

function initializePlayersPage() {
    // Setup mobile navigation
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    // Initialize WebSocket connection
    initializeWebSocket();
}

function setupEventListeners() {
    // Club selector buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('club-btn') || e.target.closest('.club-btn')) {
            const btn = e.target.classList.contains('club-btn') ? e.target : e.target.closest('.club-btn');
            const clubId = btn.getAttribute('data-club');
            selectClub(clubId);
        }
    });
}

function initializeWebSocket() {
    try {
        socket = io();
        
        socket.on('connect', () => {
            console.log('🔗 Conectado al servidor en tiempo real');
        });
        
        socket.on('playersUpdate', (updatedPlayers) => {
            console.log('🔄 Actualización de jugadores recibida');
            allPlayers = updatedPlayers;
            renderPlayers();
        });
        
        socket.on('teamsUpdate', (updatedTeams) => {
            console.log('🔄 Actualización de equipos recibida');
            allClubs = updatedTeams;
            renderClubSelector();
            if (currentClubId !== 'all') {
                updateClubInfo();
            }
        });
        
        socket.on('disconnect', () => {
            console.log('❌ Desconectado del servidor');
        });
        
    } catch (error) {
        console.warn('⚠️ WebSocket no disponible:', error);
    }
}

async function loadInitialData() {
    try {
        await Promise.all([
            loadPlayers(),
            loadClubs()
        ]);
        
        renderClubSelector();
        renderPlayers();
        
    } catch (error) {
        console.error('Error loading initial data:', error);
        showError('Error cargando datos iniciales');
    }
}

async function loadPlayers() {
    try {
        const response = await fetch('/api/players');
        if (!response.ok) throw new Error('Error fetching players');
        
        allPlayers = await response.json();
        console.log('✅ Jugadores cargados:', allPlayers.length);
        
    } catch (error) {
        console.error('Error loading players:', error);
        allPlayers = [];
        throw error;
    }
}

async function loadClubs() {
    try {
        // Cargar equipos desde /api/teams para sincronización correcta
        const response = await fetch('/api/teams');
        if (!response.ok) throw new Error('Error fetching teams');
        
        allClubs = await response.json();
        console.log('✅ Equipos cargados para jugadores:', allClubs.length);
        
    } catch (error) {
        console.error('Error loading teams:', error);
        allClubs = [];
        throw error;
    }
}

function renderClubSelector() {
    const clubSelector = document.getElementById('clubSelector');
    if (!clubSelector) return;

    // Mantener el botón "Todos los Jugadores"
    clubSelector.innerHTML = `
        <button class="club-btn ${currentClubId === 'all' ? 'active' : ''}" data-club="all">
            <i class="fas fa-users"></i> Todos los Jugadores
        </button>
    `;

    // Agregar botones para cada club que tenga jugadores
    const clubsWithPlayers = allClubs.filter(club => 
        allPlayers.some(player => player.clubName === club.name || player.team === club._id)
    );

    clubsWithPlayers.forEach(club => {
        const playerCount = allPlayers.filter(p => p.clubName === club.name || p.team === club._id).length;
        const btn = document.createElement('button');
        const clubId = club._id || club.id;
        btn.className = `club-btn ${currentClubId == clubId ? 'active' : ''}`;
        btn.setAttribute('data-club', clubId);
        btn.innerHTML = `
            <i class="fas fa-shield-alt"></i> ${club.name}
            <span style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 10px; font-size: 12px; margin-left: 8px;">
                ${playerCount}
            </span>
        `;
        clubSelector.appendChild(btn);
    });
}

function selectClub(clubId) {
    currentClubId = clubId;
    
    // Update active button
    document.querySelectorAll('.club-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-club="${clubId}"]`).classList.add('active');
    
    // Update club info and players
    updateClubInfo();
    renderPlayers();
}

function updateClubInfo() {
    const clubInfo = document.getElementById('clubInfo');
    const clubLogo = document.getElementById('clubLogo');
    const clubName = document.getElementById('clubName');
    const clubDescription = document.getElementById('clubDescription');
    const playerCount = document.getElementById('playerCount');
    
    if (currentClubId === 'all') {
        clubInfo.style.display = 'none';
        return;
    }
    
    const club = allClubs.find(c => c.id == currentClubId || c._id == currentClubId);
    const clubPlayers = allPlayers.filter(p => {
        if (!club) return false;
        return p.clubName === club.name || p.team === club._id;
    });
    
    if (!club) {
        clubInfo.style.display = 'none';
        return;
    }
    
    // Update club info
    clubInfo.style.display = 'block';
    clubLogo.src = club.logo || '';
    clubLogo.alt = club.name;
    clubName.textContent = club.name;
    clubDescription.textContent = club.description || `Club de fútbol ${club.name}`;
    playerCount.textContent = clubPlayers.length;
}

function renderPlayers() {
    const playersGrid = document.getElementById('playersGrid');
    if (!playersGrid) return;

    // Filter players based on selected club
    let playersToShow = currentClubId === 'all' 
        ? allPlayers 
        : allPlayers.filter(p => {
            // Buscar el club seleccionado
            const selectedClub = allClubs.find(club => club.id == currentClubId || club._id == currentClubId);
            if (!selectedClub) return false;
            // Filtrar por nombre del club o ID del equipo
            return p.clubName === selectedClub.name || p.team === selectedClub._id;
        });

    // Sort players by number
    playersToShow.sort((a, b) => a.number - b.number);

    playersGrid.innerHTML = '';

    if (playersToShow.length === 0) {
        const message = currentClubId === 'all' 
            ? 'No hay jugadores registrados en la liga'
            : 'Este equipo aún no tiene jugadores registrados';
            
        playersGrid.innerHTML = `
            <div class="no-players">
                <i class="fas fa-user-slash"></i>
                <h3>${message}</h3>
                <p>Los jugadores aparecerán aquí una vez que sean registrados por el administrador.</p>
            </div>
        `;
        return;
    }

    // Group players by position for better organization
    const positionOrder = [
        'Portero',
        'Defensa Central',
        'Lateral Derecho',
        'Lateral Izquierdo',
        'Mediocampista Defensivo',
        'Mediocampista Central',
        'Mediocampista Ofensivo',
        'Extremo Derecho',
        'Extremo Izquierdo',
        'Delantero Centro'
    ];

    // Sort players by position order, then by number
    playersToShow.sort((a, b) => {
        const posA = positionOrder.indexOf(a.position);
        const posB = positionOrder.indexOf(b.position);
        
        if (posA !== posB) {
            return posA - posB;
        }
        return a.number - b.number;
    });

    playersToShow.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card-compact';
        playerCard.style.cssText = `
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(0, 255, 136, 0.3);
            border-radius: 8px;
            padding: 8px 12px;
            margin: 4px;
            display: inline-block;
            min-width: 150px;
            max-width: 220px;
            text-align: center;
            transition: all 0.3s ease;
            cursor: pointer;
        `;
        
        playerCard.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 4px;">
                <span style="background: #00ff88; color: #0a0a0a; padding: 2px 6px; border-radius: 50%; font-weight: bold; font-size: 11px; min-width: 20px; text-align: center;">
                    ${player.number}
                </span>
                <span style="color: white; font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis;">
                    ${player.name}
                </span>
            </div>
            ${currentClubId === 'all' ? `
                <div style="color: rgba(255,255,255,0.6); font-size: 11px;">
                    ${player.clubName}
                </div>
            ` : ''}
        `;
        
        // Hover effect
        playerCard.addEventListener('mouseenter', () => {
            playerCard.style.borderColor = '#00ff88';
            playerCard.style.background = 'rgba(0, 255, 136, 0.1)';
            playerCard.style.transform = 'translateY(-2px)';
        });
        
        playerCard.addEventListener('mouseleave', () => {
            playerCard.style.borderColor = 'rgba(0, 255, 136, 0.3)';
            playerCard.style.background = 'rgba(255, 255, 255, 0.05)';
            playerCard.style.transform = 'translateY(0)';
        });
        
        playersGrid.appendChild(playerCard);
    });

    console.log(`✅ Mostrando ${playersToShow.length} jugadores`);
}

function showError(message) {
    const playersGrid = document.getElementById('playersGrid');
    if (!playersGrid) return;
    
    playersGrid.innerHTML = `
        <div class="no-players">
            <i class="fas fa-exclamation-triangle" style="color: #ff4757;"></i>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="club-btn" onclick="location.reload()" style="margin-top: 20px;">
                <i class="fas fa-refresh"></i> Reintentar
            </button>
        </div>
    `;
}

// Utility function to get position icon
function getPositionIcon(position) {
    const icons = {
        'Portero': 'fas fa-hand-paper',
        'Defensa Central': 'fas fa-shield-alt',
        'Lateral Derecho': 'fas fa-arrow-right',
        'Lateral Izquierdo': 'fas fa-arrow-left',
        'Mediocampista Defensivo': 'fas fa-user-shield',
        'Mediocampista Central': 'fas fa-circle',
        'Mediocampista Ofensivo': 'fas fa-arrow-up',
        'Extremo Derecho': 'fas fa-angle-double-right',
        'Extremo Izquierdo': 'fas fa-angle-double-left',
        'Delantero Centro': 'fas fa-bullseye'
    };
    
    return icons[position] || 'fas fa-user';
}
