document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('setup-modal');
    const sheetIdInput = document.getElementById('sheet-id-input');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveSetupBtn = document.getElementById('save-setup-btn');
    const closeSetupBtn = document.getElementById('close-setup-btn');
    const setupError = document.getElementById('setup-error');
    const dashboard = document.getElementById('main-dashboard');
    const settingsBtn = document.getElementById('settings-btn');
    const splitScreenCheckbox = document.getElementById('split-screen-checkbox');
    const splitToggleContainer = document.getElementById('split-toggle-container');
    
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
    const prevSlotBtn = document.getElementById('prev-slot-btn');
    const nextSlotBtn = document.getElementById('next-slot-btn');
    let songsData = [];
    let currentSongIndex = 0;
    let userSplitScreenPref = null;

    function isSplitScreenEnabled() {
        if (userSplitScreenPref !== null) return userSplitScreenPref;
        return window.innerWidth > 992;
    }

    if (splitScreenCheckbox) {
        splitScreenCheckbox.checked = isSplitScreenEnabled();
        
        const applySplitPref = () => {
            userSplitScreenPref = splitScreenCheckbox.checked;
            if (songsData && songsData.length > 0) renderSong();
        };

        splitScreenCheckbox.addEventListener('change', applySplitPref);

        // Allow clicking the container to toggle checkbox
        if (splitToggleContainer) {
            splitToggleContainer.addEventListener('click', (e) => {
                if (e.target !== splitScreenCheckbox) {
                    splitScreenCheckbox.checked = !splitScreenCheckbox.checked;
                    applySplitPref();
                }
            });
        }
        
        window.addEventListener('resize', () => {
            if (userSplitScreenPref === null) {
                splitScreenCheckbox.checked = isSplitScreenEnabled();
                if (songsData && songsData.length > 0) renderSong();
            }
        });
    }

    const DEFAULT_API_KEY = 'AIzaSyBjsGXUIx6AtPhdQZbIgA91caX4hiwvsc0';
    const savedSheetId = localStorage.getItem('sfimpSheetId');
    const savedApiKey = localStorage.getItem('sfimpApiKey');

    if (savedSheetId) {
        sheetIdInput.value = savedSheetId;
        if (savedApiKey) apiKeyInput.value = savedApiKey;
        fetchSheetData(savedApiKey || DEFAULT_API_KEY, savedSheetId);
    } else {
        if (savedApiKey) apiKeyInput.value = savedApiKey;
        modal.classList.add('active');
        dashboard.classList.add('is-loading');
    }

    saveSetupBtn.addEventListener('click', () => {
        const sheetIdRaw = sheetIdInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        
        if (!sheetIdRaw) {
            setupError.textContent = "Please provide a Sheet ID or URL.";
            setupError.style.display = "block";
            return;
        }

        setupError.style.display = "none";
        saveSetupBtn.textContent = "Loading...";
        
        const sheetId = cleanSheetId(sheetIdRaw);
        
        localStorage.setItem('sfimpSheetId', sheetId);
        if (apiKey) {
            localStorage.setItem('sfimpApiKey', apiKey);
        } else {
            localStorage.removeItem('sfimpApiKey');
        }
        
        if (splitScreenCheckbox) {
            userSplitScreenPref = splitScreenCheckbox.checked;
        }
        modal.classList.remove('active');
        
        fetchSheetData(apiKey || DEFAULT_API_KEY, sheetId);
    });

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            modal.classList.add('active');
            if (songsData && songsData.length > 0) {
                if (closeSetupBtn) closeSetupBtn.style.display = 'block';
            }
        });
    }

    if (closeSetupBtn) {
        closeSetupBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

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

        if (!rows || rows.length === 0) return;

        const headers = rows[0] || [];
        const instrumentKeys = [];
        const metadataKeys = [];
        for (let col = 3; col < headers.length; col++) {
            const headerName = headers[col] ? headers[col].trim() : '';
            if (headerName) {
                const lowerName = headerName.toLowerCase();
                const isMetadata = ['scale', 'link', 'detail', 'refer', 'note'].some(keyword => lowerName.includes(keyword));
                if (isMetadata) {
                    metadataKeys.push({ index: col, name: headerName });
                } else {
                    instrumentKeys.push({ index: col, name: headerName });
                }
            }
        }

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            if (row[0] && row[0].trim() !== '') {
                currentTimeBlockStr = row[0].trim();
            }

            const songName = row[2] ? row[2].trim() : '';
            const songNum = row[1] ? row[1].trim() : '';
            
            if (songNum !== '' || songName !== '') {
                let participants = [];
                for (let inst of instrumentKeys) {
                    if (row[inst.index] && row[inst.index].trim() !== '') {
                        participants.push({
                            role: inst.name,
                            name: row[inst.index].trim()
                        });
                    }
                }

                let details = [];
                for (let meta of metadataKeys) {
                    if (row[meta.index] && row[meta.index].trim() !== '') {
                        details.push({
                            label: meta.name,
                            value: row[meta.index].trim()
                        });
                    }
                }
                
                songsData.push({
                    timeBlock: currentTimeBlockStr,
                    number: songNum,
                    title: songName || 'TBD',
                    participants: participants,
                    details: details
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
        
        const linksContainer = document.getElementById('song-links-container');
        const subheaderElem = document.getElementById('song-subheader');
        const otherMetaContainer = document.getElementById('other-meta-container');

        let subheaderText = [];
        let linksHtml = '';
        let otherMetaHtml = [];
        let firstEmbedUrl = null;
        let firstEmbedUrlRaw = null;

        if (song.details && song.details.length > 0) {
            song.details.forEach(detail => {
                const lowerLabel = detail.label.toLowerCase();
                let val = detail.value;
                const urlRegex = /(https?:\/\/[^\s]+)/g;

                if (lowerLabel.includes('link')) {
                    const urls = val.match(urlRegex);
                    if (urls) {
                        urls.forEach((url, idx) => {
                            if (!firstEmbedUrl) {
                                firstEmbedUrl = url;
                                firstEmbedUrlRaw = url;
                            }
                            linksHtml += `<a href="${url}" target="_blank" class="nav-btn button-secondary" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; border-color: var(--border-color); color: var(--text-primary); margin-top:4px;">
                                Chords
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            </a>`;
                        });
                    } else if (val.trim()) {
                         subheaderText.push(val);
                    }
                } else if (lowerLabel.includes('detail') || lowerLabel.includes('refer') || lowerLabel.includes('note')) {
                     if (urlRegex.test(val)) {
                         val = val.replace(urlRegex, '<a href="$1" target="_blank" style="color: var(--accent-orange); text-decoration: underline;">URL</a>');
                     }
                     subheaderText.push(val);
                } else {
                     if (urlRegex.test(val)) {
                         val = val.replace(urlRegex, '<a href="$1" target="_blank" style="color: var(--accent-orange); text-decoration: underline;">URL</a>');
                     }
                     otherMetaHtml.push(`<span style="color: var(--text-secondary); font-weight: 800; font-family: Montserrat, sans-serif; font-size: 0.75rem; text-transform: uppercase;">${detail.label}</span> <span style="font-weight: 600; color: var(--text-primary);">${val}</span>`);
                }
            });
        }

        if (linksContainer) {
            linksContainer.innerHTML = linksHtml;
            linksContainer.style.display = linksHtml ? 'flex' : 'none';
        }
        
        if (subheaderElem) {
            if (subheaderText.length > 0) {
                subheaderElem.innerHTML = subheaderText.join(' <span style="color:var(--border-color); margin:0 8px;">|</span> ');
                subheaderElem.style.display = 'block';
            } else {
                subheaderElem.style.display = 'none';
            }
        }
        
        if (otherMetaContainer) {
            if (otherMetaHtml.length > 0) {
                otherMetaContainer.innerHTML = otherMetaHtml.join(' <span style="color:var(--border-color); margin:0 8px;">|</span> ');
                otherMetaContainer.style.display = 'inline-block';
            } else {
                otherMetaContainer.style.display = 'none';
            }
        }

        const splitView = document.getElementById('app-split-view');
        const mediaIframe = document.getElementById('fullscreen-media-iframe');
        const externalLinkBtn = document.getElementById('app-right-external-link');
        const fallbackMsg = document.getElementById('media-fallback-message');
        const fallbackTitle = document.getElementById('fallback-title');
        
        if (firstEmbedUrl && splitView && mediaIframe && isSplitScreenEnabled()) {
            let embedSrc = firstEmbedUrl;
            let isBlocked = false;
            
            if (embedSrc.includes('youtube.com/watch')) {
                try {
                    const urlParams = new URLSearchParams(embedSrc.split('?')[1]);
                    if (urlParams.has('v')) {
                        embedSrc = `https://www.youtube.com/embed/${urlParams.get('v')}`;
                    }
                } catch(e) {}
            } else if (embedSrc.includes('youtu.be/')) {
                const videoId = embedSrc.split('youtu.be/')[1].split('?')[0];
                embedSrc = `https://www.youtube.com/embed/${videoId}`;
            } else if (embedSrc.includes('drive.google.com/file/d/')) {
                embedSrc = embedSrc.replace('/view', '/preview').split('?')[0] + '/preview';
            } else if (embedSrc.includes('ultimate-guitar.com')) {
                // Extension installed - attempt to render
                if (fallbackTitle) fallbackTitle.textContent = "Ultimate Guitar Tab";
            } else if (embedSrc.includes('songsterr.com')) {
                if (fallbackTitle) fallbackTitle.textContent = "Songsterr Tab";
            } else if (embedSrc.includes('docs.google.com') && !embedSrc.includes('/pub')) {
                if (fallbackTitle) fallbackTitle.textContent = "Google Document";
            } else {
                if (fallbackTitle) fallbackTitle.textContent = "External Reference";
            }
            
            if (isBlocked && fallbackMsg) {
                mediaIframe.style.display = 'none';
                mediaIframe.src = '';
                fallbackMsg.style.display = 'flex';
            } else {
                mediaIframe.style.display = 'block';
                mediaIframe.src = embedSrc;
                if (fallbackMsg) fallbackMsg.style.display = 'none';
            }
            
            if (externalLinkBtn && firstEmbedUrlRaw) {
                externalLinkBtn.href = firstEmbedUrlRaw;
            }
            
            splitView.classList.add('is-split');
            document.body.classList.add('split-active');
        } else if (splitView) {
            if (mediaIframe) {
                mediaIframe.src = '';
                mediaIframe.style.display = 'none';
            }
            if (fallbackMsg) fallbackMsg.style.display = 'none';
            splitView.classList.remove('is-split');
            document.body.classList.remove('split-active');
        }

        participantsList.innerHTML = '';
        song.participants.forEach(p => {
            const div = document.createElement('div');
            div.className = 'participant-tag';
            
            let formattedName = p.name;
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            if (urlRegex.test(formattedName)) {
                formattedName = formattedName.replace(urlRegex, '<a href="$1" target="_blank" title="Link" style="color: inherit; text-decoration: none; margin-left: 4px;">🔗</a>');
            }

            div.innerHTML = `
                <span class="p-role">${p.role}</span>
                <span class="p-name">${formattedName}</span>
            `;
            participantsList.appendChild(div);
        });

        if (currentSongIndex < songsData.length - 1) {
            const next = songsData[currentSongIndex + 1];
            nextSongTitle.textContent = next.title;
            if (next.participants && next.participants.length > 0) {
                nextSongParticipants.innerHTML = next.participants.map(p => {
                    let formattedName = p.name;
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    if (urlRegex.test(formattedName)) {
                        formattedName = formattedName.replace(urlRegex, '<a href="$1" target="_blank" title="Link" style="color: inherit; text-decoration: none; margin-left: 4px;">🔗</a>');
                    }
                    return `<div class="participant-pill"><span class="pill-role">${p.role}</span> ${formattedName}</div>`;
                }).join('');
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
        
        const prevSlotIdx = getPrevSlotIndex();
        const nextSlotIdx = getNextSlotIndex();
        
        prevSlotBtn.style.opacity = prevSlotIdx === -1 ? "0.3" : "1";
        prevSlotBtn.style.pointerEvents = prevSlotIdx === -1 ? "none" : "auto";
        
        nextSlotBtn.style.opacity = nextSlotIdx === -1 ? "0.3" : "1";
        nextSlotBtn.style.pointerEvents = nextSlotIdx === -1 ? "none" : "auto";
    }

    function getPrevSlotIndex() {
        if (!songsData.length) return -1;
        const currentSlot = songsData[currentSongIndex].timeBlock;
        for(let i = currentSongIndex - 1; i >= 0; i--) {
            if(songsData[i].timeBlock !== currentSlot) {
                const prevSlotName = songsData[i].timeBlock;
                let firstOfPrev = i;
                for(let j=i; j>=0; j--) {
                    if(songsData[j].timeBlock === prevSlotName) {
                        firstOfPrev = j;
                    } else {
                        break;
                    }
                }
                return firstOfPrev;
            }
        }
        return -1;
    }

    function getNextSlotIndex() {
        if (!songsData.length) return -1;
        const currentSlot = songsData[currentSongIndex].timeBlock;
        for(let i = currentSongIndex + 1; i < songsData.length; i++) {
            if(songsData[i].timeBlock !== currentSlot) {
                return i;
            }
        }
        return -1;
    }

    prevSlotBtn.addEventListener('click', () => {
        const idx = getPrevSlotIndex();
        if(idx !== -1) {
            currentSongIndex = idx;
            renderSong();
        }
    });

    nextSlotBtn.addEventListener('click', () => {
        const idx = getNextSlotIndex();
        if(idx !== -1) {
            currentSongIndex = idx;
            renderSong();
        }
    });

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

    // =====================
    // COUNTDOWN TIMER
    // =====================
    const timerDisplay = document.getElementById('timer-display');
    const timerStartBtn = document.getElementById('timer-start');
    const timerPauseBtn = document.getElementById('timer-pause');
    const timerResetBtn = document.getElementById('timer-reset');
    
    let timerSeconds = parseInt(localStorage.getItem('sfimpTimerSeconds')) || 300; // Default 5:00
    let timerInterval = null;
    let timerRunning = localStorage.getItem('sfimpTimerRunning') === 'true';
    let timerEndTime = parseInt(localStorage.getItem('sfimpTimerEndTime')) || 0;

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function saveTimerState() {
        localStorage.setItem('sfimpTimerSeconds', timerSeconds);
        localStorage.setItem('sfimpTimerRunning', timerRunning);
        if (timerRunning && timerEndTime) {
            localStorage.setItem('sfimpTimerEndTime', timerEndTime);
        } else {
            localStorage.removeItem('sfimpTimerEndTime');
        }
    }

    function updateTimerDisplay() {
        timerDisplay.textContent = formatTime(timerSeconds);
    }

    function tick() {
        if (timerRunning && timerEndTime) {
            const now = Date.now();
            timerSeconds = Math.max(0, Math.ceil((timerEndTime - now) / 1000));
            
            if (timerSeconds <= 0) {
                timerSeconds = 0;
                pauseTimer();
                // Optional: alert or visual feedback when timer hits zero
            }
        }
        updateTimerDisplay();
    }

    function startTimer() {
        if (timerRunning) return;
        
        timerRunning = true;
        timerEndTime = Date.now() + (timerSeconds * 1000);
        timerStartBtn.style.display = 'none';
        timerPauseBtn.style.display = 'inline-flex';
        
        timerInterval = setInterval(tick, 100);
        saveTimerState();
    }

    function pauseTimer() {
        if (!timerRunning) return;
        
        timerRunning = false;
        clearInterval(timerInterval);
        timerInterval = null;
        timerStartBtn.style.display = 'inline-flex';
        timerPauseBtn.style.display = 'none';
        saveTimerState();
    }

    function resetTimer() {
        pauseTimer();
        timerSeconds = 300; // Reset to 5:00
        updateTimerDisplay();
        saveTimerState();
    }

    // Make timer number clickable to edit
    timerDisplay.addEventListener('click', () => {
        pauseTimer();
        const currentVal = timerSeconds;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = formatTime(timerSeconds);
        input.className = 'timer-number editing';
        input.style.cssText = 'width: 80px; font-size: 1.5rem; font-family: Montserrat, sans-serif; font-weight: 800; text-align: center; border: 2px solid var(--accent-orange); border-radius: 4px; background: var(--bg-alt); color: var(--text-primary);';
        
        timerDisplay.replaceWith(input);
        input.focus();
        input.select();

        function finishEdit() {
            let newVal = input.value.trim();
            // Parse MM:SS or just seconds
            if (newVal.includes(':')) {
                const parts = newVal.split(':');
                const mins = parseInt(parts[0]) || 0;
                const secs = parseInt(parts[1]) || 0;
                timerSeconds = Math.max(0, mins * 60 + secs);
            } else {
                timerSeconds = Math.max(0, parseInt(newVal) || 0);
            }
            timerDisplay.textContent = formatTime(timerSeconds);
            input.replaceWith(timerDisplay);
            saveTimerState();
        }

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                timerSeconds = currentVal;
                input.replaceWith(timerDisplay);
            }
        });
    });

    timerStartBtn.addEventListener('click', startTimer);
    timerPauseBtn.addEventListener('click', pauseTimer);
    timerResetBtn.addEventListener('click', resetTimer);

    // Resume timer if it was running before page reload
    if (timerRunning && timerEndTime > Date.now()) {
        timerStartBtn.style.display = 'none';
        timerPauseBtn.style.display = 'inline-flex';
        timerInterval = setInterval(tick, 100);
        tick();
    } else {
        // Clear stale end time
        localStorage.removeItem('sfimpTimerEndTime');
        timerRunning = false;
    }

    updateTimerDisplay();
});
