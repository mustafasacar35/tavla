// ============================================================
// TAVLA TURNUVASI ÇEKİLİŞ SİSTEMİ
// GitHub-backed persistent draw system
// ============================================================

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
        showNotification('⚠️ GitHub token girilmemiş! Admin panelinden girin.', 'error');
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
    updateMatchResultInputs();
    if (isAdminLoggedIn) {
        updateParticipantsManager();
        updateRoundsManager();
        updateManualDrawSection();
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
        card.innerHTML = `
            <div class="name">👤 ${p.name}</div>
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
    const name = input.value.trim();
    
    if (!name) { showNotification('Lütfen bir isim girin', 'error'); return; }
    
    if (tournament.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showNotification('Bu katılımcı zaten var!', 'error'); return;
    }
    
    tournament.participants.push({
        id: Date.now(),
        name: name,
        wins: 0,
        losses: 0,
        eliminated: false
    });
    
    input.value = '';
    saveData();
    showNotification(`${name} eklendi! ✨`, 'success');
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
        item.innerHTML = `
            <span class="participant-item-name" ondblclick="startEditParticipant(${p.id})">👤 ${p.name}</span>
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
                <input type="text" id="edit-input-${id}" value="${participant.name}" class="input" style="flex: 1;">
                <div style="display: flex; gap: 5px;">
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
    if (!input) return;
    const newName = input.value.trim();
    if (!newName) { showNotification('İsim boş olamaz', 'error'); return; }
    
    const participant = tournament.participants.find(p => p.id === id);
    if (!participant) return;
    
    if (tournament.participants.some(p => p.id !== id && p.name.toLowerCase() === newName.toLowerCase())) {
        showNotification('Bu isim zaten var!', 'error'); return;
    }
    
    participant.name = newName;
    saveData();
    updateParticipantsManager();
    showNotification('İsim güncellendi! ✏️', 'success');
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
            <p style="margin: 5px 0 0; opacity: 0.9; font-size: 0.9em;">${round.matches.length} eşleşme</p>
        `;
        matchesContainer.appendChild(header);
        
        // Matches
        round.matches.forEach((match, index) => {
            const player1 = tournament.participants.find(p => p.id === match.player1Id);
            const player2 = tournament.participants.find(p => p.id === match.player2Id);
            
            const card = document.createElement('div');
            card.className = 'match-card';
            card.style.animation = `slideIn 0.3s ease-out ${index * 0.1}s both`;
            
            let resultDisplay = '⏳';
            if (match.result) {
                const winnerId = match.result.winner;
                const p1Style = winnerId === match.player1Id ? 'color: #28a745; font-weight: bold;' : 'color: #dc3545;';
                const p2Style = winnerId === match.player2Id ? 'color: #28a745; font-weight: bold;' : 'color: #dc3545;';
                resultDisplay = `<span style="${p1Style}">${match.result.player1Score}</span> - <span style="${p2Style}">${match.result.player2Score}</span>`;
            }
            
            card.innerHTML = `
                <div class="match-number" style="background: #667eea; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">${index + 1}</div>
                <div class="player">
                    ${player1 ? `👤 ${player1.name}` : '❓ Bilinmeyen'}
                </div>
                <div class="vs">VS</div>
                <div class="player">
                    ${player2 ? `👤 ${player2.name}` : '❓ Bilinmeyen'}
                </div>
                <div style="margin-left: 15px; font-weight: bold; font-size: 1.2em; flex-shrink: 0;">
                    ${resultDisplay}
                </div>
            `;
            
            matchesContainer.appendChild(card);
        });
    });
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
        html += `<tr>
            <td>${medal} ${i + 1}</td>
            <td><strong>${p.name}</strong></td>
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
        const score = match.result ? `✅ (${match.result.player1Score}-${match.result.player2Score})` : '⏳';
        select.innerHTML += `<option value="${index}">${index + 1}. ${p1?.name || '?'} vs ${p2?.name || '?'} ${score}</option>`;
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
            <button onclick="saveMatchResult(${index})" class="btn btn-success">💾 Kaydet</button>
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
        
        // Handle bye (odd number)
        if (shuffled.length % 2 === 1) {
            const byePlayer = shuffled[shuffled.length - 1];
            console.log(`  🎫 Bay: ${byePlayer.name} (bu turda oynamıyor)`);
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
    document.getElementById('overview').classList.add('active');
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
                <input type="text" value="${round.name}" onchange="updateRoundName(${index}, this.value)" style="width: 100%;" ${isDrawDone ? 'disabled' : ''}>
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
    saveData();
}

function updateRoundDate(index, dateStr) {
    tournament.rounds[index].drawDate = new Date(dateStr).toISOString();
    saveData();
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
            if (resultsEntered < round.matches.length) {
                extraInfo = `<br><span style="color: #ffc107;">📝 Sonuç: ${resultsEntered}/${round.matches.length} girildi</span>`;
            } else if (round.completed) {
                extraInfo = `<br><span style="color: #28a745;">✅ Tüm sonuçlar girildi</span>`;
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
