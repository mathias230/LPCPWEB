// DOM Elements
const navbar = document.querySelector('.navbar');
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');
const scrollIndicator = document.querySelector('.scroll-indicator');

// Navbar scroll effect
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle (with null check)
if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });
}

// Navigation handling is done in initializeNavigation() function below

// Smooth scrolling for navigation links
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            
            // Only prevent default for internal anchor links (starting with #)
            if (href.startsWith('#')) {
                e.preventDefault();
                
                // Close mobile menu if open
                const hamburger = document.querySelector('.hamburger');
                const navMenu = document.querySelector('.nav-menu');
                if (hamburger && navMenu) {
                    hamburger.classList.remove('active');
                    navMenu.classList.remove('active');
                }
                
                const targetSection = document.querySelector(href);
                
                if (targetSection) {
                    const offsetTop = targetSection.offsetTop - 80;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                } else {
                    console.warn('Section not found:', href);
                }
            } else {
                // For external links (like clips.html, standings.html), just close mobile menu
                const hamburger = document.querySelector('.hamburger');
                const navMenu = document.querySelector('.nav-menu');
                if (hamburger && navMenu) {
                    hamburger.classList.remove('active');
                    navMenu.classList.remove('active');
                }
                // Let the browser handle the navigation naturally
            }
        });
    });
}

// Initialize navigation when DOM is ready
initializeNavigation();

// Scroll indicator click (with null check)
if (scrollIndicator) {
    scrollIndicator.addEventListener('click', () => {
        const aboutSection = document.querySelector('#liga');
        if (aboutSection) {
            const offsetTop = aboutSection.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
}

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            
            // Special animations for specific elements
            if (entry.target.classList.contains('feature-item')) {
                entry.target.style.animationDelay = `${Math.random() * 0.5}s`;
                entry.target.style.animation = 'fadeInUp 0.8s ease-out forwards';
            }
            
            if (entry.target.classList.contains('club-card')) {
                entry.target.style.animationDelay = `${Math.random() * 0.3}s`;
                entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
            }
            
            if (entry.target.classList.contains('timeline-item')) {
                entry.target.style.animationDelay = `${Array.from(entry.target.parentNode.children).indexOf(entry.target) * 0.2}s`;
                entry.target.style.animation = 'fadeInUp 0.7s ease-out forwards';
            }
        }
    });
}, observerOptions);

// Observe elements for scroll animations
const animatedElements = document.querySelectorAll('.feature-item, .club-card, .clip-card, .timeline-item, .contact-item, .section-title');
animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Parallax effect for hero background
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.floating-particles, .grid-overlay');
    
    parallaxElements.forEach(element => {
        const speed = 0.5;
        element.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// Dynamic particle generation
function createParticles() {
    const particleContainer = document.querySelector('.floating-particles');
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'dynamic-particle';
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 4 + 1}px;
            height: ${Math.random() * 4 + 1}px;
            background: ${Math.random() > 0.5 ? '#00d4ff' : '#ffd700'};
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            opacity: ${Math.random() * 0.8 + 0.2};
            animation: floatParticle ${Math.random() * 10 + 5}s linear infinite;
        `;
        particleContainer.appendChild(particle);
    }
}

// Add floating particle animation
const style = document.createElement('style');
style.textContent = `
    @keyframes floatParticle {
        0% {
            transform: translateY(0px) translateX(0px) rotate(0deg);
            opacity: 0;
        }
        10% {
            opacity: 1;
        }
        90% {
            opacity: 1;
        }
        100% {
            transform: translateY(-100vh) translateX(${Math.random() * 200 - 100}px) rotate(360deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Counter animation for stats
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');
    
    counters.forEach(counter => {
        const target = parseInt(counter.textContent);
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;
        
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            counter.textContent = Math.floor(current);
        }, 16);
    });
}

// Glitch effect for title
function createGlitchEffect() {
    const title = document.querySelector('.hero-title');
    const glitchChars = '!<>-_\\/[]{}—=+*^?#________';
    
    setInterval(() => {
        if (Math.random() > 0.95) {
            const originalText = title.textContent;
            const glitchedText = originalText
                .split('')
                .map(char => Math.random() > 0.9 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : char)
                .join('');
            
            title.textContent = glitchedText;
            
            setTimeout(() => {
                title.textContent = originalText;
            }, 50);
        }
    }, 3000);
}

// Mouse trail effect
let mouseTrail = [];
const maxTrailLength = 20;

document.addEventListener('mousemove', (e) => {
    mouseTrail.push({ x: e.clientX, y: e.clientY, time: Date.now() });
    
    if (mouseTrail.length > maxTrailLength) {
        mouseTrail.shift();
    }
    
    updateMouseTrail();
});

function updateMouseTrail() {
    const existingTrails = document.querySelectorAll('.mouse-trail');
    existingTrails.forEach(trail => trail.remove());
    
    mouseTrail.forEach((point, index) => {
        const trail = document.createElement('div');
        trail.className = 'mouse-trail';
        trail.style.cssText = `
            position: fixed;
            width: ${(index + 1) * 2}px;
            height: ${(index + 1) * 2}px;
            background: radial-gradient(circle, rgba(0, 212, 255, ${(index + 1) / maxTrailLength * 0.5}), transparent);
            border-radius: 50%;
            left: ${point.x}px;
            top: ${point.y}px;
            pointer-events: none;
            z-index: 9999;
            transform: translate(-50%, -50%);
            transition: opacity 0.1s ease;
        `;
        document.body.appendChild(trail);
        
        setTimeout(() => {
            if (trail.parentNode) {
                trail.remove();
            }
        }, 100);
    });
}

// Typing effect for hero subtitle
function typeWriter(element, text, speed = 100) {
    element.textContent = '';
    let i = 0;
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// 3D tilt effect for cards
function addTiltEffect() {
    const cards = document.querySelectorAll('.club-card, .feature-item');
    
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
        });
    });
}

// Typewriter effect for main title
function typeWriterTitle(element, text, speed = 100) {
    element.textContent = '';
    let i = 0;
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Re-initialize navigation to ensure it works
    initializeNavigation();
    
    // Create particles
    createParticles();
    
    // Start counter animation after a delay
    setTimeout(animateCounters, 2000);
    
    // Add glitch effect
    createGlitchEffect();
    
    // Add tilt effect to cards
    addTiltEffect();
    
    // Load recent clips for homepage preview
    loadRecentClipsPreview();
    
    // Typewriter effect for main title
    const mainTitle = document.querySelector('.typewriter-text');
    const titleText = 'AMERICA PRO CLUBS';
    setTimeout(() => {
        typeWriterTitle(mainTitle, titleText, 120);
    }, 800);
    
    // Typing effect for subtitle
    const subtitle = document.querySelector('.hero-subtitle');
    const originalText = subtitle.textContent;
    setTimeout(() => {
        typeWriter(subtitle, originalText, 80);
    }, 4000); // Delayed to start after title finishes
    
    // Add loading animation
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 1s ease';
        document.body.style.opacity = '1';
    }, 100);
});

// Performance optimization: throttle scroll events
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Apply throttling to scroll events
window.addEventListener('scroll', throttle(() => {
    // Scroll-based animations here
}, 16));

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    }
});

// Preload critical resources
function preloadResources() {
    const criticalFonts = [
        'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600;700&display=swap'
    ];
    
    criticalFonts.forEach(font => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = font;
        link.as = 'style';
        document.head.appendChild(link);
    });
}

preloadResources();

// Function to load recent clips for homepage preview
async function loadRecentClipsPreview() {
    const previewContainer = document.getElementById('recentClipsPreview');
    if (!previewContainer) return;
    
    try {
        // Try to fetch from server first
        const response = await fetch('/api/clips/recent?limit=3');
        
        if (response.ok) {
            const clips = await response.json();
            
            if (clips && clips.length > 0) {
                // Display real clips from server
                displayRecentClips(clips);
            } else {
                // Show message when no clips exist
                showNoClipsMessage();
            }
        } else {
            // If server error, show message instead of placeholders
            showNoClipsMessage();
        }
    } catch (error) {
        console.log('Error loading clips:', error);
        // Show message instead of placeholders when there's an error
        showNoClipsMessage();
    }
}

function displayRecentClips(clips) {
    const previewContainer = document.getElementById('recentClipsPreview');
    
    previewContainer.innerHTML = clips.map(clip => `
        <div class="clip-card" data-clip-id="${clip.id}">
            <div class="clip-thumbnail">
                ${clip.thumbnail ? 
                    `<img src="${clip.thumbnail}" alt="${clip.title}" />` : 
                    '<i class="fas fa-play-circle"></i>'
                }
                <div class="clip-overlay">
                    <span class="clip-duration">${formatDuration(clip.duration || 0)}</span>
                </div>
            </div>
            <div class="clip-info">
                <h4>${clip.title}</h4>
                <p>${clip.description}</p>
                <div class="clip-meta">
                    <span class="clip-club">
                        <i class="fas fa-shield-alt"></i>
                        ${clip.club}
                    </span>
                    <span class="clip-date">
                        <i class="fas fa-calendar"></i>
                        ${formatDate(clip.created_at)}
                    </span>
                </div>
                <div class="clip-stats">
                    <span><i class="fas fa-eye"></i> ${formatNumber(clip.views || 0)}</span>
                    <span><i class="fas fa-heart"></i> ${formatNumber(clip.likes || 0)}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers for clips
    previewContainer.querySelectorAll('.clip-card').forEach(card => {
        card.addEventListener('click', () => {
            const clipId = card.dataset.clipId;
            // Redirect to clips page with specific clip
            window.location.href = `clips.html?clip=${clipId}`;
        });
    });
}

function showNoClipsMessage() {
    const previewContainer = document.getElementById('recentClipsPreview');
    previewContainer.innerHTML = `
        <div class="no-clips-message">
            <i class="fas fa-video"></i>
            <h3>No hay clips recientes</h3>
            <p>Los clips más recientes aparecerán aquí. Visita la sección de clips para ver más contenido.</p>
            <a href="clips.html" class="btn-primary">
                <i class="fas fa-video"></i>
                Ver Todos los Clips
            </a>
        </div>
    `;
}

function showPlaceholderClips() {
    const previewContainer = document.getElementById('recentClipsPreview');
    previewContainer.innerHTML = `
        <div class="clip-card">
            <div class="clip-thumbnail">
                <i class="fas fa-play-circle"></i>
                <div class="clip-overlay">
                    <span class="clip-duration">0:45</span>
                </div>
            </div>
            <div class="clip-info">
                <h4>Gol espectacular de ACP 507</h4>
                <p>Jugada increíble en el último minuto</p>
                <div class="clip-stats">
                    <span><i class="fas fa-eye"></i> 1.2K</span>
                    <span><i class="fas fa-heart"></i> 89</span>
                </div>
            </div>
        </div>
        
        <div class="clip-card">
            <div class="clip-thumbnail">
                <i class="fas fa-play-circle"></i>
                <div class="clip-overlay">
                    <span class="clip-duration">1:12</span>
                </div>
            </div>
            <div class="clip-info">
                <h4>Atajada del siglo - Punta Coco FC</h4>
                <p>El portero salva el partido con esta atajada</p>
                <div class="clip-stats">
                    <span><i class="fas fa-eye"></i> 2.1K</span>
                    <span><i class="fas fa-heart"></i> 156</span>
                </div>
            </div>
        </div>
        
        <div class="clip-card">
            <div class="clip-thumbnail">
                <i class="fas fa-play-circle"></i>
                <div class="clip-overlay">
                    <span class="clip-duration">0:38</span>
                </div>
            </div>
            <div class="clip-info">
                <h4>Jugada colectiva - Tiki Taka FC</h4>
                <p>30 pases consecutivos terminan en gol</p>
                <div class="clip-stats">
                    <span><i class="fas fa-eye"></i> 890</span>
                    <span><i class="fas fa-heart"></i> 67</span>
                </div>
            </div>
        </div>
    `;
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Hace 1 día';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.ceil(diffDays / 7)} semanas`;
    return date.toLocaleDateString('es-ES');
}
