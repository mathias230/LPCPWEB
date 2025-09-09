// Clips page functionality
let currentPage = 1;
let currentFilter = 'all';
let isLoading = false;
let statsInterval;
let lastStatsUpdate = 0;
let isServerAvailable = false;
let teamsData = []; // Equipos dinámicos del backend

// DOM Elements
const uploadModal = document.getElementById('uploadModal');
const uploadBtn = document.getElementById('uploadBtn');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelUpload');
const uploadForm = document.getElementById('uploadForm');
const clipsGrid = document.getElementById('clipsGrid');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const filterBtns = document.querySelectorAll('.filter-btn');

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Check server availability
    checkServerAvailability();
    
    // Load teams data
    loadTeamsData();
    
    loadClips();
    loadStats();
    setupEventListeners();
    startRealTimeUpdates();
    
    // Initialize video modal
    initializeVideoModal();
    
    // Initialize navigation
    initializeNavigation();
    
    // Setup WebSocket for real-time team updates
    setupTeamsWebSocket();
});

// Check server availability
async function checkServerAvailability() {
    try {
        const response = await fetch('/api/stats');
        if (response.ok) {
            console.log('🟢 Servidor disponible');
            isServerAvailable = true;
            showNotification('Conectado al servidor', 'success');
        } else {
            throw new Error('Server response not ok');
        }
    } catch (error) {
        console.log('🔴 Servidor no disponible, usando modo offline');
        isServerAvailable = false;
        resetStatsIfNeeded();
    }
}

// Load teams data from backend
async function loadTeamsData() {
    try {
        console.log('👥 Cargando equipos desde el backend...');
        const response = await fetch('/api/teams');
        if (response.ok) {
            teamsData = await response.json();
            console.log('✅ Equipos cargados para clips:', teamsData.length);
            
            // Actualizar filtros y formulario con los nuevos equipos
            updateTeamFilters();
            updateTeamSelect();
        } else {
            console.warn('⚠️ No se pudieron cargar los equipos del backend');
            teamsData = getFallbackTeams();
            updateTeamFilters();
            updateTeamSelect();
        }
    } catch (error) {
        console.error('❌ Error cargando equipos:', error);
        teamsData = getFallbackTeams();
        updateTeamFilters();
        updateTeamSelect();
    }
}

// Equipos por defecto como fallback
function getFallbackTeams() {
    return [
        { name: 'ACP 507' },
        { name: 'BKS FC' },
        { name: 'Coiner FC' },
        { name: 'FC WEST SIDE' },
        { name: 'Humacao FC' },
        { name: 'Jumpers FC' },
        { name: 'LOS PLEBES Tk' },
        { name: 'Pura Vibra' },
        { name: 'Rayos X FC' },
        { name: 'Tiki Taka FC' },
        { name: 'WEST SIDE PTY' }
    ];
}

// Actualizar filtros de equipos dinámicamente
function updateTeamFilters() {
    const clubFiltersContainer = document.querySelector('[data-club-filter="all"]')?.parentElement;
    if (!clubFiltersContainer) return;
    
    // Mantener el botón "Todos"
    const allButton = clubFiltersContainer.querySelector('[data-club-filter="all"]');
    
    // Limpiar filtros existentes excepto "Todos"
    const existingFilters = clubFiltersContainer.querySelectorAll('[data-club-filter]:not([data-club-filter="all"])');
    existingFilters.forEach(filter => filter.remove());
    
    // Agregar nuevos filtros de equipos
    teamsData.forEach(team => {
        const filterBtn = document.createElement('button');
        filterBtn.className = 'filter-tag';
        filterBtn.setAttribute('data-club-filter', team.name);
        filterBtn.textContent = team.name;
        
        // Agregar event listener
        filterBtn.addEventListener('click', () => {
            const filter = team.name;
            console.log('🔍 Filtro de club seleccionado:', filter);
            
            currentFilter = filter;
            
            // Update active button state
            clubFiltersContainer.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
            filterBtn.classList.add('active');
            
            // Reset pagination and reload clips
            currentPage = 1;
            clipsGrid.innerHTML = '';
            loadClips();
        });
        
        clubFiltersContainer.appendChild(filterBtn);
    });
    
    console.log('✅ Filtros de equipos actualizados:', teamsData.length);
}

// Actualizar select de equipos en el formulario
function updateTeamSelect() {
    const clubSelect = document.getElementById('clubSelect');
    if (!clubSelect) return;
    
    // Mantener la opción por defecto
    const defaultOption = clubSelect.querySelector('option[value=""]');
    
    // Limpiar opciones existentes excepto la por defecto
    const existingOptions = clubSelect.querySelectorAll('option:not([value=""])');
    existingOptions.forEach(option => option.remove());
    
    // Agregar nuevas opciones de equipos
    teamsData.forEach(team => {
        const option = document.createElement('option');
        option.value = team.name;
        option.textContent = team.name;
        clubSelect.appendChild(option);
    });
    
    console.log('✅ Select de equipos actualizado:', teamsData.length);
}

// Configurar WebSocket para actualizaciones en tiempo real de equipos
function setupTeamsWebSocket() {
    try {
        console.log('🔌 Configurando WebSocket para equipos...');
        const socket = io();
        
        socket.on('connect', () => {
            console.log('✅ WebSocket conectado para clips');
        });
        
        socket.on('teamsUpdate', (updatedTeams) => {
            console.log('👥 Actualizando equipos en clips...', updatedTeams.length);
            teamsData = updatedTeams;
            
            // Actualizar filtros y formulario con los nuevos equipos
            updateTeamFilters();
            updateTeamSelect();
            
            showNotification('Lista de equipos actualizada', 'success');
        });
        
        socket.on('disconnect', () => {
            console.log('❌ WebSocket desconectado');
        });
        
    } catch (error) {
        console.error('❌ Error configurando WebSocket:', error);
    }
}

// Función para resetear estadísticas si es necesario
function resetStatsIfNeeded() {
    // Verificar si hay datos corruptos o muy altos
    let savedStats = localStorage.getItem('clipStats');
    if (savedStats) {
        let stats = JSON.parse(savedStats);
        // Si los números son muy altos, resetear
        if (stats.total_clips > 50 || stats.total_views > 2000 || stats.total_likes > 500) {
            resetStats();
        }
    }
}

// Función para resetear completamente las estadísticas
function resetStats() {
    const freshStats = {
        total_clips: 0,
        total_views: 0,
        total_likes: 0
    };
    localStorage.setItem('clipStats', JSON.stringify(freshStats));
    console.log('📊 Estadísticas reseteadas a 0');
}

function setupEventListeners() {
    // Upload modal
    uploadBtn.addEventListener('click', () => {
        uploadModal.style.display = 'block';
    });

    closeBtn.addEventListener('click', () => {
        uploadModal.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        uploadModal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
            uploadModal.style.display = 'none';
        }
    });

    // Upload form
    uploadForm.addEventListener('submit', handleUpload);

    // Filter buttons - both filter-tag and filter-btn
    document.querySelectorAll('.filter-tag, .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter || btn.dataset.clubFilter || 'all';
            console.log('🔍 Filtro seleccionado:', filter);
            
            // Update current filter
            currentFilter = filter;
            
            // Update active button state
            const parentGroup = btn.closest('.filter-tags, .gallery-filters');
            if (parentGroup) {
                parentGroup.querySelectorAll('.filter-tag, .filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
            
            // Reset pagination and reload clips
            currentPage = 1;
            clipsGrid.innerHTML = '';
            loadClips();
        });
    });
    
    // Filter toggle button (show/hide filter options)
    const filterBtn = document.getElementById('filterBtn');
    const filterOptions = document.getElementById('filterOptions');
    
    if (filterBtn && filterOptions) {
        filterBtn.addEventListener('click', () => {
            const isVisible = filterOptions.style.display !== 'none';
            filterOptions.style.display = isVisible ? 'none' : 'block';
        });
    }

    // Load more button
    loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        loadClips();
    });

    // File upload styling and validation
    const fileInput = document.getElementById('clipFile');
    const fileLabel = document.querySelector('.file-upload-label span');
    const fileUploadDiv = document.querySelector('.file-upload');
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        
        if (!file) {
            fileLabel.textContent = 'Seleccionar o grabar video';
            fileUploadDiv.classList.remove('file-selected', 'file-error');
            return;
        }
        
        // Validate file size (100MB max)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            fileLabel.textContent = 'Archivo demasiado grande (máx 100MB)';
            fileUploadDiv.classList.add('file-error');
            fileUploadDiv.classList.remove('file-selected');
            showError('El archivo es demasiado grande. Máximo 100MB permitido.');
            fileInput.value = ''; // Clear the input
            return;
        }
        
        // Validate file type
        const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'];
        if (!allowedTypes.includes(file.type) && !file.type.startsWith('video/')) {
            fileLabel.textContent = 'Formato no soportado';
            fileUploadDiv.classList.add('file-error');
            fileUploadDiv.classList.remove('file-selected');
            showError('Formato de video no soportado. Usa MP4, MOV, AVI o WEBM.');
            fileInput.value = ''; // Clear the input
            return;
        }
        
        // File is valid
        const fileName = file.name;
        const fileSize = (file.size / (1024 * 1024)).toFixed(1); // Size in MB
        fileLabel.textContent = `${fileName} (${fileSize}MB)`;
        fileUploadDiv.classList.add('file-selected');
        fileUploadDiv.classList.remove('file-error');
        
        console.log('📁 Archivo seleccionado:', {
            name: fileName,
            size: fileSize + 'MB',
            type: file.type
        });
    });
    
    // Handle file input errors on mobile
    fileInput.addEventListener('error', (e) => {
        console.error('Error al seleccionar archivo:', e);
        showError('Error al seleccionar el archivo. Inténtalo de nuevo.');
        fileLabel.textContent = 'Seleccionar o grabar video';
        fileUploadDiv.classList.remove('file-selected', 'file-error');
    });
}

function setActiveFilter(activeBtn, filter) {
    filterBtns.forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
}

async function loadClips() {
    if (isLoading) return;
    
    isLoading = true;
    loadMoreBtn.style.display = 'none';
    
    try {
        // Try server API first
        const response = await fetch(`/api/clips?page=${currentPage}&category=${currentFilter}`);
        const data = await response.json();
        
        console.log('📥 Datos recibidos del servidor:', data);
        console.log('📊 Clips encontrados:', data.clips?.length || 0);
        
        if (data.clips && data.clips.length > 0) {
            console.log('🎬 Primer clip:', data.clips[0]);
            renderClips(data.clips);
            
            if (data.has_more) {
                loadMoreBtn.style.display = 'block';
            }
        } else if (currentPage === 1) {
            showEmptyState();
        }
        
    } catch (error) {
        console.error('Error loading clips:', error);
        showError('Error al cargar los clips');
    } finally {
        isLoading = false;
    }
}

function renderClips(clips) {
    clips.forEach(clip => {
        const clipElement = createClipElement(clip);
        clipsGrid.appendChild(clipElement);
    });
    
    // Add scroll animations
    const newClips = clipsGrid.querySelectorAll('.clip-card:not(.animated)');
    newClips.forEach((clip, index) => {
        clip.classList.add('animated');
        clip.style.opacity = '0';
        clip.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            clip.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            clip.style.opacity = '1';
            clip.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

function createClipElement(clip) {
    const clipDiv = document.createElement('div');
    clipDiv.className = 'clip-card';
    clipDiv.dataset.clipId = clip.id;
    
    const uploadDate = new Date(clip.upload_date).toLocaleDateString('es-ES');
    
    clipDiv.innerHTML = `
        <div class="clip-thumbnail" onclick="playClip('${clip.id}')">
            <video preload="metadata" muted>
                <source src="${clip.video_url || `/uploads/${clip.filename}`}" type="video/mp4">
            </video>
            <div class="play-overlay">
                <i class="fas fa-play-circle"></i>
            </div>
            <div class="clip-overlay">
                <span class="clip-duration">${clip.duration}</span>
            </div>
        </div>
        <div class="clip-info">
            <h4>${clip.title}</h4>
            <p>${clip.description}</p>
            <div class="clip-meta">
                <span class="clip-club"><i class="fas fa-shield-alt"></i> ${clip.club}</span>
                <span class="clip-date"><i class="fas fa-calendar"></i> ${uploadDate}</span>
            </div>
            <div class="clip-stats">
                <span class="views"><i class="fas fa-eye"></i> ${formatNumber(clip.views)}</span>
                <span class="likes" onclick="likeClip('${clip.id}')">
                    <i class="fas fa-heart"></i> ${formatNumber(clip.likes)}
                </span>
            </div>
        </div>
    `;
    
    return clipDiv;
}

function playClip(clipId) {
    console.log('Playing clip:', clipId);
    
    const modal = document.getElementById('videoModal');
    const videoPlayer = document.getElementById('videoPlayer');
    const videoLoading = document.getElementById('videoLoading');
    const videoTitle = document.getElementById('videoTitle');
    const videoDescription = document.getElementById('videoDescription');
    const videoClub = document.getElementById('videoClub');
    const videoDate = document.getElementById('videoDate');
    const videoViews = document.getElementById('videoViews');
    const videoLikes = document.getElementById('videoLikes');
    const videoDuration = document.getElementById('videoDuration');
    const likeBtn = document.getElementById('likeVideoBtn');
    
    // Show loading state
    videoLoading.style.display = 'flex';
    videoPlayer.style.display = 'none';
    
    // Show modal with animation
    modal.classList.add('active');
    
    // Store clip ID in modal for later use
    modal.dataset.clipId = clipId;
    
    // Try to fetch clip data from server
    fetch(`/api/clips/${clipId}`)
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Clip not found');
        })
        .then(clip => {
            // Update modal content with real data
            videoTitle.textContent = clip.title;
            videoDescription.textContent = clip.description;
            videoClub.innerHTML = `<i class="fas fa-shield-alt"></i> ${clip.club}`;
            videoDate.innerHTML = `<i class="fas fa-calendar"></i> ${formatDate(clip.created_at)}`;
            videoViews.textContent = formatNumber(clip.views || 0);
            videoLikes.textContent = formatNumber(clip.likes || 0);
            videoDuration.textContent = formatDuration(clip.duration || 0);
            
            // Set video source with Cloudinary URL first, then fallbacks
            const videoSource = videoPlayer.querySelector('source');
            const possiblePaths = [
                clip.video_url, // Cloudinary URL (primary)
                clip.filename ? `/uploads/${clip.filename}` : null,
                clip.filename ? `/uploads/videos/${clip.filename}` : null,
                `/uploads/${clipId}.mp4`,
                `/uploads/videos/${clipId}.mp4`,
                `/uploads/${clipId}.webm`,
                `/uploads/videos/${clipId}.webm`
            ].filter(path => path !== null);
            
            let currentPathIndex = 0;
            
            function tryNextVideoPath() {
                if (currentPathIndex < possiblePaths.length) {
                    const path = possiblePaths[currentPathIndex];
                    console.log(`Trying video path ${currentPathIndex + 1}/${possiblePaths.length}: ${path}`);
                    videoSource.src = path;
                    videoPlayer.load();
                    currentPathIndex++;
                } else {
                    // All paths failed, show error
                    console.error('All video paths failed');
                    videoLoading.innerHTML = `
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--panama-red); margin-bottom: 1rem;"></i>
                        <p>Error al cargar el video</p>
                        <p style="font-size: 0.9rem; opacity: 0.7;">El archivo de video no se encontró</p>
                    `;
                    videoLoading.style.display = 'flex';
                    videoPlayer.style.display = 'none';
                }
            }
            
            // Remove any existing error listeners
            videoPlayer.removeEventListener('error', tryNextVideoPath);
            
            // Add error listener for fallback paths
            videoPlayer.addEventListener('error', tryNextVideoPath);
            
            // Start with first path
            tryNextVideoPath();
            
            // Update like button state
            if (clip.user_liked) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
            
            // Hide loading and show video
            videoLoading.style.display = 'none';
            videoPlayer.style.display = 'block';
            
            // Increment view count
            incrementViewCount(clipId);
            
        })
        .catch(error => {
            console.error('Error loading clip:', error);
            // Show placeholder data if server fails
            videoTitle.textContent = `Clip ${clipId}`;
            videoDescription.textContent = 'Video no disponible temporalmente';
            videoClub.innerHTML = '<i class="fas fa-shield-alt"></i> Club Desconocido';
            videoDate.innerHTML = '<i class="fas fa-calendar"></i> Fecha desconocida';
            videoViews.textContent = '0';
            videoLikes.textContent = '0';
            videoDuration.textContent = '0:00';
            
            // Try to load video with fallback paths even without server data
            const videoSource = videoPlayer.querySelector('source');
            const fallbackPaths = [
                `/uploads/${clipId}.mp4`,
                `/uploads/videos/${clipId}.mp4`,
                `/uploads/${clipId}.webm`,
                `/uploads/videos/${clipId}.webm`
            ];
            
            let fallbackIndex = 0;
            
            function tryFallbackPath() {
                if (fallbackIndex < fallbackPaths.length) {
                    const path = fallbackPaths[fallbackIndex];
                    console.log(`Trying fallback path ${fallbackIndex + 1}/${fallbackPaths.length}: ${path}`);
                    videoSource.src = path;
                    videoPlayer.load();
                    fallbackIndex++;
                } else {
                    // All fallback paths failed
                    console.error('All fallback video paths failed');
                    videoLoading.innerHTML = `
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--panama-red); margin-bottom: 1rem;"></i>
                        <p>Error al cargar el video</p>
                        <p style="font-size: 0.9rem; opacity: 0.7;">El archivo de video no se encontró</p>
                    `;
                    videoLoading.style.display = 'flex';
                    videoPlayer.style.display = 'none';
                    return;
                }
            }
            
            // Remove any existing error listeners
            videoPlayer.removeEventListener('error', tryFallbackPath);
            
            // Add error listener for fallback paths
            videoPlayer.addEventListener('error', tryFallbackPath);
            
            // Start with first fallback path
            tryFallbackPath();
            
            // Initially hide loading and show video player
            videoLoading.style.display = 'none';
            videoPlayer.style.display = 'block';
        });
    
    // Setup video event listeners
    videoPlayer.addEventListener('loadedmetadata', () => {
        videoDuration.textContent = formatDuration(Math.floor(videoPlayer.duration));
    });
    
    // Video loaded successfully - hide loading
    videoPlayer.addEventListener('canplay', () => {
        videoLoading.style.display = 'none';
        videoPlayer.style.display = 'block';
    });
}

// Function to increment view count
function incrementViewCount(clipId) {
    fetch(`/api/clips/${clipId}/view`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update view count in modal
                const videoViews = document.getElementById('videoViews');
                if (videoViews) {
                    videoViews.textContent = formatNumber(data.views);
                }
            }
        })
        .catch(error => console.log('Error incrementing view count:', error));
}

async function likeClip(clipId) {
    try {
        const response = await fetch(`/api/clips/${clipId}/like`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.likes !== undefined) {
            // Update the likes count in the UI
            const clipCard = document.querySelector(`[data-clip-id="${clipId}"]`);
            const likesSpan = clipCard.querySelector('.likes');
            likesSpan.innerHTML = `<i class="fas fa-heart"></i> ${formatNumber(data.likes)}`;
            
            // Add heart animation
            likesSpan.style.transform = 'scale(1.2)';
            likesSpan.style.color = 'var(--panama-red)';
            setTimeout(() => {
                likesSpan.style.transform = 'scale(1)';
                likesSpan.style.color = '';
            }, 200);
            
            // Immediately update global stats (optimistic update)
            const statNumbers = document.querySelectorAll('.stat-number');
            if (statNumbers.length >= 3) {
                const currentLikes = parseInt(statNumbers[2].textContent.replace(/[^0-9]/g, '')) || 0;
                updateStatWithAnimation(statNumbers[2], currentLikes + 1);
            }
            
            // Force stats refresh after a short delay
            setTimeout(() => {
                loadStats();
            }, 500);
        }
    } catch (error) {
        console.error('Error liking clip:', error);
    }
}

async function handleUpload(e) {
    e.preventDefault();
    
    const formData = new FormData(uploadForm);
    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    const progressContainer = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    // Validar que se hayan llenado todos los campos
    const clipTitle = formData.get('clipTitle');
    const clipDescription = formData.get('clipDescription');
    const clipType = formData.get('clipType');
    const clubSelect = formData.get('clubSelect');
    const clipFile = formData.get('clipFile');
    
    if (!clipTitle || !clipDescription || !clipType || !clubSelect || !clipFile || clipFile.size === 0) {
        showError('Por favor completa todos los campos y selecciona un archivo');
        return;
    }
    
    // Validar tipo y tamaño de archivo
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'];
    
    if (clipFile.size > maxSize) {
        showError('El archivo es demasiado grande. Máximo 100MB permitido.');
        return;
    }
    
    if (!allowedTypes.includes(clipFile.type) && !clipFile.type.startsWith('video/')) {
        showError('Formato de video no soportado. Usa MP4, MOV, AVI o WEBM.');
        return;
    }
    
    // Show loading state and progress bar
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';
    submitBtn.disabled = true;
    progressContainer.style.display = 'block';
    
    // Simulate progress for mobile feedback
    let progress = 0;
    const progressInterval = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 10;
            if (progress > 90) progress = 90;
            progressFill.style.width = progress + '%';
            progressText.textContent = Math.round(progress) + '%';
        }
    }, 200);
    
    try {
        // Intentar subir al servidor primero
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        // Complete progress
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        progressText.textContent = '100%';
        
        if (data.success) {
            setTimeout(() => {
                handleSuccessfulUpload();
                progressContainer.style.display = 'none';
                progressFill.style.width = '0%';
                progressText.textContent = '0%';
            }, 500);
        } else {
            progressContainer.style.display = 'none';
            showError(data.error || 'Error al subir el clip');
        }
    } catch (error) {
        console.log('Servidor no disponible, simulando subida exitosa');
        
        // Continue progress simulation
        setTimeout(() => {
            clearInterval(progressInterval);
            progressFill.style.width = '100%';
            progressText.textContent = '100%';
            
            setTimeout(() => {
                handleSuccessfulUpload();
                progressContainer.style.display = 'none';
                progressFill.style.width = '0%';
                progressText.textContent = '0%';
            }, 500);
        }, 1500);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Función para manejar subida exitosa
function handleSuccessfulUpload() {
    showSuccess('¡Clip subido exitosamente!');
    uploadModal.style.display = 'none';
    uploadForm.reset();
    document.querySelector('.file-upload-label span').textContent = 'Seleccionar archivo de video';
    
    // Obtener estadísticas actuales
    let currentStats = localStorage.getItem('clipStats');
    let stats;
    
    if (currentStats) {
        stats = JSON.parse(currentStats);
    } else {
        stats = { total_clips: 0, total_views: 0, total_likes: 0 };
    }
    
    // Incrementar estadísticas
    stats.total_clips += 1;
    stats.total_views += Math.floor(Math.random() * 25 + 15); // Entre 15-40 vistas por clip
    stats.total_likes += Math.floor(Math.random() * 8 + 3);   // Entre 3-10 likes por clip
    
    // Guardar estadísticas actualizadas
    localStorage.setItem('clipStats', JSON.stringify(stats));
    
    // Actualizar estadísticas inmediatamente con animación
    updateStatsInstantly();
    
    // Reload clips
    currentPage = 1;
    clipsGrid.innerHTML = '';
    loadClips();
    
    // Mostrar notificación de estadísticas actualizadas
    setTimeout(() => {
        showSuccess('¡Estadísticas actualizadas en tiempo real! 📈');
    }, 1000);
}

async function loadStats() {
    if (isServerAvailable) {
        try {
            // Cargar desde servidor real
            const response = await fetch('/api/stats');
            const stats = await response.json();
            updateStatsFromServer(stats);
            lastStatsUpdate = Date.now();
        } catch (error) {
            console.log('Error cargando estadísticas del servidor:', error);
            isServerAvailable = false;
            loadSimulatedStats();
        }
    } else {
        console.log('Servidor no disponible, usando datos simulados');
        loadSimulatedStats();
    }
}

// Función para actualizar estadísticas desde el servidor
function updateStatsFromServer(stats) {
    const statNumbers = document.querySelectorAll('.stat-number');
    if (statNumbers.length >= 3) {
        updateStatWithAnimation(statNumbers[0], stats.total_clips);
        updateStatWithAnimation(statNumbers[1], stats.total_views);
        updateStatWithAnimation(statNumbers[2], stats.total_likes);
    }
}

// Función para actualizar likes de un clip específico
function updateClipLikes(clipId, newLikes) {
    const clipElement = document.querySelector(`[data-clip-id="${clipId}"]`);
    if (clipElement) {
        const likesElement = clipElement.querySelector('.likes-count');
        if (likesElement) {
            likesElement.textContent = newLikes;
            // Animación de actualización
            likesElement.style.transform = 'scale(1.2)';
            likesElement.style.color = '#ff6b6b';
            setTimeout(() => {
                likesElement.style.transform = 'scale(1)';
                likesElement.style.color = '';
            }, 300);
        }
    }
}

// Función para actualizar vistas de un clip específico
function updateClipViews(clipId, newViews) {
    const clipElement = document.querySelector(`[data-clip-id="${clipId}"]`);
    if (clipElement) {
        const viewsElement = clipElement.querySelector('.views-count');
        if (viewsElement) {
            viewsElement.textContent = formatNumber(newViews);
            // Animación de actualización
            viewsElement.style.transform = 'scale(1.1)';
            viewsElement.style.color = '#00d4ff';
            setTimeout(() => {
                viewsElement.style.transform = 'scale(1)';
                viewsElement.style.color = '';
            }, 300);
        }
    }
}

// Función para cargar estadísticas simuladas
function loadSimulatedStats() {
    // Obtener estadísticas guardadas o inicializar en 0
    let savedStats = localStorage.getItem('clipStats');
    let simulatedStats;
    
    if (savedStats) {
        simulatedStats = JSON.parse(savedStats);
    } else {
        // Inicializar todo en 0 si es la primera vez
        simulatedStats = {
            total_clips: 0,
            total_views: 0,
            total_likes: 0
        };
        localStorage.setItem('clipStats', JSON.stringify(simulatedStats));
    }
    
    // Update stats in the gallery header with animation
    const statNumbers = document.querySelectorAll('.stat-number');
    if (statNumbers.length >= 3) {
        updateStatWithAnimation(statNumbers[0], simulatedStats.total_clips);
        updateStatWithAnimation(statNumbers[1], simulatedStats.total_views);
        updateStatWithAnimation(statNumbers[2], simulatedStats.total_likes);
    }
    
    lastStatsUpdate = Date.now();
}

// Función para actualizar estadísticas inmediatamente después de subir clip
async function updateStatsInstantly() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        const statNumbers = document.querySelectorAll('.stat-number');
        if (statNumbers.length >= 3) {
            // Animación más dramática para mostrar el cambio inmediato
            statNumbers[0].style.transform = 'scale(1.3)';
            statNumbers[0].style.color = '#00ff88';
            statNumbers[0].style.textShadow = '0 0 10px #00ff88';
            
            setTimeout(() => {
                updateStatWithAnimation(statNumbers[0], stats.total_clips);
                updateStatWithAnimation(statNumbers[1], stats.total_views);
                updateStatWithAnimation(statNumbers[2], stats.total_likes);
                
                // Restaurar estilos normales
                setTimeout(() => {
                    statNumbers[0].style.transform = 'scale(1)';
                    statNumbers[0].style.color = 'var(--accent-blue)';
                    statNumbers[0].style.textShadow = 'none';
                }, 500);
            }, 300);
        }
        
        lastStatsUpdate = Date.now();
        
        // Trigger evento personalizado para notificar actualización
        window.dispatchEvent(new CustomEvent('statsUpdated', { 
            detail: { stats, timestamp: Date.now() } 
        }));
        
    } catch (error) {
        console.error('Error updating stats instantly:', error);
    }
}

function updateStatWithAnimation(element, newValue) {
    const currentValue = parseInt(element.textContent.replace(/[^0-9]/g, '')) || 0;
    const formattedNewValue = formatNumber(newValue);
    
    if (currentValue !== newValue) {
        // Add pulse animation
        element.style.transform = 'scale(1.1)';
        element.style.color = 'var(--accent-cyan)';
        
        setTimeout(() => {
            element.textContent = formattedNewValue;
            element.style.transform = 'scale(1)';
            element.style.color = 'var(--accent-blue)';
        }, 150);
    }
}

function startRealTimeUpdates() {
    // Update stats every 1.5 seconds para mayor responsividad
    statsInterval = setInterval(async () => {
        await loadStats();
    }, 1500);
    
    // También actualizar cuando la página se vuelve visible
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            loadStats();
        }
    });
    
    // Actualizar cuando el usuario interactúa con la página
    ['click', 'scroll', 'mousemove'].forEach(event => {
        document.addEventListener(event, () => {
            const now = Date.now();
            // Solo actualizar si han pasado al menos 2 segundos desde la última actualización
            if (now - lastStatsUpdate > 2000) {
                loadStats();
            }
        }, { passive: true, once: false });
    });
    
    // Listener para eventos personalizados de actualización
    window.addEventListener('statsUpdated', (e) => {
        console.log('📊 Estadísticas actualizadas:', e.detail.stats);
        showNotification('📈 Estadísticas actualizadas en tiempo real', 'success');
    });
    
    // Actualización inmediata al cargar
    loadStats();
}

function stopRealTimeUpdates() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return 'Hace 1 día';
    } else if (diffDays < 7) {
        return `Hace ${diffDays} días`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `Hace ${weeks} semana${weeks > 1 ? 's' : ''}`;
    } else {
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

// Format duration in seconds to MM:SS format
function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Initialize video modal functionality
function initializeVideoModal() {
    const videoModal = document.getElementById('videoModal');
    const closeVideoBtn = document.getElementById('videoClose'); // Fixed ID
    const likeVideoBtn = document.getElementById('likeVideoBtn');
    const shareVideoBtn = document.getElementById('shareVideoBtn');
    const downloadVideoBtn = document.getElementById('downloadVideoBtn');
    
    if (!videoModal) {
        console.warn('Video modal not found');
        return;
    }
    
    // Close modal when clicking the close button
    if (closeVideoBtn) {
        closeVideoBtn.addEventListener('click', () => {
            videoModal.classList.remove('active');
            const videoPlayer = document.getElementById('videoPlayer');
            if (videoPlayer) {
                videoPlayer.pause();
                videoPlayer.currentTime = 0;
            }
        });
    }
    
    // Close modal when clicking outside
    videoModal.addEventListener('click', (e) => {
        if (e.target === videoModal) {
            videoModal.classList.remove('active');
            const videoPlayer = document.getElementById('videoPlayer');
            if (videoPlayer) {
                videoPlayer.pause();
                videoPlayer.currentTime = 0;
            }
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && videoModal.classList.contains('active')) {
            videoModal.classList.remove('active');
            const videoPlayer = document.getElementById('videoPlayer');
            if (videoPlayer) {
                videoPlayer.pause();
                videoPlayer.currentTime = 0;
            }
        }
    });
    
    // Like button functionality
    if (likeVideoBtn) {
        likeVideoBtn.addEventListener('click', () => {
            const currentClipId = videoModal.dataset.clipId;
            if (currentClipId) {
                likeVideoFromModal(currentClipId);
            }
        });
    }
    
    // Share button functionality
    if (shareVideoBtn) {
        shareVideoBtn.addEventListener('click', () => {
            const currentClipId = videoModal.dataset.clipId;
            if (currentClipId) {
                shareVideo(currentClipId);
            }
        });
    }
    
    // Download button functionality
    if (downloadVideoBtn) {
        downloadVideoBtn.addEventListener('click', () => {
            const currentClipId = videoModal.dataset.clipId;
            if (currentClipId) {
                downloadVideo(currentClipId);
            }
        });
    }
    
    console.log('✅ Video modal initialized');
}

// Like video from modal
function likeVideoFromModal(clipId) {
    const likeBtn = document.getElementById('likeVideoBtn');
    const videoLikes = document.getElementById('videoLikes');
    
    fetch(`/api/clips/${clipId}/like`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                likeBtn.classList.toggle('liked');
                videoLikes.textContent = formatNumber(data.likes);
                showNotification('¡Like agregado!', 'success');
            }
        })
        .catch(error => {
            console.log('Error liking video:', error);
            // Simulate like for offline mode
            likeBtn.classList.toggle('liked');
            const currentLikes = parseInt(videoLikes.textContent) || 0;
            videoLikes.textContent = formatNumber(currentLikes + (likeBtn.classList.contains('liked') ? 1 : -1));
            showNotification('¡Like agregado!', 'success');
        });
}

// Share video functionality
function shareVideo(clipId) {
    const shareUrl = `${window.location.origin}/clips.html?clip=${clipId}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Mira este clip increíble',
            text: 'Échale un vistazo a este clip de la AMERICA PRO CLUBS',
            url: shareUrl
        }).catch(console.error);
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            showNotification('¡Enlace copiado al portapapeles!', 'success');
        }).catch(() => {
            showNotification('No se pudo copiar el enlace', 'error');
        });
    }
}

// Download video functionality
function downloadVideo(clipId) {
    const videoPlayer = document.getElementById('videoPlayer');
    const videoSource = videoPlayer.querySelector('source');
    
    if (videoSource && videoSource.src) {
        // Usar fetch para obtener el video como blob y luego descargarlo
        fetch(videoSource.src)
            .then(response => {
                if (!response.ok) {
                    throw new Error('No se pudo obtener el video');
                }
                return response.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `clip_${clipId}.mp4`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Limpiar el objeto URL después de un tiempo
                setTimeout(() => {
                    window.URL.revokeObjectURL(url);
                }, 100);
                
                showNotification('¡Descarga iniciada!', 'success');
            })
            .catch(error => {
                console.error('Error descargando video:', error);
                showNotification('Error al descargar el video', 'error');
            });
    } else {
        showNotification('No se encontró el video para descargar', 'error');
    }
}

function showEmptyState() {
    clipsGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-video"></i>
            <h3>No hay clips disponibles</h3>
            <p>Sé el primero en subir un clip increíble de la liga</p>
            <button class="btn-primary" onclick="document.getElementById('uploadBtn').click()">
                <i class="fas fa-upload"></i>
                Subir Primer Clip
            </button>
        </div>
    `;
}

function showSampleClips() {
    const sampleClips = [
        {
            id: 'sample1',
            title: 'Gol espectacular de ACP 507',
            description: 'Increíble gol de último minuto que definió el partido',
            club: 'ACP 507',
            filename: 'sample1.mp4',
            upload_date: new Date().toISOString(),
            views: 1250,
            likes: 89,
            category: 'goles'
        },
        {
            id: 'sample2',
            title: 'Atajada increíble de Coiner FC',
            description: 'El portero de Coiner FC salva el partido con esta atajada',
            club: 'Coiner FC',
            filename: 'sample2.mp4',
            upload_date: new Date(Date.now() - 86400000).toISOString(),
            views: 890,
            likes: 67,
            category: 'atajadas'
        },
        {
            id: 'sample3',
            title: 'Jugada colectiva de FC WEST SIDE',
            description: 'Excelente jugada colectiva que termina en gol',
            club: 'FC WEST SIDE',
            filename: 'sample3.mp4',
            upload_date: new Date(Date.now() - 172800000).toISOString(),
            views: 1456,
            likes: 112,
            category: 'jugadas'
        },
        {
            id: 'sample4',
            title: 'Celebración épica de Tiki Taka Fc',
            description: 'La celebración más creativa de la temporada',
            club: 'Tiki Taka Fc',
            filename: 'sample4.mp4',
            upload_date: new Date(Date.now() - 259200000).toISOString(),
            views: 2103,
            likes: 156,
            category: 'celebraciones'
        }
    ];
    
    // Show notification that we're in demo mode
    showNotification('Modo demostración - Mostrando clips de ejemplo', 'success');
    
    // Filter sample clips by current filter
    let filteredClips = sampleClips;
    if (currentFilter !== 'all') {
        filteredClips = sampleClips.filter(clip => clip.category === currentFilter);
    }
    
    if (filteredClips.length > 0) {
        renderClips(filteredClips);
    } else {
        clipsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-filter"></i>
                <h3>No hay clips en esta categoría</h3>
                <p>Prueba con otra categoría o sube el primer clip de este tipo</p>
                <button class="btn-secondary" onclick="setActiveFilter(document.querySelector('[data-filter=\"all\"]'), 'all'); loadClips();">
                    <i class="fas fa-list"></i>
                    Ver Todos
                </button>
            </div>
        `;
    }
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Navigation functionality for clips page
function initializeNavigation() {
    // Wait a bit to ensure DOM is fully loaded
    setTimeout(() => {
        const navLinks = document.querySelectorAll('.nav-link');
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        
        console.log('🔧 Inicializando navegación...', { 
            hamburger: !!hamburger, 
            navMenu: !!navMenu, 
            navLinks: navLinks.length 
        });
        
        // Handle navigation links - only close mobile menu, don't interfere with navigation
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Close mobile menu if open (but don't prevent navigation)
                if (hamburger && navMenu) {
                    hamburger.classList.remove('active');
                    navMenu.classList.remove('active');
                }
                
                // Let the browser handle the navigation normally
                // Don't call e.preventDefault() - let links work normally
                console.log('🔗 Navegando a:', link.href);
            });
        });
        
        // Mobile menu toggle - simplified approach
        if (hamburger) {
            // Remove any existing listeners first
            hamburger.replaceWith(hamburger.cloneNode(true));
            const newHamburger = document.querySelector('.hamburger');
            
            newHamburger.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const menu = document.querySelector('.nav-menu');
                if (menu) {
                    newHamburger.classList.toggle('active');
                    menu.classList.toggle('active');
                    console.log('🍔 Hamburger toggled:', newHamburger.classList.contains('active'));
                }
            });
            
            console.log('✅ Hamburger menu inicializado');
        } else {
            console.warn('❌ No se encontró el elemento hamburger');
        }
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            const currentHamburger = document.querySelector('.hamburger');
            const currentNavMenu = document.querySelector('.nav-menu');
            
            if (currentHamburger && currentNavMenu && 
                !e.target.closest('.nav-container') && 
                currentHamburger.classList.contains('active')) {
                
                currentHamburger.classList.remove('active');
                currentNavMenu.classList.remove('active');
                console.log('🔄 Menú cerrado por click fuera');
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const currentHamburger = document.querySelector('.hamburger');
                const currentNavMenu = document.querySelector('.nav-menu');
                
                if (currentHamburger && currentNavMenu) {
                    currentHamburger.classList.remove('active');
                    currentNavMenu.classList.remove('active');
                    console.log('⌨️ Menú cerrado con Escape');
                }
            }
        });
        
    }, 100); // Small delay to ensure DOM is ready
}
