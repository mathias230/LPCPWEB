// main.js - JavaScript para la página principal
// Gestión dinámica de clubes con sincronización en tiempo real

let socket;
let clubsData = [];
let teamsData = [];
let playersData = [];

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    initializeWebSocket();
    loadClubs();
    loadDynamicStats();
});

// Inicializar WebSocket para actualizaciones en tiempo real
function initializeWebSocket() {
    try {
        socket = io();
        
        // Escuchar actualizaciones de clubes en tiempo real
        socket.on('clubsUpdate', function(updatedClubs) {
            console.log('📡 Actualización de clubes recibida:', updatedClubs);
            clubsData = updatedClubs;
            renderClubs();
        });
        
        // Escuchar actualizaciones de equipos
        socket.on('teamsUpdate', function(updatedTeams) {
            console.log('📡 Actualización de equipos recibida:', updatedTeams);
            teamsData = updatedTeams;
            updateTeamsCounter();
        });
        
        // Escuchar actualizaciones de jugadores
        socket.on('playersUpdate', function(updatedPlayers) {
            console.log('📡 Actualización de jugadores recibida:', updatedPlayers);
            playersData = updatedPlayers;
            updatePlayersCounter();
        });
        
        socket.on('connect', function() {
            console.log('✅ Conectado al servidor WebSocket');
        });
        
        socket.on('disconnect', function() {
            console.log('❌ Desconectado del servidor WebSocket');
        });
        
    } catch (error) {
        console.warn('⚠️ WebSocket no disponible, funcionando sin actualizaciones en tiempo real');
    }
}

// Cargar clubes desde la API
async function loadClubs() {
    try {
        const response = await fetch('/api/clubs');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        clubsData = await response.json();
        console.log('✅ Clubes cargados:', clubsData.length);
        renderClubs();
        
    } catch (error) {
        console.error('❌ Error cargando clubes:', error);
        // Fallback a datos estáticos si falla la API
        loadFallbackClubs();
    }
}

// Renderizar clubes dinámicamente
function renderClubs() {
    const clubsGrid = document.querySelector('.clubs-grid');
    if (!clubsGrid) {
        console.warn('⚠️ Contenedor de clubes no encontrado');
        return;
    }
    
    // Limpiar contenido existente
    clubsGrid.innerHTML = '';
    
    // Renderizar cada club
    clubsData.forEach(club => {
        const clubCard = createClubCard(club);
        clubsGrid.appendChild(clubCard);
    });
    
    console.log(`✅ ${clubsData.length} clubes renderizados`);
}

// Crear tarjeta de club
function createClubCard(club) {
    const clubCard = document.createElement('div');
    clubCard.className = 'club-card';
    clubCard.setAttribute('data-club-id', club.id);
    
    // Determinar la URL del logo
    let logoUrl = club.logo || '/img/default-club.png';
    
    // Si el logo no empieza con http o /, agregamos el prefijo correcto
    if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('/')) {
        logoUrl = '/' + logoUrl;
    }
    
    clubCard.innerHTML = `
        <div class="club-logo">
            <img src="${logoUrl}" alt="${club.name} Logo" class="club-logo-img" 
                 onerror="this.src='/img/default-club.png'">
        </div>
        <h3>${club.name}</h3>
        <p>${club.description}</p>
        <div class="club-stats">
            <span>Fundado: ${club.founded}</span>
            <span>Jugadores: ${club.players}</span>
        </div>
    `;
    
    return clubCard;
}

// Datos de fallback si falla la API
function loadFallbackClubs() {
    clubsData = [
        {
            id: 1,
            name: "ACP 507",
            description: "Representando la tradición canalera con orgullo y determinación.",
            founded: 2023,
            players: 12,
            logo: "/img/APC 507.png"
        },
        {
            id: 2,
            name: "Coiner FC",
            description: "Estrategia y precisión definen el estilo de juego de este equipo.",
            founded: 2023,
            players: 13,
            logo: "img/Coiner FC.jpg"
        },
        {
            id: 3,
            name: "FC WEST SIDE",
            description: "Desde el oeste de Panamá, con pasión y técnica incomparable.",
            founded: 2023,
            players: 14,
            logo: "img/West side.jpg"
        }
    ];
    
    console.log('⚠️ Usando datos de fallback para clubes');
    renderClubs();
}

// Función para refrescar clubes manualmente (útil para debugging)
function refreshClubs() {
    console.log('🔄 Refrescando clubes...');
    loadClubs();
}

// Cargar estadísticas dinámicas (equipos y jugadores)
async function loadDynamicStats() {
    try {
        // Cargar equipos
        const teamsResponse = await fetch('/api/teams');
        if (teamsResponse.ok) {
            teamsData = await teamsResponse.json();
            updateTeamsCounter();
        }
        
        // Cargar jugadores
        const playersResponse = await fetch('/api/players');
        if (playersResponse.ok) {
            playersData = await playersResponse.json();
            updatePlayersCounter();
        }
        
    } catch (error) {
        console.error('❌ Error cargando estadísticas dinámicas:', error);
    }
}

// Actualizar contador de equipos con animación
function updateTeamsCounter() {
    const teamsCounter = document.querySelector('.stat-item:first-child .stat-number');
    if (teamsCounter) {
        const targetCount = teamsData.length;
        animateCounter(teamsCounter, targetCount);
    }
}

// Actualizar contador de jugadores con animación
function updatePlayersCounter() {
    const playersCounter = document.querySelector('.stat-item:nth-child(2) .stat-number');
    if (playersCounter) {
        const targetCount = playersData.length;
        animateCounter(playersCounter, targetCount);
    }
}

// Animar contador con efecto de incremento
function animateCounter(element, targetValue) {
    const currentValue = parseInt(element.textContent) || 0;
    const increment = targetValue > currentValue ? 1 : -1;
    const duration = 1000; // 1 segundo
    const steps = Math.abs(targetValue - currentValue);
    const stepDuration = steps > 0 ? duration / steps : 0;
    
    if (steps === 0) return;
    
    let current = currentValue;
    const timer = setInterval(() => {
        current += increment;
        element.textContent = current;
        
        if (current === targetValue) {
            clearInterval(timer);
        }
    }, stepDuration);
}

// Función para refrescar estadísticas manualmente
function refreshStats() {
    console.log('🔄 Refrescando estadísticas...');
    loadDynamicStats();
}

// Exponer funciones globalmente para debugging
window.refreshClubs = refreshClubs;
window.refreshStats = refreshStats;
window.clubsData = clubsData;
window.teamsData = teamsData;
window.playersData = playersData;
