// ============================================================
// TAVLA TURNUVASI ÇEKİLİŞ SİSTEMİ
// GitHub-backed persistent draw system
// ============================================================

// Time Helpers
function toLocalISOString(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
}

function getGenderIcon(gender) {
    return gender === 'female' ? '👩' : '👨';
}

// GitHub Configuration
const GITHUB_OWNER = 'mustafasacar35';
const GITHUB_REPO = 'tavla';
const GITHUB_BRANCH = 'main';
const GITHUB_FILE_PATH = 'data.json';


// Data Structure
let tournament = {
    name: "Tavla Turnuvası",
    currentRound: 1,
    totalRounds: 0,
    rounds: [],
    participants: [],
    standings: [],
    lastUpdated: new Date().toISOString()
};

// Global state
let isAdminLoggedIn = false;
let isSavingToGitHub = false;
let isDrawInProgress = false; // Lock to prevent concurrent draws
let calendarDate = new Date(); // Current calendar month view

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    loadDataFromGitHub();
    startCountdown();
});

// ============================================================
// GITHUB DATA OPERATIONS
// ============================================================

async function loadDataFromGitHub() {
    try {
        // Cache-bust to always get fresh data
        const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FILE_PATH}?t=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        
        if (!response.ok) {
            throw new Error(`GitHub fetch failed: ${response.status}`);
        }
        
        const data = await response.json();
        tournament = data;
        console.log('✅ GitHub\'dan veri yüklendi');
        console.log(`📊 Turlar: ${tournament.rounds.length}, Katılımcılar: ${tournament.participants.length}`);
        
        tournament.rounds.forEach(r => {
            console.log(`  → ${r.name}: drawCompleted=${r.drawCompleted}, matches=${r.matches?.length || 0}`);
        });
        
    } catch (error) {
        console.error('❌ GitHub\'dan yüklenemedi:', error);
        const saved = localStorage.getItem('tavlaTournament');
        if (saved) {
            try {
                tournament = JSON.parse(saved);
                console.log('📦 localStorage\'dan yüklendi (fallback)');
            } catch (e) {
                console.log('⚠️ Varsayılan veri kullanılıyor');
            }
        }
    }
    
    initializeTournament();
}

async function saveDataToGitHub() {
    const token = getGitHubToken();
    
    if (!token) {
        console.warn('⚠️ GitHub token yok');
        saveToLocalStorage();
        return false;
    }
    
    if (isSavingToGitHub) {
        console.log('⏳ Zaten kaydediliyor, bekleyiniz...');
        return false;
    }
    
    isSavingToGitHub = true;
    
    try {
        const fileUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        const getResponse = await fetch(fileUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!getResponse.ok) {
            throw new Error(`GitHub GET hatası: ${getResponse.status}`);
        }
        
        const fileData = await getResponse.json();
        const currentSHA = fileData.sha;
        
        tournament.lastUpdated = new Date().toISOString();
        const content = JSON.stringify(tournament, null, 2);
        const encodedContent = btoa(unescape(encodeURIComponent(content)));
        
        const updateResponse = await fetch(fileUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Turnuva güncelleme - ${new Date().toLocaleString('tr-TR')}`,
                content: encodedContent,
                sha: currentSHA,
                branch: GITHUB_BRANCH
            })
        });
        
        if (!updateResponse.ok) {
            const errText = await updateResponse.text();
            throw new Error(`GitHub PUT hatası: ${updateResponse.status} ${errText}`);
        }
        
        console.log('✅ GitHub\'a kaydedildi!');
        saveToLocalStorage();
        isSavingToGitHub = false;
        return true;
        
    } catch (error) {
        console.error('❌ GitHub kayıt hatası:', error);
        saveToLocalStorage();
        showNotification('❌ GitHub hatası: ' + error.message, 'error');
        isSavingToGitHub = false;
        return false;
    }
}

function saveToLocalStorage() {
    tournament.lastUpdated = new Date().toISOString();
    localStorage.setItem('tavlaTournament', JSON.stringify(tournament));
}

function getGitHubToken() {
    return localStorage.getItem('githubToken') || '';
}

function setGitHubToken(token) {
    if (token && token.trim()) {
        localStorage.setItem('githubToken', token.trim());
        return true;
    }
    return false;
}

// ============================================================
// SAVE HELPERS
// ============================================================

function saveData() {
    saveToLocalStorage();
    updateAllUI();
}

async function saveDataAndSync() {
    saveToLocalStorage();
    updateAllUI();
    const success = await saveDataToGitHub();
    if (success) {
        showNotification('✅ GitHub\'a kaydedildi!', 'success');
    }
    return success;
}

// ============================================================
// INITIALIZATION
// ============================================================

function initializeTournament() {
    if (!tournament.adminPassword) {
        tournament.adminPassword = "1234";
        saveToLocalStorage();
    }
    updateAllUI();
}

function createNewTournament() {
    return {
        name: "Tavla Turnuvası",
        currentRound: 1,
        totalRounds: 0,
        rounds: [],
        participants: [],
        standings: [],
        lastUpdated: new Date().toISOString()
    };
}

// ============================================================
// UI UPDATES
// ============================================================

function updateAllUI() {
    updateOverview();
    updateSchedule();
    updateCurrentRound();
    updateStandings();
    updateCalendar();
    updateMatchResultInputs();
    if (isAdminLoggedIn) {
        updateParticipantsManager();
        updateRoundsManager();
        updateManualDrawSection();
        updateBackupsListUI();
        updateGitHubTokenStatus();
    }
}

function updateOverview() {
    document.getElementById('participant-count').textContent = tournament.participants.length;
    document.getElementById('current-round-num').textContent = tournament.currentRound;
    updateParticipantsList();
}

function updateParticipantsList() {
    const list = document.getElementById('participants-list');
    list.innerHTML = '';
    
    tournament.participants.forEach(p => {
        const card = document.createElement('div');
        card.className = 'participant-card';
        const genderIcon = getGenderIcon(p.gender);
        card.innerHTML = `
            <div class="name">${genderIcon} ${p.name}</div>
            <div class="status">
                <span>${p.eliminated ? '❌ Elendi' : '✅ Aktif'}</span>
            </div>
        `;
        list.appendChild(card);
    });
}

// ============================================================
// PARTICIPANTS MANAGEMENT (Admin)
// ============================================================

function addParticipant() {
    const input = document.getElementById('participant-input');
    const genderRadios = document.getElementsByName('gender-input');
    const name = input.value.trim();
    
    let gender = 'male';
    for (const radio of genderRadios) {
        if (radio.checked) {
            gender = radio.value;
            break;
        }
    }
    
    if (!name) { showNotification('Lütfen bir isim girin', 'error'); return; }
    
    if (tournament.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showNotification('Bu katılımcı zaten var!', 'error'); return;
    }
    
    tournament.participants.push({
        id: Date.now(),
        name: name,
        gender: gender,
        wins: 0,
        losses: 0,
        eliminated: false
    });
    
    input.value = '';
    saveData();
    showNotification(`${getGenderIcon(gender)} ${name} eklendi! ✨`, 'success');
}

function deleteParticipant(id) {
    tournament.participants = tournament.participants.filter(p => p.id !== id);
    saveData();
    showNotification('Katılımcı silindi! 🗑️', 'success');
}

function clearAllParticipants() {
    if (confirm('⚠️ TÜM katılımcıları silmek istediğinizden emin misiniz?')) {
        tournament.participants = [];
        saveData();
        showNotification('Hepsi silindi! 🗑️', 'success');
    }
}

function updateParticipantsManager() {
    const manager = document.getElementById('participants-manager');
    if (!manager) return;
    manager.innerHTML = '';
    
    if (tournament.participants.length === 0) {
        manager.innerHTML = '<p style="color: #999; text-align: center;">Henüz katılımcı eklenmemiş</p>';
        return;
    }
    
    tournament.participants.forEach(p => {
        const item = document.createElement('div');
        item.className = 'participant-item';
        const genderIcon = getGenderIcon(p.gender);
        item.innerHTML = `
            <span class="participant-item-name" ondblclick="startEditParticipant(${p.id})">${genderIcon} ${p.name}</span>
            <div style="display: flex; gap: 5px;">
                <button onclick="startEditParticipant(${p.id})" class="participant-item-delete" style="background: #667eea; width: auto; padding: 5px 10px; font-size: 0.9em;" title="Düzenle">✏️</button>
                <button onclick="deleteParticipant(${p.id})" class="participant-item-delete" title="Sil">✕</button>
            </div>
        `;
        manager.appendChild(item);
    });
}

function startEditParticipant(id) {
    const participant = tournament.participants.find(p => p.id === id);
    if (!participant) return;
    
    const manager = document.getElementById('participants-manager');
    const names = manager.querySelectorAll('.participant-item-name');
    names.forEach((name, idx) => {
        const item = name.closest('.participant-item');
        if (tournament.participants[idx] && tournament.participants[idx].id === id) {
            item.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px; flex: 1;">
                    <input type="text" id="edit-input-${id}" value="${participant.name}" class="input" style="width: 100%;">
                    <div style="display: flex; gap: 15px; background: white; padding: 5px 10px; border-radius: 6px; border: 1px solid #edf2f7; font-size: 0.85em;">
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <input type="radio" name="edit-gender-${id}" value="male" ${participant.gender !== 'female' ? 'checked' : ''}> 👨 Erkek
                        </label>
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <input type="radio" name="edit-gender-${id}" value="female" ${participant.gender === 'female' ? 'checked' : ''}> 👩 Kadın
                        </label>
                    </div>
                </div>
                <div style="display: flex; gap: 5px; align-items: flex-start;">
                    <button onclick="saveEditParticipant(${id})" class="participant-item-delete" style="background: #28a745; width: auto; padding: 5px 10px;">✅</button>
                    <button onclick="cancelEditParticipant()" class="participant-item-delete" style="background: #999; width: auto; padding: 5px 10px;">❌</button>
                </div>
            `;
            document.getElementById(`edit-input-${id}`).focus();
        }
    });
}

function saveEditParticipant(id) {
    const input = document.getElementById(`edit-input-${id}`);
    const genderRadios = document.getElementsByName(`edit-gender-${id}`);
    if (!input) return;
    const newName = input.value.trim();
    if (!newName) { showNotification('İsim boş olamaz', 'error'); return; }
    
    let newGender = 'male';
    for (const radio of genderRadios) {
        if (radio.checked) {
            newGender = radio.value;
            break;
        }
    }
    
    const participant = tournament.participants.find(p => p.id === id);
    if (!participant) return;
    
    if (tournament.participants.some(p => p.id !== id && p.name.toLowerCase() === newName.toLowerCase())) {
        showNotification('Bu isim zaten var!', 'error'); return;
    }
    
    participant.name = newName;
    participant.gender = newGender;
    saveData();
    updateParticipantsManager();
    showNotification('Bilgiler güncellendi! ✏️', 'success');
}

function cancelEditParticipant() {
    updateParticipantsManager();
}

// ============================================================
// SCHEDULE
// ============================================================

function updateSchedule() {
    const schedule = document.getElementById('schedule-list');
    schedule.innerHTML = '';
    
    if (tournament.rounds.length === 0) {
        schedule.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">Henüz çekiliş tarihleri belirlenmemiş</p>';
        return;
    }
    
    tournament.rounds.forEach((round, index) => {
        const drawDate = new Date(round.drawDate);
        const now = new Date();
        const isCompleted = round.completed;
        const isDrawDone = round.drawCompleted;
        const isActive = now >= drawDate && !isCompleted;
        
        let statusText;
        if (isCompleted) {
            statusText = '✅ Tamamlandı';
        } else if (isDrawDone) {
            statusText = '🎲 Çekiliş yapıldı - Maçlar devam ediyor';
        } else if (isActive) {
            statusText = '⏰ Çekiliş zamanı geldi!';
        } else {
            statusText = '⏳ Bekleniyor';
        }
        
        const item = document.createElement('div');
        item.className = `schedule-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`;
        item.innerHTML = `
            <div class="schedule-info">
                <h3>🎯 ${round.name}</h3>
                <p>📅 ${drawDate.toLocaleString('tr-TR')}</p>
                <p>${statusText}</p>
            </div>
            <div class="countdown">
                <span id="countdown-${index}">${getCountdownText(drawDate)}</span>
            </div>
        `;
        schedule.appendChild(item);
    });
}

function getCountdownText(date) {
    const now = new Date();
    const diff = date - now;
    if (diff < 0) return '⏸️ Bitti';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (days > 0) return `${days}g ${hours}s ${minutes}d`;
    if (hours > 0) return `${hours}s ${minutes}d ${seconds}s`;
    if (minutes > 0) return `${minutes}d ${seconds}s 🔴`;
    return `${seconds}s 🔴🔴🔴`;
}

function startCountdown() {
    setInterval(() => {
        const el = document.getElementById('next-draw-countdown');
        if (el) el.textContent = getNextDrawCountdown();
        
        tournament.rounds.forEach((round, index) => {
            const element = document.getElementById(`countdown-${index}`);
            if (element) {
                element.textContent = getCountdownText(new Date(round.drawDate));
            }
        });
    }, 1000);
}

function getNextDrawCountdown() {
    const activeRound = tournament.rounds.find(r => !r.completed);
    if (!activeRound) return '📊 Turnuva bitti!';
    if (activeRound.drawCompleted) return '🎲 Çekiliş yapıldı!';
    return getCountdownText(new Date(activeRound.drawDate));
}

// ============================================================
// CURRENT ROUND DISPLAY (Public - everyone sees this)
// ============================================================

function updateCurrentRound() {
    // Show ALL rounds that have draws, not just the active one
    const matchesContainer = document.getElementById('matches-container');
    const roundTitle = document.getElementById('round-title');
    
    // Find rounds with completed draws
    const drawnRounds = tournament.rounds.filter(r => r.drawCompleted && r.matches && r.matches.length > 0);
    
    if (drawnRounds.length === 0) {
        // No draws yet - show countdown for next round
        const nextRound = tournament.rounds.find(r => !r.completed && !r.drawCompleted);
        if (nextRound) {
            const drawDate = new Date(nextRound.drawDate);
            const now = new Date();
            roundTitle.textContent = nextRound.name;
            
            if (now < drawDate) {
                matchesContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <h2 style="color: #667eea; font-size: 1.5em;">⏳ Çekiliş Henüz Yapılmadı</h2>
                        <p style="font-size: 1.2em; color: #764ba2; margin: 20px 0;">
                            <strong>${getCountdownText(drawDate)}</strong> sonra<br>
                            çekiliş sonuçları burada görülecek! 🎲
                        </p>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-top: 20px;">
                            <p style="color: #666; margin: 0;">📅 Çekiliş Tarihi: <strong>${drawDate.toLocaleString('tr-TR')}</strong></p>
                        </div>
                    </div>
                `;
            } else {
                matchesContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <h2 style="color: #667eea; font-size: 1.5em;">⏳ Çekiliş Bekleniyor...</h2>
                        <p style="font-size: 1.2em; color: #764ba2; margin: 20px 0;">
                            Çekiliş zamanı geldi, admin tarafından yapılacak 🎲
                        </p>
                    </div>
                `;
            }
        } else {
            roundTitle.textContent = 'Turnuva';
            matchesContainer.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">Henüz çekiliş yapılmamış</p>';
        }
        return;
    }
    
    // Show drawn rounds
    const activeRound = tournament.rounds.find(r => !r.completed);
    roundTitle.textContent = activeRound ? activeRound.name : 'Turnuva Tamamlandı';
    
    matchesContainer.innerHTML = '';
    
    drawnRounds.forEach(round => {
        // Round header
        const header = document.createElement('div');
        header.style.cssText = 'background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 15px 20px; border-radius: 10px; margin-bottom: 15px; margin-top: 20px;';
        header.innerHTML = `
            <h3 style="margin: 0;">🎯 ${round.name} ${round.completed ? '✅' : '🎮'}</h3>
            <p style="margin: 5px 0 0; opacity: 0.9; font-size: 0.9em;">${round.matches.length} eşleşme${round.byePlayer ? ` • 🎫 Bay: ${getGenderIcon(round.byePlayer.gender)} ${round.byePlayer.name}` : ''}</p>
        `;
        matchesContainer.appendChild(header);
        
        // Matches
        round.matches.forEach((match, index) => {
            const player1 = tournament.participants.find(p => p.id === match.player1Id);
            const player2 = tournament.participants.find(p => p.id === match.player2Id);
            
            const card = document.createElement('div');
            card.className = 'match-card';
            card.style.animation = `slideIn 0.3s ease-out ${index * 0.1}s both`;
            card.style.flexDirection = 'column';
            card.style.gap = '8px';
            
            let resultDisplay = '⏳';
            if (match.result) {
                const winnerId = match.result.winner;
                const p1Style = winnerId === match.player1Id ? 'color: #28a745; font-weight: bold;' : 'color: #dc3545;';
                const p2Style = winnerId === match.player2Id ? 'color: #28a745; font-weight: bold;' : 'color: #dc3545;';
                resultDisplay = `<span style="${p1Style}">${match.result.player1Score}</span> - <span style="${p2Style}">${match.result.player2Score}</span>`;
            }
            
            // Schedule info (date + location)
            const matchId = `${round.roundNumber}_${index}`;
            let scheduleHTML = '';
            
            if (!match.result) {
                const hasSchedule = match.scheduledDate || match.scheduledLocation;
                
                // Format date nicely: "12 Mart Perşembe, saat 12:30"
                let dateText = '';
                if (match.scheduledDate) {
                    const d = new Date(match.scheduledDate);
                    const options = { day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' };
                    dateText = d.toLocaleString('tr-TR', options);
                }
                
                const locationText = match.scheduledLocation || '';
                
                // Display row
                let infoDisplay = '';
                if (hasSchedule) {
                    const parts = [];
                    if (dateText) parts.push(`📅 ${dateText}`);
                    if (locationText) parts.push(`📍 ${locationText}`);
                    infoDisplay = `<span style="color: #667eea; font-size: 0.85em;">${parts.join(' &bull; ')}</span>`;
                } else {
                    infoDisplay = `<span style="color: #bbb; font-size: 0.85em;">📅 Tarih ve yer henüz belirlenmemiş</span>`;
                }
                
                scheduleHTML = `
                    <div style="width: 100%; border-top: 1px solid #eee; padding-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        ${infoDisplay}
                        ${isAdminLoggedIn ? `
                            <button onclick="toggleScheduleEdit('${matchId}')" style="margin-left: auto; background: #667eea; color: white; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75em;">✏️ Düzenle</button>
                        ` : ''}
                    </div>
                    <div id="schedule-edit-${matchId}" style="display: none; width: 100%; padding: 10px; background: #f8f8ff; border-radius: 8px; border: 1px solid #e0e0ff;">
                        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px;">
                            <label style="font-size: 0.85em; color: #555; min-width: 50px;">📅 Tarih:</label>
                            <input type="datetime-local" id="schedule-date-${matchId}" style="padding: 5px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85em; flex: 1; min-width: 180px;" value="${match.scheduledDate ? toLocalISOString(new Date(match.scheduledDate)) : ''}">
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px;">
                            <label style="font-size: 0.85em; color: #555; min-width: 50px;">📍 Yer:</label>
                            <input type="text" id="schedule-loc-${matchId}" placeholder="Örn: 6. kat, toplantı odası" style="padding: 5px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85em; flex: 1; min-width: 180px;" value="${locationText}">
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button onclick="saveMatchSchedule('${matchId}')" style="background: #28a745; color: white; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.85em;">✅ Kaydet</button>
                            <button onclick="toggleScheduleEdit('${matchId}')" style="background: #6c757d; color: white; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em;">❌ İptal</button>
                            ${hasSchedule ? `<button onclick="clearMatchSchedule('${matchId}')" style="background: #dc3545; color: white; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em;">🗑️ Temizle</button>` : ''}
                        </div>
                    </div>
                `;
            }
            
            card.innerHTML = `
                <div style="display: flex; align-items: center; width: 100%; gap: 10px;">
                    <div class="match-number" style="background: #667eea; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">${index + 1}</div>
                    <div class="player" style="${match.result && match.result.winner === match.player1Id ? 'font-weight: bold; color: #28a745;' : ''}">
                        ${player1 ? `${getGenderIcon(player1.gender)} ${player1.name}` : '❓ Bilinmeyen'} ${match.result && match.result.winner === match.player1Id ? '🏆' : ''}
                    </div>
                    <div class="vs">VS</div>
                    <div class="player" style="${match.result && match.result.winner === match.player2Id ? 'font-weight: bold; color: #28a745;' : ''}">
                        ${player2 ? `${getGenderIcon(player2.gender)} ${player2.name}` : '❓ Bilinmeyen'} ${match.result && match.result.winner === match.player2Id ? '🏆' : ''}
                    </div>
                    <div style="margin-left: 15px; font-weight: bold; font-size: 1.2em; flex-shrink: 0;">
                        ${resultDisplay}
                    </div>
                </div>
                ${scheduleHTML}
            `;
            
            matchesContainer.appendChild(card);
        });
        
        // Show bye player card if exists
        if (round.byePlayer) {
            const byeCard = document.createElement('div');
            byeCard.className = 'match-card';
            byeCard.style.animation = `slideIn 0.3s ease-out ${round.matches.length * 0.1}s both`;
            byeCard.style.background = 'linear-gradient(135deg, #d4edda, #c3e6cb)';
            byeCard.style.borderLeft = '4px solid #28a745';
            byeCard.innerHTML = `
                <div style="display: flex; align-items: center; width: 100%; gap: 10px;">
                    <div style="background: #28a745; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">🎫</div>
                    <div class="player">
                        👤 ${round.byePlayer.name}
                    </div>
                    <div style="margin-left: auto; color: #28a745; font-weight: bold; font-size: 0.9em;">
                        ✅ Çekilişsiz üst tura geçiyor
                    </div>
                </div>
            `;
            matchesContainer.appendChild(byeCard);
        }
    });
}

// ============================================================
// MATCH SCHEDULING (Admin sets date + location for matches)
// ============================================================

function toggleScheduleEdit(matchId) {
    const el = document.getElementById(`schedule-edit-${matchId}`);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function findMatchByMatchId(matchId) {
    const parts = matchId.split('_');
    const roundNumber = parseInt(parts[0]);
    const matchIndex = parseInt(parts[1]);
    
    const round = tournament.rounds.find(r => r.roundNumber === roundNumber);
    if (!round || !round.matches || matchIndex >= round.matches.length) return null;
    
    return { round, match: round.matches[matchIndex], matchIndex };
}

async function saveMatchSchedule(matchId) {
    const dateInput = document.getElementById(`schedule-date-${matchId}`);
    const locInput = document.getElementById(`schedule-loc-${matchId}`);
    
    const result = findMatchByMatchId(matchId);
    if (!result) {
        showNotification('Maç bulunamadı', 'error');
        return;
    }
    
    // Save date if provided
    if (dateInput && dateInput.value) {
        result.match.scheduledDate = new Date(dateInput.value).toISOString();
    }
    
    // Save location if provided
    if (locInput && locInput.value.trim()) {
        result.match.scheduledLocation = locInput.value.trim();
    }
    
    if (!dateInput?.value && !locInput?.value?.trim()) {
        showNotification('Tarih veya yer girin', 'error');
        return;
    }
    
    const p1 = tournament.participants.find(p => p.id === result.match.player1Id);
    const p2 = tournament.participants.find(p => p.id === result.match.player2Id);
    
    showNotification('💾 Kaydediliyor...', 'success');
    await saveDataAndSync();
    updateAllUI();
    showNotification(`📅 ${p1?.name} vs ${p2?.name} planlandı!`, 'success');
}

async function clearMatchSchedule(matchId) {
    const result = findMatchByMatchId(matchId);
    if (!result) return;
    
    delete result.match.scheduledDate;
    delete result.match.scheduledLocation;
    
    showNotification('💾 Temizleniyor...', 'success');
    await saveDataAndSync();
    updateAllUI();
    showNotification('🗑️ Maç takvimi temizlendi', 'success');
}

// ============================================================
// STANDINGS
// ============================================================

function updateStandings() {
    const standings = document.getElementById('standings-table');
    
    if (tournament.participants.length === 0) {
        standings.innerHTML = '<p style="text-align: center; padding: 20px;">Henüz katılımcı eklenmemiş</p>';
        return;
    }
    
    const sorted = [...tournament.participants].sort((a, b) => {
        const aRate = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
        const bRate = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
        return bRate - aRate || b.wins - a.wins;
    });
    
    let html = `
        <table>
            <thead><tr>
                <th>Sıra</th><th>Katılımcı</th><th>Kazanış</th><th>Kaybediş</th><th>Oran %</th><th>Durum</th>
            </tr></thead>
            <tbody>
    `;
    
    sorted.forEach((p, i) => {
        const total = p.wins + p.losses;
        const rate = total > 0 ? ((p.wins / total) * 100).toFixed(1) : '0.0';
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▪️';
        const genderIcon = getGenderIcon(p.gender);
        html += `<tr>
            <td>${medal} ${i + 1}</td>
            <td><strong>${genderIcon} ${p.name}</strong></td>
            <td>${p.wins}</td><td>${p.losses}</td><td>${rate}%</td>
            <td>${p.eliminated ? '❌' : '✅'}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    standings.innerHTML = html;
}

// ============================================================
// MATCH RESULTS (Admin)
// ============================================================

function updateMatchResultInputs() {
    const container = document.getElementById('match-result-input');
    if (!container) return;
    
    const activeRound = tournament.rounds.find(r => !r.completed && r.drawCompleted);
    
    if (!activeRound || !activeRound.matches || activeRound.matches.length === 0) {
        container.innerHTML = '<p style="color: #999;">Çekilişi yapılmış aktif turda maç yok</p>';
        return;
    }
    
    container.innerHTML = '';
    
    const form = document.createElement('div');
    form.className = 'match-result-form';
    
    const select = document.createElement('select');
    select.id = 'match-select';
    select.onchange = updateResultInput;
    select.innerHTML = '<option value="">-- Maç Seç --</option>';
    
    activeRound.matches.forEach((match, index) => {
        const p1 = tournament.participants.find(p => p.id === match.player1Id);
        const p2 = tournament.participants.find(p => p.id === match.player2Id);
        const p1Name = p1 ? `${getGenderIcon(p1.gender)} ${p1.name}` : '?';
        const p2Name = p2 ? `${getGenderIcon(p2.gender)} ${p2.name}` : '?';
        const score = match.result ? `✅ (${match.result.player1Score}-${match.result.player2Score})` : '⏳';
        select.innerHTML += `<option value="${index}">${index + 1}. ${p1Name} vs ${p2Name} ${score}</option>`;
    });
    
    form.appendChild(select);
    
    const resultDiv = document.createElement('div');
    resultDiv.id = 'result-input-div';
    resultDiv.style.marginTop = '10px';
    form.appendChild(resultDiv);
    
    container.appendChild(form);
}

function updateResultInput() {
    const select = document.getElementById('match-select');
    const index = parseInt(select.value);
    const resultDiv = document.getElementById('result-input-div');
    
    if (isNaN(index)) { resultDiv.innerHTML = ''; return; }
    
    const activeRound = tournament.rounds.find(r => !r.completed && r.drawCompleted);
    if (!activeRound) return;
    
    const match = activeRound.matches[index];
    const p1 = tournament.participants.find(p => p.id === match.player1Id);
    const p2 = tournament.participants.find(p => p.id === match.player2Id);
    
    resultDiv.innerHTML = `
        <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 100px;"><strong>${p1?.name || '?'}</strong></div>
            <div class="match-result-inputs">
                <input type="number" id="score1" value="${match.result?.player1Score ?? ''}" placeholder="0" min="0" max="100">
                <span>-</span>
                <input type="number" id="score2" value="${match.result?.player2Score ?? ''}" placeholder="0" min="0" max="100">
            </div>
            <div style="flex: 1; text-align: right; min-width: 100px;"><strong>${p2?.name || '?'}</strong></div>
            <div style="display: flex; gap: 5px;">
                <button onclick="saveMatchResult(${index})" class="btn btn-success">💾 Kaydet</button>
                ${match.result ? `<button onclick="clearMatchResult(${index})" class="btn btn-danger" style="background: #dc3545; padding: 10px 15px;">🗑️ Sil</button>` : ''}
            </div>
        </div>
    `;
}

async function saveMatchResult(matchIndex) {
    const score1 = parseInt(document.getElementById('score1').value);
    const score2 = parseInt(document.getElementById('score2').value);
    
    if (isNaN(score1) || isNaN(score2)) {
        showNotification('Lütfen her iki skoru da girin', 'error'); return;
    }
    
    const activeRound = tournament.rounds.find(r => !r.completed && r.drawCompleted);
    if (!activeRound) return;
    
    const match = activeRound.matches[matchIndex];
    const player1 = tournament.participants.find(p => p.id === match.player1Id);
    const player2 = tournament.participants.find(p => p.id === match.player2Id);
    
    // Remove old stats if updating
    if (match.result) {
        if (match.result.winner === match.player1Id) {
            player1.wins = Math.max(0, player1.wins - 1);
            player2.losses = Math.max(0, player2.losses - 1);
        } else {
            player2.wins = Math.max(0, player2.wins - 1);
            player1.losses = Math.max(0, player1.losses - 1);
        }
    }
    
    match.result = {
        player1Score: score1,
        player2Score: score2,
        winner: score1 > score2 ? match.player1Id : match.player2Id
    };
    
    if (score1 > score2) { player1.wins++; player2.losses++; }
    else { player2.wins++; player1.losses++; }
    
    // Check if all matches done
    const allDone = activeRound.matches.every(m => m.result !== null);
    if (allDone) {
        activeRound.completed = true;
        activeRound.matches.forEach(m => {
            const loserId = m.result.winner === m.player1Id ? m.player2Id : m.player1Id;
            const loser = tournament.participants.find(p => p.id === loserId);
            if (loser) loser.eliminated = true;
        });
        tournament.currentRound++;
        showNotification(`🏆 ${activeRound.name} tamamlandı!`, 'success');
    }
    
    showNotification('💾 Kaydediliyor...', 'success');
    await saveDataAndSync();
}

async function clearMatchResult(matchIndex) {
    if (!confirm('Bu maçın sonucunu silmek ve "Bekleniyor" durumuna döndürmek istediğinize emin misiniz?')) return;
    
    const activeRound = tournament.rounds.find(r => !r.completed && r.drawCompleted);
    if (!activeRound) return;
    
    const match = activeRound.matches[matchIndex];
    if (!match.result) return;
    
    const player1 = tournament.participants.find(p => p.id === match.player1Id);
    const player2 = tournament.participants.find(p => p.id === match.player2Id);
    
    // Undo stats
    if (match.result.winner === match.player1Id) {
        if (player1) player1.wins = Math.max(0, player1.wins - 1);
        if (player2) player2.losses = Math.max(0, player2.losses - 1);
    } else {
        if (player2) player2.wins = Math.max(0, player2.wins - 1);
        if (player1) player1.losses = Math.max(0, player1.losses - 1);
    }
    
    // Reset round/tournament state if it was completed
    if (activeRound.completed) {
        activeRound.completed = false;
        // Search back to see if we need to undo eliminations
        activeRound.matches.forEach(m => {
            const loserId = m.result?.winner === m.player1Id ? m.player2Id : m.player1Id;
            const loser = tournament.participants.find(p => p.id === loserId);
            if (loser) loser.eliminated = false;
        });
        // We don't easily know if currentRound should be decremented without checking other rounds, 
        // but typically a result clear at this level means the round is definitely not 'done'.
    }
    
    match.result = null;
    
    showNotification('💾 Siliniyor...', 'success');
    await saveDataAndSync();
    updateAllUI();
    showNotification('Maç sonucu silindi! 🔄', 'success');
}

// ============================================================
// *** DRAW SYSTEM - CORE ***
// ============================================================

// Check if previous round is fully completed (all results entered)
function isPreviousRoundCompleted(roundIndex) {
    if (roundIndex === 0) return true; // First round has no previous
    
    const prevRound = tournament.rounds[roundIndex - 1];
    if (!prevRound) return true;
    
    // Previous round must have draw done
    if (!prevRound.drawCompleted || !prevRound.matches || prevRound.matches.length === 0) {
        return false;
    }
    
    // ALL matches in previous round must have results
    const allResultsEntered = prevRound.matches.every(m => m.result !== null);
    return allResultsEntered && prevRound.completed;
}

// Get info about previous round status for UI
function getPreviousRoundInfo(roundIndex) {
    if (roundIndex === 0) return null;
    
    const prevRound = tournament.rounds[roundIndex - 1];
    if (!prevRound) return null;
    
    const totalMatches = prevRound.matches ? prevRound.matches.length : 0;
    const completedMatches = prevRound.matches ? prevRound.matches.filter(m => m.result !== null).length : 0;
    const pendingMatches = totalMatches - completedMatches;
    
    return {
        name: prevRound.name,
        totalMatches,
        completedMatches,
        pendingMatches,
        isCompleted: prevRound.completed,
        isDrawDone: prevRound.drawCompleted
    };
}

// The actual draw logic - creates EXACTLY N/2 matches
// Each participant appears ONLY ONCE
// Only winners from previous round participate
function performDraw(round) {
    // === SAFETY CHECKS ===
    
    // Already has matches? Don't touch them!
    if (round.matches && round.matches.length > 0) {
        console.log(`ℹ️ ${round.name}: zaten ${round.matches.length} maç var, çekiliş atlanıyor`);
        round.drawCompleted = true;
        return false;
    }
    
    // Already marked as completed? Skip!
    if (round.drawCompleted) {
        console.log(`ℹ️ ${round.name}: drawCompleted=true, çekiliş atlanıyor`);
        return false;
    }
    
    // Lock to prevent concurrent draws
    if (isDrawInProgress) {
        console.log(`⏳ Çekiliş devam ediyor, bekleniyor...`);
        return false;
    }
    
    // Check previous round is completed
    const roundIndex = tournament.rounds.indexOf(round);
    if (!isPreviousRoundCompleted(roundIndex)) {
        const prevInfo = getPreviousRoundInfo(roundIndex);
        if (prevInfo) {
            showNotification(`⛔ Önce "${prevInfo.name}" tamamlanmalı! (${prevInfo.pendingMatches} maç sonucu bekliyor)`, 'error');
        }
        return false;
    }
    
    isDrawInProgress = true;
    
    try {
        // Get eligible (non-eliminated) players = winners from previous rounds
        const eligible = tournament.participants.filter(p => !p.eliminated);
        
        if (eligible.length < 2) {
            round.completed = true;
            round.drawCompleted = true;
            console.log(`⚠️ ${round.name}: Yeterli oyuncu yok (${eligible.length})`);
            if (eligible.length === 1) {
                showNotification(`🏆 ${eligible[0].name} şampiyon!`, 'success');
            }
            return false;
        }
        
        console.log(`🎲 ${round.name}: ${eligible.length} oyuncu ile çekiliş yapılıyor...`);
        if (roundIndex > 0) {
            console.log(`   (Bunlar ${tournament.rounds[roundIndex - 1].name} galipleri)`);
        }
        
        // Shuffle (Fisher-Yates)
        const shuffled = [...eligible];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        // Create matches: exactly floor(N/2) matches
        // Each player appears ONLY ONCE
        const matches = [];
        const usedIds = new Set();
        
        for (let i = 0; i < shuffled.length - 1; i += 2) {
            const p1 = shuffled[i];
            const p2 = shuffled[i + 1];
            
            // Double-check: no duplicates
            if (usedIds.has(p1.id) || usedIds.has(p2.id)) {
                console.error(`❌ HATA: Duplicate tespit edildi! p1=${p1.id}, p2=${p2.id}`);
                continue;
            }
            
            usedIds.add(p1.id);
            usedIds.add(p2.id);
            
            matches.push({
                id: `match_${round.roundNumber}_${matches.length + 1}`,
                player1Id: p1.id,
                player2Id: p2.id,
                result: null
            });
            
            console.log(`  ⚔️ Maç ${matches.length}: ${p1.name} vs ${p2.name}`);
        }
        
        // Handle bye (odd number) - this player auto-advances
        if (shuffled.length % 2 === 1) {
            const byePlayer = shuffled[shuffled.length - 1];
            round.byePlayer = { id: byePlayer.id, name: byePlayer.name };
            console.log(`  🎫 Bay: ${byePlayer.name} (çekilişsiz üst tura geçiyor)`);
            showNotification(`🎫 ${byePlayer.name} tek kaldı, otomatik üst tura geçecek!`, 'success');
        } else {
            round.byePlayer = null;
        }
        
        // SET the matches
        round.matches = matches;
        round.drawCompleted = true;
        
        console.log(`✅ ${round.name}: ${matches.length} maç oluşturuldu (${eligible.length} oyuncu)`);
        showNotification(`🎉 ${round.name} Çekilişi Yapıldı! ${matches.length} eşleşme`, 'success');
        
        return true;
        
    } finally {
        isDrawInProgress = false;
    }
}

// Manual draw by admin - WITH confirmation, previous round check, and GitHub save
async function manualDrawRound(index) {
    const round = tournament.rounds[index];
    
    // Check previous round completion
    if (!isPreviousRoundCompleted(index)) {
        const prevInfo = getPreviousRoundInfo(index);
        if (prevInfo) {
            if (!prevInfo.isDrawDone) {
                showNotification(`⛔ Önce "${prevInfo.name}" çekilişi yapılmalı!`, 'error');
            } else {
                showNotification(`⛔ Önce "${prevInfo.name}" tüm maç sonuçları girilmeli! (${prevInfo.pendingMatches}/${prevInfo.totalMatches} bekliyor)`, 'error');
            }
        }
        return;
    }
    
    const eligible = tournament.participants.filter(p => !p.eliminated);
    
    if (eligible.length < 2) {
        if (eligible.length === 1) {
            showNotification(`🏆 ${eligible[0].name} zaten şampiyon! Çekiliş gerekmez.`, 'success');
        } else {
            showNotification('En az 2 aktif katılımcı olmalı!', 'error');
        }
        return;
    }
    
    if (round.drawCompleted || (round.matches && round.matches.length > 0)) {
        showNotification('Bu turun çekilişi zaten yapılmış! Önce sıfırlayın.', 'error'); return;
    }
    
    if (round.completed) {
        showNotification('Bu tur zaten tamamlandı!', 'error'); return;
    }
    
    const matchCount = Math.floor(eligible.length / 2);
    
    let confirmMsg = `🎲 "${round.name}" için çekiliş yapılacak.\n\n`;
    if (index > 0) {
        confirmMsg += `📋 ${tournament.rounds[index - 1].name} galipleri arasından:\n`;
    }
    confirmMsg += `${eligible.length} oyuncu → ${matchCount} eşleşme\n\nDevam etmek istiyor musunuz?`;
    
    if (!confirm(confirmMsg)) return;
    
    const success = performDraw(round);
    
    if (success) {
        showNotification('💾 GitHub\'a kaydediliyor...', 'success');
        await saveDataAndSync();
        updateAllUI();
    }
}

// Reset draw for a round (Admin only)
async function resetDrawRound(index) {
    const round = tournament.rounds[index];
    
    if (!round.matches || round.matches.length === 0) {
        showNotification('Bu turun çekilişi zaten boş!', 'error'); return;
    }
    
    // Check if any match has results
    const hasResults = round.matches.some(m => m.result !== null);
    
    let msg = `⚠️ "${round.name}" çekilişini sıfırlamak istediğinize emin misiniz?\n\n${round.matches.length} eşleşme silinecek.`;
    if (hasResults) {
        msg += '\n\n🔴 DİKKAT: Girilen maç sonuçları da silinecek!';
    }
    
    if (!confirm(msg)) return;
    
    // If has results, undo the stats
    if (hasResults) {
        round.matches.forEach(m => {
            if (m.result) {
                const p1 = tournament.participants.find(p => p.id === m.player1Id);
                const p2 = tournament.participants.find(p => p.id === m.player2Id);
                if (p1 && p2) {
                    if (m.result.winner === m.player1Id) {
                        p1.wins = Math.max(0, p1.wins - 1);
                        p2.losses = Math.max(0, p2.losses - 1);
                    } else {
                        p2.wins = Math.max(0, p2.wins - 1);
                        p1.losses = Math.max(0, p1.losses - 1);
                    }
                }
                
                // Un-eliminate losers
                const loserId = m.result.winner === m.player1Id ? m.player2Id : m.player1Id;
                const loser = tournament.participants.find(p => p.id === loserId);
                if (loser) loser.eliminated = false;
            }
        });
    }
    
    // Clear the draw
    round.matches = [];
    round.drawCompleted = false;
    round.completed = false;
    
    showNotification('💾 Çekiliş sıfırlanıyor ve GitHub\'a kaydediliyor...', 'success');
    await saveDataAndSync();
    updateAllUI();
    showNotification(`🔄 ${round.name} çekilişi sıfırlandı!`, 'success');
}

// Keep old function name for HTML button
function checkAndRun() {
    if (!isAdminLoggedIn) {
        showNotification('Bu işlem sadece admin tarafından yapılabilir', 'error');
        return;
    }
    
    const now = new Date();
    let drawHappened = false;
    
    tournament.rounds.forEach(round => {
        if (!round.completed && 
            !round.drawCompleted && 
            (!round.matches || round.matches.length === 0) &&
            now >= new Date(round.drawDate)) {
            
            console.log(`🎲 Zamanlanmış çekiliş: ${round.name}`);
            if (performDraw(round)) {
                drawHappened = true;
            }
        }
    });
    
    if (drawHappened) {
        saveDataAndSync();
    } else {
        showNotification('ℹ️ Zamanı gelmiş bekleyen çekiliş yok', 'success');
    }
}

// ============================================================
// TAB NAVIGATION
// ============================================================

function showTab(tabName) {
    if (tabName === 'admin' && !isAdminLoggedIn) {
        document.getElementById('admin-login-screen').style.display = 'block';
        document.getElementById('admin-panel-content').style.display = 'none';
    } else if (tabName === 'admin' && isAdminLoggedIn) {
        document.getElementById('admin-login-screen').style.display = 'none';
        document.getElementById('admin-panel-content').style.display = 'block';
        updateAllUI();
    }
    
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabName).classList.add('active');
    if (event && event.target) event.target.classList.add('active');
}

// ============================================================
// ADMIN AUTH
// ============================================================

function adminLogin() {
    const password = document.getElementById('admin-password').value;
    if (!password) { showNotification('Şifreyi gir', 'error'); return; }
    
    if (password === tournament.adminPassword) {
        isAdminLoggedIn = true;
        document.getElementById('admin-password').value = '';
        document.getElementById('admin-login-screen').style.display = 'none';
        document.getElementById('admin-panel-content').style.display = 'block';
        
        updateAllUI();
        createGitHubBackup(true); // Otomatik yedek (Giriş)
        
        const token = getGitHubToken();
        if (!token) {
            showNotification('🔑 GitHub token henüz girilmemiş! Aşağıda girin.', 'error');
        }
        
        showNotification('Başarıyla giriş yaptın! ✅', 'success');
    } else {
        showNotification('Yanlış şifre! ❌', 'error');
        document.getElementById('admin-password').value = '';
    }
}

function adminLogout() {
    if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
        isAdminLoggedIn = false;
        document.getElementById('admin-login-screen').style.display = 'block';
        document.getElementById('admin-panel-content').style.display = 'none';
        showNotification('Çıkış yaptın 👋', 'success');
    }
}

function cancelAdminLogin() {
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-login-screen').style.display = 'none';
    
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('calendar').classList.add('active');
    document.querySelectorAll('.nav-btn')[0].classList.add('active');
}

function changeAdminPassword() {
    const newPassword = document.getElementById('new-password').value.trim();
    if (!newPassword) { showNotification('Yeni şifreyi gir', 'error'); return; }
    if (newPassword.length < 3) { showNotification('Şifre en az 3 karakter olmalı', 'error'); return; }
    
    tournament.adminPassword = newPassword;
    document.getElementById('new-password').value = '';
    saveDataAndSync();
    showNotification('Şifre değiştirildi! 🔐', 'success');
}

// ============================================================
// GITHUB TOKEN (Admin)
// ============================================================

function saveGitHubToken() {
    const input = document.getElementById('github-token-input');
    const token = input.value.trim();
    if (!token) { showNotification('Token boş olamaz', 'error'); return; }
    
    if (setGitHubToken(token)) {
        input.value = '';
        updateGitHubTokenStatus();
        showNotification('✅ GitHub token kaydedildi!', 'success');
    }
}

function clearGitHubToken() {
    localStorage.removeItem('githubToken');
    updateGitHubTokenStatus();
    showNotification('🗑️ Token silindi', 'success');
}

function updateGitHubTokenStatus() {
    const el = document.getElementById('github-token-status');
    if (!el) return;
    
    const token = getGitHubToken();
    if (token) {
        el.innerHTML = `<span style="color: #28a745;">✅ Token kayıtlı (${token.substring(0, 8)}...)</span>`;
    } else {
        el.innerHTML = `<span style="color: #dc3545;">❌ Token girilmemiş - Çekiliş sonuçları kaydedilemez!</span>`;
    }
}

// ============================================================
// NOTIFICATIONS
// ============================================================

function showNotification(message, type = 'success') {
    // Remove old notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================================
// DATA MANAGEMENT (Admin)
// ============================================================

function resetTournament() {
    if (confirm('⚠️ Turnuvayı sıfırlamak istediğinizden emin misiniz?\nTÜM veriler silinecektir!')) {
        if (confirm('🔴 GERÇEKTEN EMİN MİSİNİZ? Bu geri alınamaz!')) {
            tournament = createNewTournament();
            saveDataAndSync();
            showNotification('Turnuva sıfırlandı! 🔄', 'success');
        }
    }
}

function downloadData() {
    const dataStr = JSON.stringify(tournament, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tavla_turnuvasi_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Veriler indirildi! 💾', 'success');
}

function uploadData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            tournament = JSON.parse(e.target.result);
            await saveDataAndSync();
            showNotification('Veriler yüklendi! 📤', 'success');
        } catch (error) {
            showNotification('Dosya yüklenemedi! ❌', 'error');
        }
    };
    reader.readAsText(file);
}

// ============================================================
// BACKUP & RESTORE SYSTEM (GitHub)
// ============================================================

function getTimestampedFilename() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const sec = pad(now.getSeconds());
    return `backups/tavla_backup_${yyyy}${mm}${dd}_${hh}${min}${sec}.json`;
}

async function createGitHubBackup(isAuto = false, customMsg = "") {
    const token = getGitHubToken();
    if (!token) return false;
    
    const filename = getTimestampedFilename();
    const fileUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`;
    
    try {
        const content = JSON.stringify(tournament, null, 2);
        const encodedContent = btoa(unescape(encodeURIComponent(content)));
        
        const response = await fetch(fileUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: customMsg || (isAuto ? `Otomatik Yedek - ${new Date().toLocaleString('tr-TR')}` : `Manuel Yedek - ${new Date().toLocaleString('tr-TR')}`),
                content: encodedContent,
                branch: GITHUB_BRANCH
            })
        });
        
        if (!response.ok) {
            throw new Error(`Backup error: ${response.status}`);
        }
        
        if (!isAuto) showNotification('📦 Yedek GitHub\'a başarıyla yüklendi: ' + filename.split('/').pop(), 'success');
        updateBackupsListUI();
        return true;
    } catch (error) {
        console.error('❌ Yedekleme hatası:', error);
        if (!isAuto) showNotification('❌ Yedekleme hatası: ' + error.message, 'error');
        return false;
    }
}

async function fetchBackupsList() {
    const token = getGitHubToken();
    if (!token) return [];
    
    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/backups`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.status === 404) return []; // Table doesn't exist yet
        if (!response.ok) return [];
        
        const files = await response.json();
        return files
            .filter(f => f.name.startsWith('tavla_backup_') && f.name.endsWith('.json'))
            .sort((a, b) => b.name.localeCompare(a.name)); // Newest first
            
    } catch (error) {
        console.error('❌ Yedek listesi alınamadı:', error);
        return [];
    }
}

async function restoreFromBackup(path) {
    if (!confirm('⚠️ Bu yedeği geri yüklemek istediğinize emin misiniz?\nMevcut tüm veriler silinecek ve seçilen yedeğe dönülecektir.')) return;
    
    const token = getGitHubToken();
    if (!token) return;
    
    showNotification('🔄 Geri yükleme öncesi mevcut veriler yedekleniyor...', 'success');
    await createGitHubBackup(true, `Geri yükleme öncesi otomatik yedek - ${new Date().toLocaleString('tr-TR')}`);
    
    showNotification('📥 Yedek dosyası indiriliyor...', 'success');
    
    try {
        const response = await fetch(`https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}?t=${Date.now()}`);
        if (!response.ok) throw new Error('Yedek indirilemedi');
        
        const backupData = await response.json();
        tournament = backupData;
        
        showNotification('💾 Ana veriler güncelleniyor...', 'success');
        await saveDataAndSync();
        
        showNotification('✅ Turnuva başarıyla geri yüklendi!', 'success');
        updateBackupsListUI();
    } catch (error) {
        console.error('❌ Geri yükleme hatası:', error);
        showNotification('❌ Geri yükleme hatası: ' + error.message, 'error');
    }
}

async function updateBackupsListUI() {
    const container = document.getElementById('backups-list');
    if (!container) return;
    
    container.innerHTML = '<p style="color: #999; font-size: 0.9em; text-align: center; padding: 10px;">Yedekler listeleniyor...</p>';
    
    const backups = await fetchBackupsList();
    
    if (backups.length === 0) {
        container.innerHTML = '<p style="color: #999; font-size: 0.9em; text-align: center; padding: 10px;">Henüz yedek bulunamadı.</p>';
        return;
    }
    
    let html = '<div style="max-height: 250px; overflow-y: auto; border: 1px solid #edf2f7; border-radius: 12px; background: white;">';
    
    // Show only last 5 backups
    backups.slice(0, 5).forEach((f, idx) => {
        // Extract date from tavla_backup_YYYYMMDD_HHMMSS.json
        const parts = f.name.replace('tavla_backup_', '').replace('.json', '').split('_');
        const dateStr = parts[0];
        const timeStr = parts[1];
        
        const formatted = `${dateStr.slice(6,8)}.${dateStr.slice(4,6)}.${dateStr.slice(0,4)} ${timeStr.slice(0,2)}:${timeStr.slice(2,4)}`;
        
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; ${idx < 4 ? 'border-bottom: 1px solid #f0f0f0;' : ''}">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.2em;">📄</span>
                    <span style="font-size: 0.9em; color: #2d3748; font-weight: 600;">${formatted}</span>
                </div>
                <button onclick="restoreFromBackup('${f.path}')" style="background: #ebf4ff; color: #667eea; border: none; padding: 6px 12px; border-radius: 8px; font-size: 0.8em; font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#667eea'; this.style.color='white'" onmouseout="this.style.background='#ebf4ff'; this.style.color='#667eea'">Geri Yükle</button>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// ============================================================
// ROUNDS MANAGEMENT (Admin)
// ============================================================

function updateRoundsManager() {
    const manager = document.getElementById('rounds-manager');
    if (!manager) return;
    manager.innerHTML = '';
    
    if (tournament.rounds.length === 0) {
        manager.innerHTML = '<p style="color: #999;">Henüz tur eklenmemiş.</p>';
        return;
    }
    
    tournament.rounds.forEach((round, index) => {
        const drawDate = new Date(round.drawDate);
        const dateStr = drawDate.toISOString().slice(0, 16);
        const isDrawDone = round.drawCompleted && round.matches && round.matches.length > 0;
        
        const item = document.createElement('div');
        item.className = 'round-item';
        
        let statusHTML;
        if (isDrawDone) {
            statusHTML = `<div style="padding: 8px; background: #d4edda; border: 1px solid #28a745; border-radius: 5px; text-align: center; font-weight: bold;">
                🎲 Çekiliş yapıldı (${round.matches.length} maç)
            </div>`;
        } else if (round.completed) {
            statusHTML = `<div style="padding: 8px; background: #d4edda; border: 1px solid #28a745; border-radius: 5px; text-align: center; font-weight: bold;">
                ✅ Tamamlandı
            </div>`;
        } else {
            statusHTML = `<div style="padding: 8px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; text-align: center; font-weight: bold;">
                ⏳ Bekleniyor
            </div>`;
        }
        
        item.innerHTML = `
            <div>
                <div class="round-item-label">Tur Adı</div>
                <input type="text" value="${round.name}" onchange="updateRoundName(${index}, this.value)" style="width: 100%;">
            </div>
            <div>
                <div class="round-item-label">Tarih ve Saat</div>
                <input type="datetime-local" value="${dateStr}" onchange="updateRoundDate(${index}, this.value)" ${isDrawDone ? 'disabled' : ''}>
            </div>
            <div>
                <div class="round-item-label">Durum</div>
                ${statusHTML}
            </div>
            ${!isDrawDone ? `<button onclick="deleteRound(${index})" class="round-item-delete">🗑️ Sil</button>` : '<div></div>'}
        `;
        manager.appendChild(item);
    });
}

function updateRoundName(index, name) {
    tournament.rounds[index].name = name;
    saveDataAndSync();
}

function updateRoundDate(index, dateStr) {
    tournament.rounds[index].drawDate = new Date(dateStr).toISOString();
    saveDataAndSync();
}

function deleteRound(index) {
    if (confirm('Bu turu silmek istediğinizden emin misiniz?')) {
        tournament.rounds.splice(index, 1);
        saveData();
        showNotification('Tur silindi! 🗑️', 'success');
    }
}

function addRound() {
    const now = new Date();
    now.setDate(now.getDate() + tournament.rounds.length + 1);
    
    tournament.rounds.push({
        id: Date.now(),
        name: `${tournament.rounds.length + 1}. Tur`,
        roundNumber: tournament.rounds.length + 1,
        drawDate: now.toISOString(),
        completed: false,
        drawCompleted: false,
        matches: [],
        createWinnerRound: true
    });
    
    saveData();
    showNotification('Yeni tur eklendi! ➕', 'success');
}

async function saveRoundsToGitHub() {
    showNotification('💾 Kaydediliyor...', 'success');
    await saveDataAndSync();
}

// ============================================================
// MANUAL DRAW SECTION (Admin) - with RESET button
// ============================================================

function updateManualDrawSection() {
    const section = document.getElementById('manual-draw-section');
    if (!section) return;
    section.innerHTML = '';
    
    if (tournament.rounds.length === 0) {
        section.innerHTML = '<p style="color: #999;">Henüz tur eklenmemiş</p>';
        return;
    }
    
    let content = '<div class="manual-draw-list">';
    
    tournament.rounds.forEach((round, index) => {
        const drawDate = new Date(round.drawDate);
        const now = new Date();
        const isDrawDone = round.drawCompleted && round.matches && round.matches.length > 0;
        const isPast = now >= drawDate;
        const prevCompleted = isPreviousRoundCompleted(index);
        const prevInfo = getPreviousRoundInfo(index);
        const eligible = tournament.participants.filter(p => !p.eliminated).length;
        
        // Determine status
        let statusText, statusColor, extraInfo = '';
        
        if (isDrawDone) {
            // Draw already done
            const resultsEntered = round.matches.filter(m => m.result !== null).length;
            statusText = `✅ Çekiliş yapıldı (${round.matches.length} eşleşme)`;
            statusColor = '#28a745';
            if (round.byePlayer) {
                extraInfo += `<br><span style="color: #667eea;">🎫 Bay: <strong>${round.byePlayer.name}</strong> (çekilişsiz üst tura geçecek)</span>`;
            }
            if (resultsEntered < round.matches.length) {
                extraInfo += `<br><span style="color: #ffc107;">📝 Sonuç: ${resultsEntered}/${round.matches.length} girildi</span>`;
            } else if (round.completed) {
                extraInfo += `<br><span style="color: #28a745;">✅ Tüm sonuçlar girildi</span>`;
            }
        } else if (!prevCompleted && index > 0) {
            // Previous round not done - BLOCKED
            if (!prevInfo.isDrawDone) {
                statusText = `🔒 Önce "${prevInfo.name}" çekilişi yapılmalı`;
            } else {
                statusText = `🔒 Önce "${prevInfo.name}" sonuçları girilmeli (${prevInfo.pendingMatches}/${prevInfo.totalMatches} bekliyor)`;
            }
            statusColor = '#dc3545';
            extraInfo = `<br><span style="color: #764ba2;">👥 ${prevInfo.name} galipleri bu tura katılacak</span>`;
        } else if (isPast) {
            statusText = '⚠️ Çekiliş zamanı geçti - Manuel yapabilirsiniz';
            statusColor = '#ffc107';
            if (index > 0) {
                extraInfo = `<br><span style="color: #764ba2;">👥 ${eligible} galip bu turda yarışacak</span>`;
            }
        } else {
            statusText = '⏳ Bekleniyor';
            statusColor = '#6c757d';
        }
        
        // Determine button state
        const canDraw = !isDrawDone && prevCompleted && eligible >= 2;
        const isBlocked = !prevCompleted && index > 0;
        
        content += `
            <div class="manual-draw-item ${isDrawDone ? 'completed' : ''}" style="flex-wrap: wrap; ${isBlocked ? 'opacity: 0.7; border-left-color: #dc3545;' : ''}">
                <div class="manual-draw-text" style="flex: 1; min-width: 200px;">
                    <strong>${round.name}</strong><br>
                    <span style="font-size: 0.9em; color: #764ba2;">📅 ${drawDate.toLocaleString('tr-TR')}</span><br>
                    <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
                    ${extraInfo}
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    ${isDrawDone ? `
                        <button onclick="resetDrawRound(${index})" style="padding: 8px 15px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; transition: all 0.3s;">
                            🔄 Çekilişi Sıfırla
                        </button>
                    ` : canDraw ? `
                        <button onclick="manualDrawRound(${index})" class="manual-draw-btn">
                            🎲 Çekiliş Yap (${eligible} kişi → ${Math.floor(eligible/2)} maç)
                        </button>
                    ` : `
                        <button disabled class="manual-draw-btn" title="${isBlocked ? 'Önceki tur tamamlanmalı' : 'Yeterli oyuncu yok'}">
                            🔒 ${isBlocked ? 'Önceki tur bekleniyor' : 'Çekiliş yapılamaz'}
                        </button>
                    `}
                </div>
            </div>
        `;
    });
    
    content += '</div>';
    section.innerHTML = content;
}

// ============================================================
// CALENDAR VIEW
// ============================================================

function changeCalendarMonth(delta) {
    calendarDate.setMonth(calendarDate.getMonth() + delta);
    updateCalendar();
}

function updateCalendar() {
    const grid = document.getElementById('calendar-grid');
    const title = document.getElementById('calendar-month-title');
    if (!grid || !title) return;
    
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    // Month name in Turkish
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    title.textContent = `${monthNames[month]} ${year}`;
    
    // Gather all scheduled matches
    const scheduledMatches = [];
    tournament.rounds.forEach(round => {
        if (!round.matches) return;
        round.matches.forEach((match, idx) => {
            if (match.scheduledDate) {
                const p1 = tournament.participants.find(p => p.id === match.player1Id);
                const p2 = tournament.participants.find(p => p.id === match.player2Id);
                scheduledMatches.push({
                    date: new Date(match.scheduledDate),
                    p1Name: p1?.name || '?',
                    p2Name: p2?.name || '?',
                    location: match.scheduledLocation || '',
                    roundName: round.name,
                    hasResult: !!match.result,
                    matchIndex: idx
                });
            }
        });
    });
    
    // Build calendar grid
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = lastDay.getDate();
    const today = new Date();
    
    const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    
    let html = `<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; font-size: 0.85em;">`;
    
    // Day headers
    dayNames.forEach(d => {
        html += `<div style="text-align: center; font-weight: bold; color: #667eea; padding: 8px 4px; background: #f0f0ff; border-radius: 6px;">${d}</div>`;
    });
    
    // Empty cells before first day
    for (let i = 0; i < startDayOfWeek; i++) {
        html += `<div style="min-height: 80px;"></div>`;
    }
    
    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day);
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
        
        // Find matches for this day
        const dayMatches = scheduledMatches.filter(m => 
            m.date.getFullYear() === year && 
            m.date.getMonth() === month && 
            m.date.getDate() === day
        );
        
        const hasMatches = dayMatches.length > 0;
        const bgColor = isToday ? '#667eea' : (hasMatches ? '#f8f9ff' : '#ffffff');
        const textColor = isToday ? '#ffffff' : '#333333';
        const borderColor = isToday ? '#667eea' : (hasMatches ? '#667eea' : '#eef0f5');
        const shadow = hasMatches ? '0 4px 12px rgba(102, 126, 234, 0.15)' : 'none';
        
        html += `
            <div 
                onclick="${hasMatches ? `showDayDetail(${year}, ${month}, ${day})` : ''}" 
                style="min-height: 100px; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 12px; padding: 8px; overflow: hidden; cursor: ${hasMatches ? 'pointer' : 'default'}; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: ${shadow}; position: relative;"
                ${hasMatches ? 'onmouseover="this.style.transform=\'translateY(-5px)\'; this.style.boxShadow=\'0 8px 25px rgba(102, 126, 234, 0.25)\'; this.style.zIndex=\'10\'" onmouseout="this.style.transform=\'translateY(0)\'; this.style.boxShadow=\'' + shadow + '\'; this.style.zIndex=\'1\'"' : ''}
            >
                <div style="font-weight: 700; color: ${textColor}; margin-bottom: 6px; font-size: 1em; display: flex; align-items: center; justify-content: space-between;">
                    <span>${day}</span>
                    ${isToday ? '<span style="font-size: 0.6em; background: rgba(255,255,255,0.25); padding: 2px 6px; border-radius: 20px;">Bugün</span>' : ''}
                </div>
        `;
        
        // Show matches summary in cell
        dayMatches.forEach(m => {
            const time = m.date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            const matchBg = m.hasResult ? 'linear-gradient(135deg, #28a745, #218838)' : 'linear-gradient(135deg, #667eea, #764ba2)';
            
            html += `
                <div style="background: ${matchBg}; color: white; padding: 4px 6px; border-radius: 6px; margin: 3px 0; font-size: 0.7em; line-height: 1.2; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border-left: 2px solid rgba(255,255,255,0.4);">
                    <div style="font-weight: 700; opacity: 0.9;">⏰ ${time}</div>
                    <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9em;">
                        ${m.p1Name.split(' ')[0]} v ${m.p2Name.split(' ')[0]}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    html += `</div>`;
    
    // Legend
    html += `
        <div style="display: flex; gap: 20px; justify-content: center; margin-top: 25px; padding: 15px; background: #f8f9ff; border-radius: 12px; font-size: 0.85em; color: #555; flex-wrap: wrap; box-shadow: inset 0 2px 6px rgba(0,0,0,0.02);">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 14px; height: 14px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 3px;"></span> 
                <span>Planlanmış</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 14px; height: 14px; background: linear-gradient(135deg, #28a745, #218838); border-radius: 3px;"></span> 
                <span>Tamamlanmış</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 14px; height: 14px; background: #667eea; border-radius: 3px; border: 1px solid white; box-shadow: 0 0 0 1px #667eea;"></span> 
                <span>Bugün</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; color: #764ba2; font-weight: 600;">
                <span>💡 Detaylar için güne tıklayın</span>
            </div>
        </div>
    `;
    
    // Upcoming matches list below calendar
    const upcoming = scheduledMatches
        .filter(m => !m.hasResult && m.date >= today)
        .sort((a, b) => a.date - b.date);
    
    if (upcoming.length > 0) {
        html += `
            <div style="margin-top: 35px;">
                <h3 style="color: #333; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; font-size: 1.4em;">
                    <span style="font-size: 1.25em;">📋</span> Yaklaşan Mücadeleler
                </h3>
        `;
        
        upcoming.forEach(m => {
            const dateStr = m.date.toLocaleString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' });
            html += `
                <div style="background: white; border: 1px solid #eef0f5; border-left: 5px solid #764ba2; border-radius: 12px; padding: 18px; margin-bottom: 12px; display: flex; gap: 20px; align-items: center; flex-wrap: wrap; transition: all 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.03);" onmouseover="this.style.transform='translateX(8px)'; this.style.borderColor='#e0e4f0'; this.style.boxShadow='0 6px 15px rgba(0,0,0,0.06)'" onmouseout="this.style.transform='translateX(0)'; this.style.borderColor='#eef0f5'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.03)'">
                    <div style="flex: 1; min-width: 250px;">
                        <div style="font-weight: 700; color: #1a202c; font-size: 1.15em; margin-bottom: 6px; display: flex; align-items: center; gap: 12px;">
                            <span style="color: #667eea;">${getGenderIcon(m.p1Gender)}</span> ${m.p1Name} ${m.result && m.result.winner === m.player1Id ? '🏆' : ''}
                            <span style="color: #cbd5e0; font-size: 0.9em; font-weight: 400;">VS</span> 
                            ${m.p2Name} ${m.result && m.result.winner === m.player2Id ? '🏆' : ''} <span style="color: #667eea;">${getGenderIcon(m.p2Gender)}</span>
                        </div>
                        <div style="font-size: 0.9em; display: flex; align-items: center; gap: 15px; color: #718096;">
                            <span style="display: flex; align-items: center; gap: 5px;">📅 ${dateStr}</span>
                            ${m.location ? `<span style="display: flex; align-items: center; gap: 5px; color: #667eea;">📍 ${m.location}</span>` : ''}
                        </div>
                    </div>
                    <div style="background: #f7fafc; color: #4a5568; padding: 6px 12px; border-radius: 8px; font-size: 1.1em; font-weight: 600; border: 1px solid #edf2f7;">
                        ${m.roundName}
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    grid.innerHTML = html;
}

// ============================================================
// DAY DETAIL MODAL
// ============================================================

function showDayDetail(year, month, day) {
    // Gather matches for this specific day
    const dayMatches = [];
    tournament.rounds.forEach(round => {
        if (!round.matches) return;
        round.matches.forEach((match, idx) => {
            if (!match.scheduledDate) return;
            const d = new Date(match.scheduledDate);
            if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
                const p1 = tournament.participants.find(p => p.id === match.player1Id);
                const p2 = tournament.participants.find(p => p.id === match.player2Id);
                dayMatches.push({
                    date: d,
                    p1Name: p1?.name || '?',
                    p2Name: p2?.name || '?',
                    player1Gender: p1?.gender || 'male',
                    player2Gender: p2?.gender || 'male',
                    location: match.scheduledLocation || '',
                    roundName: round.name,
                    hasResult: !!match.result,
                    result: match.result,
                    player1Id: match.player1Id,
                    player2Id: match.player2Id,
                    matchIndex: idx
                });
            }
        });
    });
    
    if (dayMatches.length === 0) return;
    
    // Sort by time
    dayMatches.sort((a, b) => a.date - b.date);
    
    // Group by time slot
    const timeSlots = {};
    dayMatches.forEach(m => {
        const timeKey = m.date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        if (!timeSlots[timeKey]) timeSlots[timeKey] = [];
        timeSlots[timeKey].push(m);
    });
    
    // Format date
    const dateObj = new Date(year, month, day);
    const dateStr = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
    
    // Build modal content
    let content = '';
    
    Object.entries(timeSlots).forEach(([time, matches]) => {
        const isMultiple = matches.length > 1;
        content += `
            <div style="margin-bottom: 25px; animation: slideIn 0.3s ease-out;">
                <div style="background: #f8f9ff; padding: 12px 20px; border-radius: 12px; border-left: 5px solid #667eea; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
                    <div style="font-weight: 800; color: #2d3748; font-size: 1.2em; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.1em;">⏰</span> Saat ${time}
                    </div>
                    ${isMultiple ? `<span style="background: #ebf4ff; color: #4c51bf; padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 700; border: 1px solid #c3dafe;">🎲 ${matches.length} Mücadele</span>` : ''}
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px;">
        `;
        
        matches.forEach((m, i) => {
            const statusColor = m.hasResult ? '#38a169' : '#667eea';
            const statusBg = m.hasResult ? '#f0fff4' : '#f0f5ff';
            
            let resultHTML = '';
            if (m.hasResult) {
                const isP1Winner = m.result.winner === m.player1Id;
                resultHTML = `
                    <div style="margin-top: 15px; padding: 12px; background: #fdfdfd; border-radius: 10px; border: 1px dashed #e2e8f0; text-align: center;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 1.4em; font-weight: 800;">
                            <span style="color: ${isP1Winner ? '#38a169' : '#e53e3e'}">${m.result.player1Score}</span>
                            <span style="color: #cbd5e0; font-weight: 400;">-</span>
                            <span style="color: ${!isP1Winner ? '#38a169' : '#e53e3e'}">${m.result.player2Score}</span>
                        </div>
                        <div style="font-size: 0.85em; color: #38a169; font-weight: 700; margin-top: 5px;">🏆 ${isP1Winner ? m.p1Name : m.p2Name} Kazandı</div>
                    </div>
                `;
            }
            
            content += `
                <div style="background: white; border: 1px solid #edf2f7; border-radius: 16px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); position: relative; display: flex; flex-direction: column;">
                    ${isMultiple ? `<div style="position: absolute; top: 12px; right: 12px; background: #f7fafc; color: #718096; padding: 4px 10px; border-radius: 8px; font-size: 0.75em; font-weight: 700; border: 1px solid #edf2f7;">Masa ${i + 1}</div>` : ''}
                    
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 12px; border-radius: 20px; font-size: 0.75em; font-weight: 700;">${m.roundName}</span>
                        <span style="font-size: 0.8em; color: #a0aec0;">${m.hasResult ? '✅ Tamamlandı' : '⌛ Bekliyor'}</span>
                    </div>
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 5px 0;">
                        <div style="text-align: center; flex: 1;">
                            <div style="width: 45px; height: 45px; background: #ebf4ff; color: #667eea; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5em; margin: 0 auto 8px;">${getGenderIcon(m.player1Gender)}</div>
                            <div style="font-weight: 700; color: #2d3748; font-size: 0.95em; line-height: 1.2;">${m.p1Name}</div>
                        </div>
                        
                        <div style="color: #cbd5e0; font-weight: 800; font-size: 0.9em; padding: 4px 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">VS</div>
                        
                        <div style="text-align: center; flex: 1;">
                            <div style="width: 45px; height: 45px; background: #ebf4ff; color: #667eea; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5em; margin: 0 auto 8px;">${getGenderIcon(m.player2Gender)}</div>
                            <div style="font-weight: 700; color: #2d3748; font-size: 0.95em; line-height: 1.2;">${m.p2Name}</div>
                        </div>
                    </div>
                    
                    ${m.location ? `<div style="margin-top: 15px; font-size: 0.85em; color: #667eea; background: #f0f7ff; padding: 6px 12px; border-radius: 8px; display: flex; align-items: center; gap: 6px;"><span>📍</span> ${m.location}</div>` : ''}
                    ${resultHTML}
                </div>
            `;
        });
        
        content += `</div></div>`;
    });
    
    // Remove existing modal if any
    const existing = document.getElementById('day-detail-modal');
    if (existing) existing.remove();
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'day-detail-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(26, 32, 44, 0.85); backdrop-filter: blur(8px); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease-out;';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div style="background: #ffffff; border-radius: 24px; max-width: 700px; width: 100%; max-height: 85vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); animation: slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); display: flex; flex-direction: column;">
            <div style="background: white; border-bottom: 1px solid #edf2f7; padding: 25px 30px; position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="background: linear-gradient(135deg, #667eea, #764ba2); width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5em; color: white; box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);">📅</div>
                    <div>
                        <h3 style="margin: 0; font-size: 1.4em; color: #1a202c; font-weight: 800;">${dateStr}</h3>
                        <p style="margin: 3px 0 0; color: #718096; font-size: 0.9em; font-weight: 500;">Günlük Maç Programı</p>
                    </div>
                </div>
                <button onclick="document.getElementById('day-detail-modal').remove()" style="background: #f7fafc; border: none; color: #a0aec0; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 1.2em;" onmouseover="this.style.background='#edf2f7'; this.style.color='#4a5568'" onmouseout="this.style.background='#f7fafc'; this.style.color='#a0aec0'">✕</button>
            </div>
            <div style="padding: 30px; background: #fdfdfd;">
                ${content}
            </div>
            <div style="padding: 20px 30px; background: #f8fafc; border-top: 1px solid #edf2f7; text-align: center; border-radius: 0 0 24px 24px;">
                <button onclick="document.getElementById('day-detail-modal').remove()" style="background: #667eea; color: white; border: none; padding: 12px 30px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.2);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 12px rgba(102, 126, 234, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(102, 126, 234, 0.2)'">Kapat</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}
