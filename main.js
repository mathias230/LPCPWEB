// main.js - JavaScript para la página principal
// Gestión dinámica de clubes con sincronización en tiempo real

let socket;
let clubsData = [];

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    initializeWebSocket();
    loadClubs();
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

// Exponer funciones globalmente para debugging
window.refreshClubs = refreshClubs;
window.clubsData = clubsData;
