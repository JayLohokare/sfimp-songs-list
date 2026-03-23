document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('setup-modal');
    const apiKeyInput = document.getElementById('api-key-input');
    const sheetIdInput = document.getElementById('sheet-id-input');
    const saveSetupBtn = document.getElementById('save-setup-btn');
    const setupError = document.getElementById('setup-error');
    const dashboard = document.getElementById('main-dashboard');
    
    // UI Elements
    const timeDisplay = document.getElementById('current-time');
    const currentSongTitle = document.getElementById('current-song-title');
    const currentTimeBlock = document.getElementById('current-time-block');
    const currentSongIndexBadge = document.getElementById('current-song-index');
    const participantsList = document.getElementById('participants-list');
    const nextSongTitle = document.getElementById('next-song-title');
    const nextSongParticipants = document.getElementById('next-song-participants');
    
    // Buttons
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    let songsData = [];
    let currentSongIndex = 0;

    // Default Credentials provided by User
    const DEFAULT_API_KEY = 'AIzaSyBjsGXUIx6AtPhdQZbIgA91caX4hiwvsc0';
    const DEFAULT_SHEET_ID = '1k4K0GZVevtR5LLULmBZhD9g_nQ0WcB_C-jkaS3Baf0U';

    // Check localStorage or use defaults
    const savedApiKey = localStorage.getItem('sfimpApiKey') || DEFAULT_API_KEY;
    const savedSheetId = localStorage.getItem('sfimpSheetId') || DEFAULT_SHEET_ID;

    apiKeyInput.value = savedApiKey;
    sheetIdInput.value = savedSheetId;
    
    // Automatically fetch on load
    fetchSheetData(savedApiKey, savedSheetId);

    saveSetupBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        const sheetId = sheetIdInput.value.trim();
        
        if (!apiKey || !sheetId) {
            setupError.textContent = "Please provide both API Key and Sheet ID.";
            setupError.style.display = "block";
            return;
        }

        setupError.style.display = "none";
        saveSetupBtn.textContent = "Connecting...";
        
        localStorage.setItem('sfimpApiKey', apiKey);
        localStorage.setItem('sfimpSheetId', sheetId);
        
        fetchSheetData(apiKey, sheetId);
    });

    function cleanSheetId(input) {
        if (input.includes('/d/')) {
            const match = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (match && match[1]) return match[1];
        }
        return input;
    }

    async function fetchSheetData(apiKey, sheetIdRaw) {
        const sheetId = cleanSheetId(sheetIdRaw);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A2:Z?key=${apiKey}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            parseData(data.values);
            modal.classList.remove('active');
            dashboard.classList.remove('is-loading');
            saveSetupBtn.textContent = "Connect";
        } catch (error) {
            console.error("Error fetching data:", error);
            setupError.textContent = "Error: " + error.message;
            setupError.style.display = "block";
            saveSetupBtn.textContent = "Connect";
            modal.classList.add('active');
        }
    }

    function parseData(rows) {
        songsData = [];
        let currentTimeBlockStr = "";

        const instrumentKeys = [
            { index: 4, name: 'Vocals' },
            { index: 5, name: 'Drums' },
            { index: 6, name: 'Keys / Synth' },
            { index: 7, name: 'Guitar 1' },
            { index: 8, name: 'Guitar 2' },
            { index: 9, name: 'Acoustic Guitar' },
            { index: 10, name: 'Bass' },
            { index: 11, name: 'Others' }
        ];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            if (row[0] && row[0].trim() !== '') {
                currentTimeBlockStr = row[0].trim();
            }

            const songName = row[2] ? row[2].trim() : '';
            const songNum = row[1] ? row[1].trim() : '';
            
            if (songName && songName.toLowerCase() !== 'tbd') {
                let participants = [];
                for (let inst of instrumentKeys) {
                    if (row[inst.index] && row[inst.index].trim() !== '') {
                        participants.push({
                            role: inst.name,
                            name: row[inst.index].trim()
                        });
                    }
                }
                
                songsData.push({
                    timeBlock: currentTimeBlockStr,
                    number: songNum,
                    title: songName,
                    participants: participants
                });
            }
        }

        if (songsData.length > 0) {
            currentSongIndex = 0;
            renderSong();
        } else {
            currentSongTitle.textContent = "No valid songs found";
        }
    }

    function renderSong() {
        if (!songsData || songsData.length === 0) return;
        
        const song = songsData[currentSongIndex];
        const currentSlotSongs = songsData.filter(s => s.timeBlock === song.timeBlock);
        const slotSongIndex = currentSlotSongs.indexOf(song) + 1;
        const totalInSlot = currentSlotSongs.length;
        const timeBlockStr = song.timeBlock || 'TBD Time';
        
        currentSongTitle.textContent = song.title;
        currentTimeBlock.textContent = timeBlockStr;
        currentSongIndexBadge.innerHTML = `${timeBlockStr} <span style="opacity:0.4; margin:0 6px;">|</span> ${slotSongIndex}/${totalInSlot}`;
        
        participantsList.innerHTML = '';
        song.participants.forEach(p => {
            const div = document.createElement('div');
            div.className = 'participant-tag';
            div.innerHTML = `
                <span class="p-role">${p.role}</span>
                <span class="p-name">${p.name}</span>
            `;
            participantsList.appendChild(div);
        });

        if (currentSongIndex < songsData.length - 1) {
            const next = songsData[currentSongIndex + 1];
            nextSongTitle.textContent = next.title;
            if (next.participants && next.participants.length > 0) {
                nextSongParticipants.innerHTML = next.participants.map(p => `<div class="participant-pill"><span class="pill-role">${p.role}</span> ${p.name}</div>`).join('');
            } else {
                nextSongParticipants.innerHTML = '';
            }
        } else {
            nextSongTitle.textContent = "End of Jam Session!";
            nextSongParticipants.innerHTML = '';
        }

        prevBtn.style.opacity = currentSongIndex === 0 ? "0.3" : "1";
        prevBtn.style.pointerEvents = currentSongIndex === 0 ? "none" : "auto";
        
        nextBtn.style.opacity = currentSongIndex === songsData.length - 1 ? "0.3" : "1";
        nextBtn.style.pointerEvents = currentSongIndex === songsData.length - 1 ? "none" : "auto";
    }

    prevBtn.addEventListener('click', () => {
        if (currentSongIndex > 0) {
            currentSongIndex--;
            renderSong();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentSongIndex < songsData.length - 1) {
            currentSongIndex++;
            renderSong();
        }
    });

    function updateTime() {
        const now = new Date();
        const ptTime = now.toLocaleTimeString('en-US', {
            timeZone: 'America/Los_Angeles',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        timeDisplay.textContent = ptTime + ' PT';
    }
    
    updateTime();
    setInterval(updateTime, 60000);
});
