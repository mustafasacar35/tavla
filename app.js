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

// Global admin state
let isAdminLoggedIn = false;
let isSavingToGitHub = false;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    loadDataFromGitHub();
    startCountdown();
    // Check for scheduled draws every 30 seconds (not 10)
    setInterval(checkAndRunScheduledDraws, 30000);
});

// ============================================================
// GITHUB DATA OPERATIONS
// ============================================================

// Load data from GitHub (single source of truth)
async function loadDataFromGitHub() {
    try {
        const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FILE_PATH}?t=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        
        if (!response.ok) {
            throw new Error(`GitHub fetch failed: ${response.status}`);
        }
        
        const data = await response.json();
        tournament = data;
        console.log('✅ GitHub\'dan veri yüklendi');
        console.log(`📊 Turlar: ${tournament.rounds.length}, Katılımcılar: ${tournament.participants.length}`);
        
        // Log draw status for each round
        tournament.rounds.forEach(r => {
            console.log(`  → ${r.name}: drawCompleted=${r.drawCompleted}, matches=${r.matches?.length || 0}`);
        });
        
    } catch (error) {
        console.error('❌ GitHub\'dan yüklenemedi:', error);
        // Fallback to localStorage
        const saved = localStorage.getItem('tavlaTournament');
        if (saved) {
            try {
                tournament = JSON.parse(saved);
                console.log('📦 localStorage\'dan yüklendi (fallback)');
            } catch (e) {
                console.log('⚠️ localStorage da bozuk, varsayılan veri kullanılıyor');
            }
        }
    }
    
    initializeTournament();
}

// Save data to GitHub via API
async function saveDataToGitHub() {
    const token = getGitHubToken();
    
    if (!token) {
        console.warn('⚠️ GitHub token yok, sadece localStorage\'a kaydediliyor');
        saveToLocalStorage();
        showNotification('⚠️ GitHub token girilmemiş! Veriler sadece bu tarayıcıda kayıtlı.', 'error');
        return false;
    }
    
    if (isSavingToGitHub) {
        console.log('⏳ GitHub\'a kayıt devam ediyor, bekleyiniz...');
        return false;
    }
    
    isSavingToGitHub = true;
    
    try {
        // First get the current file's SHA (required for update)
        const fileUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        const getResponse = await fetch(fileUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!getResponse.ok) {
            throw new Error(`GitHub get failed: ${getResponse.status} ${await getResponse.text()}`);
        }
        
        const fileData = await getResponse.json();
        const currentSHA = fileData.sha;
        
        // Prepare updated content
        tournament.lastUpdated = new Date().toISOString();
        const content = JSON.stringify(tournament, null, 2);
        const encodedContent = btoa(unescape(encodeURIComponent(content)));
        
        // Update the file
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
            throw new Error(`GitHub update failed: ${updateResponse.status} ${errText}`);
        }
        
        console.log('✅ GitHub\'a kaydedildi!');
        saveToLocalStorage(); // Also save locally as cache
        isSavingToGitHub = false;
        return true;
        
    } catch (error) {
        console.error('❌ GitHub\'a kayıt hatası:', error);
        saveToLocalStorage();
        showNotification('❌ GitHub\'a kayıt başarısız: ' + error.message, 'error');
        isSavingToGitHub = false;
        return false;
    }
}

// Save to localStorage (local cache only)
function saveToLocalStorage() {
    tournament.lastUpdated = new Date().toISOString();
    localStorage.setItem('tavlaTournament', JSON.stringify(tournament));
}

// Get GitHub token from localStorage
function getGitHubToken() {
    return localStorage.getItem('githubToken') || '';
}

// Set GitHub token
function setGitHubToken(token) {
    if (token && token.trim()) {
        localStorage.setItem('githubToken', token.trim());
        return true;
    }
    return false;
}

// ============================================================
// SAVE DATA (unified save function)
// ============================================================

// Save data locally and update UI (does NOT push to GitHub)
function saveData() {
    saveToLocalStorage();
    updateAllUI();
}

// Save data AND push to GitHub (for admin actions)
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
// TOURNAMENT INITIALIZATION
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
// UI UPDATE FUNCTIONS
// ============================================================

function updateAllUI() {
    updateOverview();
    updateSchedule();
    updateCurrentRound();
    updateStandings();
    updateMatchResultInputs();
    updateParticipantsManager();
    updateRoundsManager();
    updateManualDrawSection();
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
// PARTICIPANT MANAGEMENT
// ============================================================

function addParticipant() {
    const input = document.getElementById('participant-input');
    const name = input.value.trim();
    
    if (!name) {
        showNotification('Lütfen bir isim girin', 'error');
        return;
    }
    
    if (tournament.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showNotification('Bu katılımcı zaten var!', 'error');
        return;
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
                    <button onclick="saveEditParticipant(${id})" class="participant-item-delete" style="background: #28a745; width: auto; padding: 5px 10px; font-size: 0.9em;">✅</button>
                    <button onclick="cancelEditParticipant()" class="participant-item-delete" style="background: #999; width: auto; padding: 5px 10px; font-size: 0.9em;">❌</button>
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
    
    if (!newName) {
        showNotification('İsim boş olamaz', 'error');
        return;
    }
    
    const participant = tournament.participants.find(p => p.id === id);
    if (!participant) return;
    
    if (tournament.participants.some(p => p.id !== id && p.name.toLowerCase() === newName.toLowerCase())) {
        showNotification('Bu isim zaten var!', 'error');
        return;
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
        
        const item = document.createElement('div');
        item.className = `schedule-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`;
        
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
    
    if (days > 0) {
        return `${days}g ${hours}s ${minutes}d`;
    } else if (hours > 0) {
        return `${hours}s ${minutes}d ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}d ${seconds}s 🔴`;
    } else {
        return `${seconds}s 🔴🔴🔴`;
    }
}

function startCountdown() {
    setInterval(() => {
        document.getElementById('next-draw-countdown').textContent = getNextDrawCountdown();
        
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
    
    if (activeRound.drawCompleted) {
        return '🎲 Çekiliş yapıldı!';
    }
    
    const drawDate = new Date(activeRound.drawDate);
    return getCountdownText(drawDate);
}

// ============================================================
// CURRENT ROUND DISPLAY
// ============================================================

function updateCurrentRound() {
    const activeRound = tournament.rounds.find(r => !r.completed);
    
    if (!activeRound) {
        document.getElementById('round-title').textContent = 'Turnuva Tamamlandı';
        document.getElementById('matches-container').innerHTML = '<p style="text-align: center; padding: 20px;">Bütün turlar tamamlandı! 🏆</p>';
        return;
    }
    
    document.getElementById('round-title').textContent = activeRound.name;
    const matchesContainer = document.getElementById('matches-container');
    const drawDate = new Date(activeRound.drawDate);
    const now = new Date();
    const drawTimeReached = now >= drawDate;
    
    // If draw hasn't been completed yet
    if (!activeRound.drawCompleted || !activeRound.matches || activeRound.matches.length === 0) {
        if (!drawTimeReached) {
            const timeLeft = getCountdownText(drawDate);
            matchesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <h2 style="color: #667eea; font-size: 1.5em;">⏳ Çekiliş Henüz Yapılmadı</h2>
                    <p style="font-size: 1.2em; color: #764ba2; margin: 20px 0;">
                        <strong>${timeLeft}</strong> sonra <br>
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
                        Çekiliş zamanı geldi, sonuçlar yükleniyor 🎲
                    </p>
                </div>
            `;
        }
        return;
    }
    
    // Draw completed - show matches
    matchesContainer.innerHTML = '';
    const matches = activeRound.matches || [];
    
    matches.forEach((match, index) => {
        const player1 = tournament.participants.find(p => p.id === match.player1Id);
        const player2 = tournament.participants.find(p => p.id === match.player2Id);
        
        setTimeout(() => {
            const card = document.createElement('div');
            card.className = 'match-card';
            card.style.animation = 'slideIn 0.5s ease-out';
            
            const player1Score = match.result ? match.result.player1Score : '';
            const player2Score = match.result ? match.result.player2Score : '';
            
            let resultDisplay = '⏳';
            if (match.result) {
                const winnerId = match.result.winner;
                const p1Class = winnerId === match.player1Id ? 'color: #28a745; font-weight: bold;' : 'color: #dc3545;';
                const p2Class = winnerId === match.player2Id ? 'color: #28a745; font-weight: bold;' : 'color: #dc3545;';
                resultDisplay = `<span style="${p1Class}">${player1Score}</span> - <span style="${p2Class}">${player2Score}</span>`;
            }
            
            card.innerHTML = `
                <div class="player">
                    ${player1 ? `👤 ${player1.name}` : 'Bilinmeyen'}
                </div>
                <div class="vs">VS</div>
                <div class="player">
                    ${player2 ? `👤 ${player2.name}` : 'Bilinmeyen'}
                </div>
                <div style="margin-left: 20px; font-weight: bold; font-size: 1.2em;">
                    ${resultDisplay}
                </div>
            `;
            
            matchesContainer.appendChild(card);
        }, index * 300);
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
    
    const sorted = [...tournament.participants]
        .sort((a, b) => {
            const aWinRate = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
            const bWinRate = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
            return bWinRate - aWinRate || b.wins - a.wins;
        });
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Sıra</th>
                    <th>Katılımcı</th>
                    <th>Kazanış</th>
                    <th>Kaybediş</th>
                    <th>Oran %</th>
                    <th>Durum</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sorted.forEach((participant, index) => {
        const total = participant.wins + participant.losses;
        const rate = total > 0 ? ((participant.wins / total) * 100).toFixed(1) : '0.0';
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '▪️';
        const status = participant.eliminated ? '❌' : '✅';
        
        html += `
            <tr>
                <td>${medal} ${index + 1}</td>
                <td><strong>${participant.name}</strong></td>
                <td>${participant.wins}</td>
                <td>${participant.losses}</td>
                <td>${rate}%</td>
                <td>${status}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    standings.innerHTML = html;
}

// ============================================================
// MATCH RESULTS
// ============================================================

function updateMatchResultInputs() {
    const container = document.getElementById('match-result-input');
    const activeRound = tournament.rounds.find(r => !r.completed);
    
    if (!activeRound || !activeRound.matches || activeRound.matches.length === 0) {
        container.innerHTML = '<p style="color: #999;">Mevcut turda maç yok</p>';
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
        const player1 = tournament.participants.find(p => p.id === match.player1Id);
        const player2 = tournament.participants.find(p => p.id === match.player2Id);
        const score = match.result ? `(${match.result.player1Score}-${match.result.player2Score})` : '(?)';
        select.innerHTML += `<option value="${index}">${player1 ? player1.name : '?'} vs ${player2 ? player2.name : '?'} ${score}</option>`;
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
    
    if (isNaN(index)) {
        resultDiv.innerHTML = '';
        return;
    }
    
    const activeRound = tournament.rounds.find(r => !r.completed);
    if (!activeRound) return;
    
    const match = activeRound.matches[index];
    const player1 = tournament.participants.find(p => p.id === match.player1Id);
    const player2 = tournament.participants.find(p => p.id === match.player2Id);
    
    const p1Score = match.result ? match.result.player1Score : '';
    const p2Score = match.result ? match.result.player2Score : '';
    
    resultDiv.innerHTML = `
        <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 100px;">
                <strong>${player1 ? player1.name : 'Oyuncu 1'}</strong>
            </div>
            <div class="match-result-inputs">
                <input type="number" id="score1" value="${p1Score}" placeholder="0" min="0" max="100">
                <span>-</span>
                <input type="number" id="score2" value="${p2Score}" placeholder="0" min="0" max="100">
            </div>
            <div style="flex: 1; text-align: right; min-width: 100px;">
                <strong>${player2 ? player2.name : 'Oyuncu 2'}</strong>
            </div>
            <button onclick="saveMatchResult(${index})" class="btn btn-success">💾 Kaydet & GitHub'a Gönder</button>
        </div>
    `;
}

// Save Match Result -> pushes to GitHub
async function saveMatchResult(matchIndex) {
    const score1 = parseInt(document.getElementById('score1').value);
    const score2 = parseInt(document.getElementById('score2').value);
    
    if (isNaN(score1) || isNaN(score2)) {
        showNotification('Lütfen her iki skoru da girin', 'error');
        return;
    }
    
    const activeRound = tournament.rounds.find(r => !r.completed);
    if (!activeRound) return;
    
    const match = activeRound.matches[matchIndex];
    const player1 = tournament.participants.find(p => p.id === match.player1Id);
    const player2 = tournament.participants.find(p => p.id === match.player2Id);
    
    // Remove old result stats if updating
    if (match.result) {
        const oldWinner = match.result.winner;
        if (oldWinner === match.player1Id) {
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
    
    // Update standings
    if (score1 > score2) {
        player1.wins++;
        player2.losses++;
    } else {
        player2.wins++;
        player1.losses++;
    }
    
    // Check if all matches in this round are complete
    const allMatchesDone = activeRound.matches.every(m => m.result !== null);
    if (allMatchesDone) {
        activeRound.completed = true;
        
        // Eliminate losers
        activeRound.matches.forEach(m => {
            const loserId = m.result.winner === m.player1Id ? m.player2Id : m.player1Id;
            const loser = tournament.participants.find(p => p.id === loserId);
            if (loser) loser.eliminated = true;
        });
        
        // Advance current round
        tournament.currentRound++;
        
        showNotification(`🏆 ${activeRound.name} tamamlandı! Tüm maçlar bitti.`, 'success');
    }
    
    // Save and push to GitHub
    showNotification('💾 Kaydediliyor ve GitHub\'a gönderiliyor...', 'success');
    await saveDataAndSync();
    showNotification('Sonuç kaydedildi! ✨', 'success');
}

// ============================================================
// DRAW SYSTEM (THE CORE FIX)
// ============================================================

// Scheduled draw check - runs every 30 seconds
// ONLY triggers a draw if:
//   1. The round is not completed
//   2. The draw date has passed
//   3. drawCompleted is FALSE (draw hasn't been done yet)
//   4. Admin is logged in (only admin's browser triggers draws)
function checkAndRunScheduledDraws() {
    // Only admin's browser should trigger automatic draws
    if (!isAdminLoggedIn) {
        console.log('🔒 Admin değil, otomatik çekiliş tetiklenmez');
        return;
    }
    
    const now = new Date();
    let drawHappened = false;
    
    tournament.rounds.forEach(round => {
        if (!round.completed && 
            !round.drawCompleted && 
            now >= new Date(round.drawDate) &&
            (!round.matches || round.matches.length === 0)) {
            
            console.log(`🎲 Zamanlanmış çekiliş tetikleniyor: ${round.name}`);
            performDraw(round);
            drawHappened = true;
        }
    });
    
    if (drawHappened) {
        // Save to GitHub so everyone sees the same result
        saveDataAndSync();
    }
}

// The actual draw logic - creates matches ONCE
function performDraw(round) {
    // CRITICAL: If matches already exist, DO NOT recreate
    if (round.matches && round.matches.length > 0) {
        console.log(`ℹ️ ${round.name} çekilişi zaten yapılmış, atlanıyor`);
        if (!round.drawCompleted) {
            round.drawCompleted = true;
        }
        return false;
    }
    
    // CRITICAL: If drawCompleted is already true, DO NOT draw again
    if (round.drawCompleted) {
        console.log(`ℹ️ ${round.name} drawCompleted=true, çekiliş atlanıyor`);
        return false;
    }
    
    // Get eligible players
    let eligible = tournament.participants.filter(p => !p.eliminated);
    
    if (eligible.length < 2) {
        round.completed = true;
        round.drawCompleted = true;
        console.log(`⚠️ ${round.name}: Yeterli oyuncu yok (${eligible.length})`);
        return false;
    }
    
    // Initialize matches array
    round.matches = [];
    
    // Shuffle participants (Fisher-Yates)
    eligible = shuffleArray(eligible);
    
    // Validate shuffle result
    const ids = eligible.map(p => p.id);
    if (new Set(ids).size !== ids.length) {
        console.error('❌ HATA: Shuffle\'da duplicate!');
        return false;
    }
    
    // Create matches - pair sequentially
    for (let i = 0; i < eligible.length - 1; i += 2) {
        const p1 = eligible[i];
        const p2 = eligible[i + 1];
        
        round.matches.push({
            id: `match_${round.roundNumber}_${i/2}_${Date.now()}`,
            player1Id: p1.id,
            player2Id: p2.id,
            result: null
        });
        
        console.log(`⚔️ Maç ${Math.floor(i/2) + 1}: ${p1.name} vs ${p2.name}`);
    }
    
    // Handle bye (odd number of players)
    if (eligible.length % 2 === 1) {
        const byePlayer = eligible[eligible.length - 1];
        console.log(`🎫 ${byePlayer.name} bu turda bay geçiyor`);
    }
    
    // MARK DRAW AS COMPLETED - This is the key flag
    round.drawCompleted = true;
    
    console.log(`✅ ${round.name}: ${round.matches.length} maç oluşturuldu`);
    console.table(round.matches.map(m => {
        const p1 = tournament.participants.find(p => p.id === m.player1Id);
        const p2 = tournament.participants.find(p => p.id === m.player2Id);
        return {
            'Maç': m.id,
            'Oyuncu 1': p1?.name,
            'Oyuncu 2': p2?.name
        };
    }));
    
    showNotification(`🎉 ${round.name} Çekilişi Yapıldı! (${round.matches.length} maç)`, 'success');
    return true;
}

// Manual draw by admin
async function manualDrawRound(index) {
    const round = tournament.rounds[index];
    
    if (tournament.participants.length < 2) {
        showNotification('En az 2 katılımcı olmalı!', 'error');
        return;
    }
    
    if (round.drawCompleted || (round.matches && round.matches.length > 0)) {
        showNotification('Bu turun çekilişi zaten yapılmış!', 'error');
        return;
    }
    
    if (round.completed) {
        showNotification('Bu tur zaten tamamlandı!', 'error');
        return;
    }
    
    if (!confirm(`🎲 "${round.name}" için çekilişi yapmak istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`)) {
        return;
    }
    
    const success = performDraw(round);
    
    if (success) {
        // Save and push to GitHub immediately
        showNotification('💾 Çekiliş kaydediliyor ve GitHub\'a gönderiliyor...', 'success');
        await saveDataAndSync();
        updateAllUI();
    }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
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
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    if (tabName !== 'admin') {
        updateAllUI();
    }
}

// ============================================================
// ADMIN AUTH
// ============================================================

function adminLogin() {
    const password = document.getElementById('admin-password').value;
    
    if (!password) {
        showNotification('Şifreyi gir', 'error');
        return;
    }
    
    if (password === tournament.adminPassword) {
        isAdminLoggedIn = true;
        document.getElementById('admin-password').value = '';
        document.getElementById('admin-login-screen').style.display = 'none';
        document.getElementById('admin-panel-content').style.display = 'block';
        
        // Show token status
        const token = getGitHubToken();
        if (!token) {
            showNotification('🔑 GitHub token henüz girilmemiş! Yönetim panelinden girin.', 'error');
        }
        
        updateAllUI();
        updateGitHubTokenStatus();
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
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById('overview').classList.add('active');
    document.querySelectorAll('.nav-btn')[0].classList.add('active');
}

function changeAdminPassword() {
    const newPassword = document.getElementById('new-password').value.trim();
    
    if (!newPassword) {
        showNotification('Yeni şifreyi gir', 'error');
        return;
    }
    
    if (newPassword.length < 3) {
        showNotification('Şifre en az 3 karakter olmalı', 'error');
        return;
    }
    
    tournament.adminPassword = newPassword;
    document.getElementById('new-password').value = '';
    saveDataAndSync();
    showNotification('Şifre değiştirildi! 🔐', 'success');
}

// GitHub Token management
function saveGitHubToken() {
    const input = document.getElementById('github-token-input');
    const token = input.value.trim();
    
    if (!token) {
        showNotification('Token boş olamaz', 'error');
        return;
    }
    
    if (setGitHubToken(token)) {
        input.value = '';
        updateGitHubTokenStatus();
        showNotification('✅ GitHub token kaydedildi!', 'success');
    }
}

function clearGitHubToken() {
    localStorage.removeItem('githubToken');
    updateGitHubTokenStatus();
    showNotification('🗑️ GitHub token silindi', 'success');
}

function updateGitHubTokenStatus() {
    const statusEl = document.getElementById('github-token-status');
    if (!statusEl) return;
    
    const token = getGitHubToken();
    if (token) {
        statusEl.innerHTML = `<span style="color: #28a745;">✅ Token kayıtlı (${token.substring(0, 8)}...)</span>`;
    } else {
        statusEl.innerHTML = `<span style="color: #dc3545;">❌ Token girilmemiş</span>`;
    }
}

// ============================================================
// NOTIFICATIONS
// ============================================================

function showNotification(message, type = 'success') {
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
    if (confirm('⚠️ Turnuvayı sıfırlamak istediğinizden emin misiniz? Tüm veriler silinecektir!')) {
        localStorage.removeItem('tavlaTournament');
        tournament = createNewTournament();
        saveDataAndSync();
        showNotification('Turnuva sıfırlandı! 🔄', 'success');
    }
}

function downloadData() {
    const dataStr = JSON.stringify(tournament, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
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
            const data = JSON.parse(e.target.result);
            tournament = data;
            await saveDataAndSync();
            showNotification('Veriler yüklendi ve GitHub\'a gönderildi! 📤', 'success');
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
    manager.innerHTML = '';
    
    if (tournament.rounds.length === 0) {
        manager.innerHTML = '<p style="color: #999;">Henüz tur eklenmemiş. Aşağıdan yeni tur ekleyin.</p>';
        return;
    }
    
    tournament.rounds.forEach((round, index) => {
        const drawDate = new Date(round.drawDate);
        const dateStr = drawDate.toISOString().slice(0, 16);
        
        const isDrawDone = round.drawCompleted;
        const drawStatusColor = isDrawDone ? '#28a745' : '#ffc107';
        const drawStatusText = isDrawDone ? '🎲 Çekiliş yapıldı' : round.completed ? '✅ Tamamlandı' : '⏳ Bekleniyor';
        
        const item = document.createElement('div');
        item.className = 'round-item';
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
                <div style="padding: 8px; background: ${drawStatusColor}20; border: 1px solid ${drawStatusColor}; border-radius: 5px; text-align: center; font-weight: bold;">
                    ${drawStatusText}
                </div>
            </div>
            ${!isDrawDone && !round.completed ? `<button onclick="deleteRound(${index})" class="round-item-delete">🗑️ Sil</button>` : '<div></div>'}
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

// Save all round settings to GitHub
async function saveRoundsToGitHub() {
    showNotification('💾 Tur ayarları GitHub\'a kaydediliyor...', 'success');
    await saveDataAndSync();
}

// ============================================================
// MANUAL DRAW SECTION (Admin)
// ============================================================

function updateManualDrawSection() {
    const section = document.getElementById('manual-draw-section');
    section.innerHTML = '';
    
    if (tournament.rounds.length === 0) {
        section.innerHTML = '<p style="color: #999;">Henüz tur eklenmemiş</p>';
        return;
    }
    
    let content = '<div class="manual-draw-list">';
    
    tournament.rounds.forEach((round, index) => {
        const drawDate = new Date(round.drawDate);
        const now = new Date();
        const isCompleted = round.completed;
        const isDrawDone = round.drawCompleted;
        const isPast = now >= drawDate;
        
        let statusText;
        let statusColor;
        if (isDrawDone) {
            statusText = `✅ Çekiliş yapıldı (${round.matches?.length || 0} maç)`;
            statusColor = '#28a745';
        } else if (isPast) {
            statusText = '⚠️ Çekiliş zamanı geçti - Manuel yapabilirsiniz';
            statusColor = '#ffc107';
        } else {
            statusText = '⏳ Bekleniyor';
            statusColor = '#6c757d';
        }
        
        content += `
            <div class="manual-draw-item ${isDrawDone ? 'completed' : ''}">
                <div class="manual-draw-text">
                    <strong>${round.name}</strong><br>
                    <span class="countdown">📅 ${drawDate.toLocaleString('tr-TR')}</span><br>
                    <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
                </div>
                <button onclick="manualDrawRound(${index})" class="manual-draw-btn" ${isDrawDone || isCompleted || tournament.participants.length < 2 ? 'disabled' : ''}>
                    🎲 Çekiliş Yap
                </button>
            </div>
        `;
    });
    
    content += '</div>';
    section.innerHTML = content;
}

// Keep the old function name working for the button in HTML
function checkAndRun() {
    checkAndRunScheduledDraws();
}
