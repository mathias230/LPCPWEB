// Funciones para manejar las estadísticas de jugadores en standings.js

// Cargar estadísticas de jugadores desde la API
async function loadPlayerStats() {
    try {
        console.log('📊 Cargando estadísticas de jugadores...');
        const response = await fetch('/api/players');
        if (response.ok) {
            playersStatsData = await response.json();
            console.log(`✅ Estadísticas de ${playersStatsData.length} jugadores cargadas`);
            
            // Calcular totales
            totalGoals = playersStatsData.reduce((sum, player) => sum + (parseInt(player.goals) || 0), 0);
            totalAssists = playersStatsData.reduce((sum, player) => sum + (parseInt(player.assists) || 0), 0);
            
            return true;
        } else {
            console.warn('⚠️ No se pudieron cargar las estadísticas de jugadores');
            playersStatsData = [];
            return false;
        }
    } catch (error) {
        console.error('❌ Error cargando estadísticas de jugadores:', error);
        playersStatsData = [];
        return false;
    }
}

// Cargar y mostrar estadísticas en la pestaña de estadísticas
function loadStats() {
    console.log('📈 Cargando estadísticas...');
    
    // Ordenar jugadores por goles y asistencias
    const topScorers = [...playersStatsData]
        .sort((a, b) => (parseInt(b.goals) || 0) - (parseInt(a.goals) || 0) || a.name.localeCompare(b.name))
        .slice(0, 10);
        
    const topAssisters = [...playersStatsData]
        .sort((a, b) => (parseInt(b.assists) || 0) - (parseInt(a.assists) || 0) || a.name.localeCompare(b.name))
        .slice(0, 10);
    
    // Actualizar tablas
    updateTopScorersTable(topScorers);
    updateTopAssistsTable(topAssisters);
    updateStatsSummary();
}

// Actualizar tabla de goleadores
function updateTopScorersTable(players) {
    const tbody = document.getElementById('topScorersList');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (players.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="4">
                    <i class="fas fa-info-circle"></i>
                    No hay datos de goleadores disponibles
                </td>
            </tr>`;
        return;
    }
    
    players.forEach((player, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="rank">${index + 1}</td>
            <td class="player">
                <div class="player-info">
                    <span class="player-number">${player.number || ''}</span>
                    <span class="player-name">${player.name || 'Jugador'}</span>
                </div>
            </td>
            <td class="team">
                <div class="team-info">
                    <img src="${player.teamLogo || 'img/team-placeholder.png'}" alt="${player.team || ''}" class="team-logo-small">
                    <span>${player.team || 'Sin equipo'}</span>
                </div>
            </td>
            <td class="goals">${player.goals || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Actualizar tabla de asistencias
function updateTopAssistsTable(players) {
    const tbody = document.getElementById('topAssistsList');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (players.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data">
                <td colspan="4">
                    <i class="fas fa-info-circle"></i>
                    No hay datos de asistencias disponibles
                </td>
            </tr>`;
        return;
    }
    
    players.forEach((player, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="rank">${index + 1}</td>
            <td class="player">
                <div class="player-info">
                    <span class="player-number">${player.number || ''}</span>
                    <span class="player-name">${player.name || 'Jugador'}</span>
                </div>
            </td>
            <td class="team">
                <div class="team-info">
                    <img src="${player.teamLogo || 'img/team-placeholder.png'}" alt="${player.team || ''}" class="team-logo-small">
                    <span>${player.team || 'Sin equipo'}</span>
                </div>
            </td>
            <td class="assists">${player.assists || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Actualizar resumen de estadísticas
function updateStatsSummary() {
    // Calcular promedio de goles por partido
    const totalMatches = fixturesData.filter(match => match.status === 'FINISHED').length || 1;
    const avgGoalsPerMatch = (totalGoals / totalMatches).toFixed(1);
    
    // Actualizar los elementos del DOM
    const totalGoalsEl = document.getElementById('totalGoals');
    const totalAssistsEl = document.getElementById('totalAssists');
    const avgGoalsEl = document.getElementById('avgGoalsPerMatch');
    
    if (totalGoalsEl) totalGoalsEl.textContent = totalGoals;
    if (totalAssistsEl) totalAssistsEl.textContent = totalAssists;
    if (avgGoalsEl) avgGoalsEl.textContent = avgGoalsPerMatch;
    
    console.log(`📊 Resumen actualizado: ${totalGoals} goles, ${totalAssists} asistencias, ${avgGoalsPerMatch} promedio`);
}
