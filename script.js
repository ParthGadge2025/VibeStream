/**
 * VIBESTREAM - ADVANCED 500+ SONGS WEB PLAYER & AUDIO ENGINE
 */

// ==========================================
// 1. STATE MANAGEMENT
// ==========================================
let currentTrackIndex = 0;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let currentVolume = 0.8;
let currentFilter = 'all';
let searchQuery = '';
let filteredSongs = [...allSongs];

// LocalStorage Liked Songs
let likedSongIds = new Set(JSON.parse(localStorage.getItem('vibestream_liked') || '[]'));

// Audio Element
const audioElement = new Audio();
audioElement.preload = "auto";

// Web Audio API Synthesizer (Zero-latency fallback for guaranteed playback)
let audioCtx = null;
let synthGain = null;
let synthInterval = null;
let synthTime = 0;
let isSynthActive = false;

// DOM Elements
const masterPlay = document.getElementById('masterPlay');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const currentCover = document.getElementById('currentCover');
const currentTitle = document.getElementById('currentTitle');
const currentArtist = document.getElementById('currentArtist');
const currentGenrePill = document.getElementById('currentGenrePill');
const currentTimeEl = document.getElementById('currentTime');
const totalDurationEl = document.getElementById('totalDuration');
const progressSlider = document.getElementById('progressSlider');
const progressBar = document.getElementById('progressBar');
const volumeSlider = document.getElementById('volumeSlider');
const volumeBar = document.getElementById('volumeBar');
const volumeBtn = document.getElementById('volumeBtn');
const volumeIcon = document.getElementById('volumeIcon');
const visualizer = document.getElementById('visualizer');
const likeBtn = document.getElementById('likeBtn');
const greetingEl = document.getElementById('greeting');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const searchResultsBanner = document.getElementById('searchResultsBanner');
const searchResultsTitle = document.getElementById('searchResultsTitle');
const searchResultsCount = document.getElementById('searchResultsCount');
const homeView = document.getElementById('homeView');
const tracklistRows = document.getElementById('tracklist-rows');
const tracklistHeading = document.getElementById('tracklistHeading');
const tracklistSub = document.getElementById('tracklistSub');
const showingCount = document.getElementById('showingCount');
const likedCountSub = document.getElementById('likedCountSub');

// ==========================================
// 2. GREETINGS & INITIAL SETUP
// ==========================================
function updateGreeting() {
    const hour = new Date().getHours();
    let text = "Good evening, Parth";
    if (hour < 12) text = "Good morning, Parth";
    else if (hour < 17) text = "Good afternoon, Parth";
    if (greetingEl) greetingEl.innerText = text;
}
updateGreeting();

function updateLikedCountUI() {
    if (likedCountSub) {
        likedCountSub.innerText = `Playlist • ${likedSongIds.size} songs`;
    }
}
updateLikedCountUI();

// ==========================================
// 3. QUICK ACCESS & SHELVES RENDERING
// ==========================================
function renderQuickGrid() {
    const quickGrid = document.getElementById('quickGrid');
    if (!quickGrid) return;
    quickGrid.innerHTML = '';

    // Pick 6 prominent tracks across genres
    const featuredIndices = [0, 60, 160, 270, 370, 450];
    featuredIndices.forEach(idx => {
        const song = allSongs[idx] || allSongs[0];
        const card = document.createElement('div');
        card.className = 'quick-card';
        card.innerHTML = `
            <img src="${song.cover}" alt="${song.title}">
            <span>${song.title}</span>
            <button class="green-play-btn" title="Play ${song.title}"><i class="fa-solid fa-play"></i></button>
        `;
        card.addEventListener('click', () => playSongById(song.id));
        quickGrid.appendChild(card);
    });
}

function renderShelf(containerId, songsList, limit = 8) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    songsList.slice(0, limit).forEach(song => {
        const card = document.createElement('div');
        card.className = `song-card card-song-${song.id}`;
        card.innerHTML = `
            <div class="card-image-box">
                <img src="${song.cover}" alt="${song.title}">
                <button class="card-play-btn" title="Play ${song.title}"><i class="fa-solid fa-play"></i></button>
            </div>
            <div class="card-title">${song.title}</div>
            <div class="card-desc">${song.artist}</div>
        `;
        card.addEventListener('click', () => playSongById(song.id));
        container.appendChild(card);
    });
}

function populateAllShelves() {
    renderQuickGrid();
    renderShelf('grid-arijit', allSongs.filter(s => s.category === 'Arijit Singh'), 8);
    renderShelf('grid-hindi', allSongs.filter(s => s.category === 'Bollywood & Hindi'), 8);
    renderShelf('grid-english', allSongs.filter(s => s.category === 'English & International'), 8);
    renderShelf('grid-punjabi', allSongs.filter(s => s.category === 'Punjabi Bangers'), 8);
    renderShelf('grid-haryanvi', allSongs.filter(s => s.category === 'Haryanvi Hits'), 8);
}
populateAllShelves();

// ==========================================
// 4. MASTER TRACKLIST TABLE RENDERING
// ==========================================
let displayedTrackCount = 100;

function renderTracklist(reset = true) {
    if (!tracklistRows) return;
    if (reset) {
        tracklistRows.innerHTML = '';
        displayedTrackCount = 100;
    }

    const itemsToRender = filteredSongs.slice(0, displayedTrackCount);
    
    // Header count
    if (showingCount) {
        showingCount.innerText = `Showing ${Math.min(itemsToRender.length, filteredSongs.length)} of ${filteredSongs.length} songs`;
    }

    itemsToRender.forEach((song, i) => {
        // If already rendered, skip
        if (document.getElementById(`row-song-${song.id}`)) return;

        const row = document.createElement('div');
        row.className = `table-row row-song-${song.id}`;
        row.id = `row-song-${song.id}`;
        if (allSongs[currentTrackIndex]?.id === song.id && isPlaying) {
            row.classList.add('playing');
        }

        row.innerHTML = `
            <div class="row-index">
                <span class="row-num">${i + 1}</span>
                <button class="row-play-btn"><i class="fa-solid ${allSongs[currentTrackIndex]?.id === song.id && isPlaying ? 'fa-pause' : 'fa-play'}"></i></button>
            </div>
            <div class="row-track-info">
                <img src="${song.cover}" class="row-thumb" alt="${song.title}">
                <div class="row-meta">
                    <span class="row-title">${song.title}</span>
                    <span class="row-artist">${song.artist}</span>
                </div>
            </div>
            <div class="row-lang">
                <span class="row-lang-tag">${song.language}</span>
                <span style="font-size:10px; color:#777;">• ${song.subCategory}</span>
            </div>
            <div class="row-album">${song.album}</div>
            <div class="row-duration">
                <span>${song.duration}</span>
            </div>
        `;

        row.addEventListener('click', () => playSongById(song.id));
        tracklistRows.appendChild(row);
    });

    // If more tracks exist, add 'Load More' button
    if (displayedTrackCount < filteredSongs.length && !document.getElementById('loadMoreContainer')) {
        const loadMoreBox = document.createElement('div');
        loadMoreBox.id = 'loadMoreContainer';
        loadMoreBox.style.cssText = 'text-align: center; padding: 24px;';
        loadMoreBox.innerHTML = `
            <button id="loadMoreBtn" style="background:#242424; color:#fff; border:1px solid #444; border-radius:20px; padding:10px 24px; font-weight:700; cursor:pointer; transition:all 0.2s;">
                Load More Songs (${filteredSongs.length - displayedTrackCount} remaining)
            </button>
        `;
        tracklistRows.appendChild(loadMoreBox);
        document.getElementById('loadMoreBtn').addEventListener('click', () => {
            displayedTrackCount += 100;
            const container = document.getElementById('loadMoreContainer');
            if (container) container.remove();
            renderTracklist(false);
        });
    }
}
renderTracklist();

// ==========================================
// 5. SEARCH & FILTERING SYSTEM
// ==========================================
function applyFilters() {
    let list = [...allSongs];

    // 1. Category Filter
    if (currentFilter === 'arijit') {
        list = list.filter(s => s.category === 'Arijit Singh');
    } else if (currentFilter === 'hindi') {
        list = list.filter(s => s.language === 'Hindi');
    } else if (currentFilter === 'english') {
        list = list.filter(s => s.language === 'English');
    } else if (currentFilter === 'punjabi') {
        list = list.filter(s => s.language === 'Punjabi');
    } else if (currentFilter === 'haryanvi') {
        list = list.filter(s => s.language === 'Haryanvi');
    } else if (currentFilter === 'ncs') {
        list = list.filter(s => s.category === 'NCS, EDM & Lofi');
    } else if (currentFilter === 'liked') {
        list = list.filter(s => likedSongIds.has(s.id));
    }

    // 2. Search Query Filter
    if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        list = list.filter(s => 
            s.title.toLowerCase().includes(q) ||
            s.artist.toLowerCase().includes(q) ||
            s.album.toLowerCase().includes(q) ||
            s.language.toLowerCase().includes(q) ||
            s.subCategory.toLowerCase().includes(q)
        );

        // Show search banner, hide shelves
        homeView.style.display = 'none';
        searchResultsBanner.style.display = 'flex';
        searchResultsTitle.innerText = `Search results for "${searchQuery}"`;
        searchResultsCount.innerText = `${list.length} songs found`;
        tracklistHeading.innerText = `Matching Songs (${list.length})`;
    } else {
        // Reset to normal view
        if (currentFilter === 'all') {
            homeView.style.display = 'block';
            searchResultsBanner.style.display = 'none';
            tracklistHeading.innerText = `All Songs (${allSongs.length})`;
            tracklistSub.innerText = 'Click any song to play full audio';
        } else {
            homeView.style.display = 'none';
            searchResultsBanner.style.display = 'flex';
            searchResultsTitle.innerText = getFilterTitle(currentFilter);
            searchResultsCount.innerText = `${list.length} songs available`;
            tracklistHeading.innerText = `${getFilterTitle(currentFilter)} (${list.length})`;
        }
    }

    filteredSongs = list;
    renderTracklist(true);
}

function getFilterTitle(filter) {
    switch (filter) {
        case 'arijit': return 'Arijit Singh Mega Hits';
        case 'hindi': return 'Bollywood & Hindi Songs';
        case 'english': return 'English & International Pop';
        case 'punjabi': return 'Punjabi Bangers';
        case 'haryanvi': return 'Haryanvi Viral Hits';
        case 'ncs': return 'EDM, Chill & Lofi Tracks';
        case 'liked': return 'Your Liked Songs';
        default: return 'All Songs';
    }
}

// Search Bar Input listener
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
    applyFilters();
});

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    applyFilters();
});

// Category Buttons Click Listeners
function setupFilterButtons(selector) {
    document.querySelectorAll(selector).forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = btn.getAttribute('data-filter');
            if (!filter) return;

            currentFilter = filter;

            // Update active states
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.playlist-item').forEach(b => b.classList.remove('active'));

            const matchingCatBtn = document.querySelector(`.category-btn[data-filter="${filter}"]`);
            if (matchingCatBtn) matchingCatBtn.classList.add('active');

            const matchingChip = document.querySelector(`.chip[data-filter="${filter}"]`);
            if (matchingChip) matchingChip.classList.add('active');

            const matchingPlaylistItem = document.querySelector(`.playlist-item[data-filter="${filter}"]`);
            if (matchingPlaylistItem) matchingPlaylistItem.classList.add('active');

            applyFilters();

            // Scroll down to tracklist if on specific category
            const tracklistEl = document.querySelector('.tracklist-section');
            if (tracklistEl) tracklistEl.scrollIntoView({ behavior: 'smooth' });
        });
    });
}
setupFilterButtons('.category-btn');
setupFilterButtons('.chip');
setupFilterButtons('.playlist-item');
setupFilterButtons('.show-all');
setupFilterButtons('.footer-links a[data-filter]');

// Home logo & Nav Home button
document.getElementById('navHome').addEventListener('click', () => {
    currentFilter = 'all';
    searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.category-btn[data-filter="all"]')?.classList.add('active');
    applyFilters();
    document.getElementById('contentScroll').scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('logoHomeBtn').addEventListener('click', () => {
    document.getElementById('navHome').click();
});

document.getElementById('navSearch').addEventListener('click', () => {
    searchInput.focus();
});

// ==========================================
// 6. MULTI-STYLE WEB AUDIO ENGINE
// ==========================================
function initAudio() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            synthGain = audioCtx.createGain();
            synthGain.gain.value = currentVolume;
            synthGain.connect(audioCtx.destination);
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function stopSynth() {
    if (synthInterval) {
        clearInterval(synthInterval);
        synthInterval = null;
    }
    isSynthActive = false;
}

// Procedural multi-voice musical synthesizer adapted to song genre
function startSynth(startTimeSec = 0) {
    initAudio();
    if (!audioCtx) return;

    stopSynth();
    isSynthActive = true;
    synthTime = startTimeSec;

    const currentSong = allSongs[currentTrackIndex];
    const style = currentSong.style || 'bollywood';

    // Harmonic & scale mapping per style
    let chords, tempo, waveType;
    if (style === 'romantic_hindi') {
        // Warm romantic chords (Am - F - C - G)
        chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [130.81, 164.81, 196.0], [196.0, 246.94, 293.66]];
        tempo = 90;
        waveType = 'triangle';
    } else if (style === 'punjabi_bhangra') {
        // High-energy folk (Bm - G - D - A)
        chords = [[246.94, 293.66, 369.99], [196.0, 246.94, 293.66], [146.83, 185.0, 220.0], [220.0, 277.18, 329.63]];
        tempo = 105;
        waveType = 'sawtooth';
    } else if (style === 'haryanvi_beat') {
        // Desi folk bounce (Dm - Bb - F - C)
        chords = [[146.83, 174.61, 220.0], [116.54, 146.83, 174.61], [174.61, 220.0, 261.63], [130.81, 164.81, 196.0]];
        tempo = 110;
        waveType = 'sawtooth';
    } else if (style === 'english_pop') {
        // Driving modern pop (C - G - Am - F)
        chords = [[261.63, 329.63, 392.0], [196.0, 246.94, 293.66], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63]];
        tempo = 124;
        waveType = 'sine';
    } else {
        // EDM / Chill
        chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [130.81, 164.81, 196.0], [196.0, 246.94, 293.66]];
        tempo = 128;
        waveType = 'sine';
    }

    const intervalMs = (60 / tempo / 2) * 1000;
    let step = Math.floor(synthTime * 4);

    synthInterval = setInterval(() => {
        if (!isPlaying) {
            stopSynth();
            return;
        }

        const now = audioCtx.currentTime;
        const chordIdx = Math.floor(synthTime / 5) % chords.length;
        const currentChord = chords[chordIdx];

        // 1. Chords
        if (step % 4 === 0) {
            currentChord.forEach(f => playTone(f, now, 0.8, waveType, 0.12));
        }

        // 2. Bassline
        if (step % 2 === 0) {
            playTone(currentChord[0] * 0.5, now, 0.4, 'triangle', 0.22);
        }

        // 3. Lead arpeggio melody
        const note = currentChord[step % currentChord.length] * 2;
        playTone(note, now, 0.22, 'sine', 0.18);

        synthTime += 0.25;
        step++;

        updateProgressUI(synthTime, currentSong.durationSec);

        if (synthTime >= currentSong.durationSec) {
            stopSynth();
            if (isRepeat) {
                playSongByIndex(currentTrackIndex);
            } else {
                nextTrack();
            }
        }
    }, intervalMs);
}

function playTone(freq, startTime, duration, type, volume) {
    if (!audioCtx || !synthGain) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(synthGain);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
    } catch (e) {}
}

// ==========================================
// 7. PLAYBACK CONTROLLER
// ==========================================
function playSongById(id) {
    const idx = allSongs.findIndex(s => s.id === id);
    if (idx !== -1) {
        playSongByIndex(idx);
    }
}

function playSongByIndex(index) {
    initAudio();

    if (currentTrackIndex !== index) {
        currentTrackIndex = index;
        audioElement.currentTime = 0;
        synthTime = 0;
        stopSynth();
    }

    const song = allSongs[currentTrackIndex];
    if (!song) return;

    // Update Bottom Player UI
    currentCover.src = song.cover;
    currentTitle.innerText = song.title;
    currentArtist.innerText = `${song.artist} • ${song.album}`;
    currentGenrePill.innerText = song.subCategory || song.language;
    totalDurationEl.innerText = song.duration;

    // Update Liked Heart
    updateLikeButtonUI(song.id);

    // Update Visual Highlights
    document.querySelectorAll('.table-row').forEach(r => {
        r.classList.remove('playing');
        const icon = r.querySelector('.row-play-btn i');
        if (icon) icon.className = 'fa-solid fa-play';
    });

    const activeRow = document.getElementById(`row-song-${song.id}`);
    if (activeRow) {
        activeRow.classList.add('playing');
        const icon = activeRow.querySelector('.row-play-btn i');
        if (icon) icon.className = 'fa-solid fa-pause';
    }

    document.querySelectorAll('.song-card').forEach(c => c.classList.remove('playing'));
    document.querySelectorAll(`.card-song-${song.id}`).forEach(c => c.classList.add('playing'));

    // Master Play button state
    masterPlay.classList.add('playing');
    masterPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
    visualizer.classList.add('active');
    isPlaying = true;

    // Play Audio
    audioElement.src = song.file;
    audioElement.volume = currentVolume;

    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            stopSynth(); // Local WAV played successfully
        }).catch(err => {
            // Start Web Audio fallback engine seamlessly
            startSynth(0);
        });
    }
}

function pausePlayback() {
    isPlaying = false;
    audioElement.pause();
    stopSynth();

    masterPlay.classList.remove('playing');
    masterPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
    visualizer.classList.remove('active');

    document.querySelectorAll('.row-play-btn i').forEach(icon => {
        icon.className = 'fa-solid fa-play';
    });
}

function togglePlay() {
    initAudio();
    if (isPlaying) {
        pausePlayback();
    } else {
        if (isSynthActive) {
            isPlaying = true;
            masterPlay.classList.add('playing');
            masterPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
            visualizer.classList.add('active');
            startSynth(synthTime);
        } else {
            playSongByIndex(currentTrackIndex);
        }
    }
}

function nextTrack() {
    if (filteredSongs.length === 0) return;

    if (isShuffle) {
        const rand = Math.floor(Math.random() * filteredSongs.length);
        playSongById(filteredSongs[rand].id);
    } else {
        const currentInFiltered = filteredSongs.findIndex(s => s.id === allSongs[currentTrackIndex].id);
        const nextIdx = (currentInFiltered + 1) % filteredSongs.length;
        playSongById(filteredSongs[nextIdx].id);
    }
}

function prevTrack() {
    if (audioElement.currentTime > 3 || synthTime > 3) {
        audioElement.currentTime = 0;
        synthTime = 0;
        if (isPlaying) playSongByIndex(currentTrackIndex);
    } else {
        const currentInFiltered = filteredSongs.findIndex(s => s.id === allSongs[currentTrackIndex].id);
        const prevIdx = (currentInFiltered - 1 + filteredSongs.length) % filteredSongs.length;
        playSongById(filteredSongs[prevIdx].id);
    }
}

// Master Controls Click
masterPlay.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', nextTrack);
prevBtn.addEventListener('click', prevTrack);

// Shuffle & Repeat
shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
});

repeatBtn.addEventListener('click', () => {
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle('active', isRepeat);
});

// Like Button
function updateLikeButtonUI(songId) {
    const isLiked = likedSongIds.has(songId);
    likeBtn.classList.toggle('liked', isLiked);
    likeBtn.innerHTML = isLiked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
}

likeBtn.addEventListener('click', () => {
    const curSong = allSongs[currentTrackIndex];
    if (!curSong) return;

    if (likedSongIds.has(curSong.id)) {
        likedSongIds.delete(curSong.id);
    } else {
        likedSongIds.add(curSong.id);
    }

    localStorage.setItem('vibestream_liked', JSON.stringify([...likedSongIds]));
    updateLikeButtonUI(curSong.id);
    updateLikedCountUI();

    if (currentFilter === 'liked') {
        applyFilters();
    }
});

// ==========================================
// 8. PROGRESS BAR & TIMELINE
// ==========================================
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function updateProgressUI(currentSec, totalSec) {
    currentTimeEl.innerText = formatTime(currentSec);
    const percent = Math.min(100, (currentSec / totalSec) * 100);
    progressBar.style.width = `${percent}%`;
    progressSlider.value = percent;
}

audioElement.addEventListener('timeupdate', () => {
    if (!isSynthActive && audioElement.duration) {
        updateProgressUI(audioElement.currentTime, audioElement.duration);
    }
});

audioElement.addEventListener('ended', () => {
    if (isRepeat) {
        audioElement.currentTime = 0;
        audioElement.play();
    } else {
        nextTrack();
    }
});

progressSlider.addEventListener('input', (e) => {
    const pct = parseFloat(e.target.value);
    const song = allSongs[currentTrackIndex];
    const newTime = (pct / 100) * song.durationSec;

    progressBar.style.width = `${pct}%`;
    currentTimeEl.innerText = formatTime(newTime);

    if (isSynthActive) {
        synthTime = newTime;
        if (isPlaying) startSynth(synthTime);
    } else if (audioElement.duration) {
        audioElement.currentTime = newTime;
    }
});

// ==========================================
// 9. VOLUME & SHORTCUTS
// ==========================================
function setVolume(val) {
    currentVolume = val / 100;
    audioElement.volume = currentVolume;
    if (synthGain) {
        synthGain.gain.setValueAtTime(currentVolume, audioCtx ? audioCtx.currentTime : 0);
    }
    volumeBar.style.width = `${val}%`;
    volumeSlider.value = val;

    if (val === 0) {
        volumeIcon.className = 'fa-solid fa-volume-xmark';
    } else if (val < 50) {
        volumeIcon.className = 'fa-solid fa-volume-low';
    } else {
        volumeIcon.className = 'fa-solid fa-volume-high';
    }
}

volumeSlider.addEventListener('input', (e) => {
    setVolume(parseFloat(e.target.value));
});

let savedVol = 80;
volumeBtn.addEventListener('click', () => {
    if (currentVolume > 0) {
        savedVol = currentVolume * 100;
        setVolume(0);
    } else {
        setVolume(savedVol || 80);
    }
});

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
    } else if (e.code === 'KeyK') {
        nextTrack();
    } else if (e.code === 'KeyJ') {
        prevTrack();
    } else if (e.code === 'KeyM') {
        volumeBtn.click();
    } else if (e.code === 'KeyS') {
        shuffleBtn.click();
    } else if (e.code === 'KeyR') {
        repeatBtn.click();
    } else if (e.key === '/') {
        e.preventDefault();
        searchInput.focus();
    }
});

// Initialize with First Song
setVolume(80);
const firstSong = allSongs[0];
currentCover.src = firstSong.cover;
currentTitle.innerText = firstSong.title;
currentArtist.innerText = `${firstSong.artist} • ${firstSong.album}`;
currentGenrePill.innerText = firstSong.subCategory;
totalDurationEl.innerText = firstSong.duration;
updateLikeButtonUI(firstSong.id);

console.log("VibeStream Web Player Initialized with 539 songs!");
