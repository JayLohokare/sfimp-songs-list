document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('setup-modal');
    const sheetIdInput = document.getElementById('sheet-id-input');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveSetupBtn = document.getElementById('save-setup-btn');
    const setupError = document.getElementById('setup-error');
    const dashboard = document.getElementById('main-dashboard');
    const resetSheetBtn = document.getElementById('reset-sheet-btn');
    
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
        const sheetId = sheetIdInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        
        if (!sheetId) {
            setupError.textContent = "Please provide a Sheet ID or URL.";
            setupError.style.display = "block";
            return;
        }

        setupError.style.display = "none";
        saveSetupBtn.textContent = "Loading...";
        
        localStorage.setItem('sfimpSheetId', sheetId);
        if (apiKey) {
            localStorage.setItem('sfimpApiKey', apiKey);
        } else {
            localStorage.removeItem('sfimpApiKey');
        }
        
        fetchSheetData(apiKey || DEFAULT_API_KEY, sheetId);
    });

    resetSheetBtn.addEventListener('click', () => {
        localStorage.removeItem('sfimpSheetId');
        location.reload();
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

        if (song.details && song.details.length > 0) {
            song.details.forEach(detail => {
                const lowerLabel = detail.label.toLowerCase();
                let val = detail.value;
                const urlRegex = /(https?:\/\/[^\s]+)/g;

                if (lowerLabel.includes('link')) {
                    const urls = val.match(urlRegex);
                    if (urls) {
                        urls.forEach((url, idx) => {
                            linksHtml += `<a href="${url}" target="_blank" class="nav-btn button-secondary" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; border-color: var(--border-color); color: var(--text-primary); margin-top:4px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                Reference Link
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
});
