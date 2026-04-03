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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDataFromGitHub();
    initializeTournament();
    startCountdown();
    setInterval(checkAndRun, 10000); // Check every 10 seconds for draws
});

// Load data from GitHub
async function loadDataFromGitHub() {
    try {
        const url = 'https://raw.githubusercontent.com/mustafasacar35/tavla/main/data.json';
        const response = await fetch(url);
        const data = await response.json();
        tournament = data;
        localStorage.removeItem('tavlaTournament'); // Clear old cache first
        saveData(); // Save fresh data to localStorage
    } catch (error) {
        console.log('GitHub\'dan load edilemedi, localStorage\'dan yükleniyor', error);
        loadData();
    }
}

// Load data from localStorage or create new
function loadData() {
    const saved = localStorage.getItem('tavlaTournament');
    if (saved) {
        try {
            tournament = JSON.parse(saved);
        } catch (e) {
            console.log('Could not load saved data, starting fresh');
            tournament = createNewTournament();
        }
    } else {
        tournament = createNewTournament();
    }
    
    // Auto-backup every 5 minutes
    if (!window.autoBackupInterval) {
        window.autoBackupInterval = setInterval(() => {
            autoBackupData();
        }, 5 * 60 * 1000); // 5 dakikada bir
    }
}

// Auto Backup Data
function autoBackupData() {
    const dataStr = JSON.stringify(tournament, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `tavla_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('💾 Otomatik backup yapıldı!');
}

// Create new tournament structure
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

// Save data to localStorage
function saveData() {
    tournament.lastUpdated = new Date().toISOString();
    localStorage.setItem('tavlaTournament', JSON.stringify(tournament));
    updateAllUI();
}

// Initialize tournament UI
function initializeTournament() {
    // Ensure adminPassword exists
    if (!tournament.adminPassword) {
        tournament.adminPassword = "1234";
        saveData();
    }
    updateAllUI();
}

// Update all UI elements
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

// Update Overview Tab
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

// Add Participant
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

// Delete Participant
function deleteParticipant(id) {
    tournament.participants = tournament.participants.filter(p => p.id !== id);
    saveData();
    showNotification('Katılımcı silindi! 🗑️', 'success');
}

// Clear All Participants
function clearAllParticipants() {
    if (confirm('⚠️ TÜM katılımcıları silmek istediğinizden emin misiniz?')) {
        tournament.participants = [];
        saveData();
        showNotification('Hepsi silindi! 🗑️', 'success');
    }
}

// Update Participants Manager UI
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
        
        const editId = `edit-${p.id}`;
        
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

// Start Edit Participant
function startEditParticipant(id) {
    const participant = tournament.participants.find(p => p.id === id);
    if (!participant) return;
    
    const manager = document.getElementById('participants-manager');
    const items = manager.querySelectorAll('.participant-item');
    
    items.forEach(item => {
        if (item.dataset.editId === String(id)) {
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
    
    // If not found, update the manager
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

// Save Edit Participant
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
    
    // Check if name already exists
    if (tournament.participants.some(p => p.id !== id && p.name.toLowerCase() === newName.toLowerCase())) {
        showNotification('Bu isim zaten var!', 'error');
        return;
    }
    
    participant.name = newName;
    saveData();
    updateParticipantsManager();
    showNotification('İsim güncellendi! ✏️', 'success');
}

// Cancel Edit Participant
function cancelEditParticipant() {
    updateParticipantsManager();
}

// Update Schedule
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
        const isActive = now >= drawDate && !isCompleted;
        
        const item = document.createElement('div');
        item.className = `schedule-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`;
        item.innerHTML = `
            <div class="schedule-info">
                <h3>🎯 ${round.name}</h3>
                <p>📅 ${drawDate.toLocaleString('tr-TR')}</p>
                <p>${isCompleted ? '✅ Tamamlandı' : isActive ? '⏰ Çekiliş şu an aktif!' : '⏳ Bekleniyor'}</p>
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

// Update countdown every second
function startCountdown() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('next-draw-countdown').textContent = getNextDrawCountdown();
        
        // Update schedule countdowns
        tournament.rounds.forEach((round, index) => {
            const element = document.getElementById(`countdown-${index}`);
            if (element) {
                element.textContent = getCountdownText(new Date(round.drawDate));
            }
        });
    }, 1000);
}

function getNextDrawCountdown() {
    const now = new Date();
    const activeRound = tournament.rounds.find(r => !r.completed);
    
    if (!activeRound) return '📊 Turnuva bitti!';
    
    const drawDate = new Date(activeRound.drawDate);
    return getCountdownText(drawDate);
}

// Update Current Round With Animation
function updateCurrentRound() {
    const activeRound = tournament.rounds.find(r => !r.completed);
    
    if (!activeRound) {
        document.getElementById('round-title').textContent = 'Turnuva Tamamlandı';
        document.getElementById('matches-container').innerHTML = '<p style="text-align: center; padding: 20px;">Bütün turlar tamamlandı! 🏆</p>';
        return;
    }
    
    document.getElementById('round-title').textContent = activeRound.name;
    const matchesContainer = document.getElementById('matches-container');
    
    // Check if draw has been made
    if (!activeRound.matches || activeRound.matches.length === 0) {
        const drawDate = new Date(activeRound.drawDate);
        const now = new Date();
        const timeLeft = getCountdownText(drawDate);
        
        matchesContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h2 style="color: #667eea; font-size: 1.5em;">⏳ Çekilişi Henüz Yapılmadı</h2>
                <p style="font-size: 1.2em; color: #764ba2; margin: 20px 0;">
                    <strong>${timeLeft}</strong> sonra <br>
                    çekilişi sonuçları burada görülecek! 🎲
                </p>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-top: 20px;">
                    <p style="color: #666; margin: 0;">📅 Çekiliş Tarihi: <strong>${drawDate.toLocaleString('tr-TR')}</strong></p>
                </div>
            </div>
        `;
        return;
    }
    
    // Çekiliş yapıldı - maçları animasyonla göster
    matchesContainer.innerHTML = '';
    const matches = activeRound.matches || [];
    
    // Animasyonlu maç gösterme
    matches.forEach((match, index) => {
        const player1 = tournament.participants.find(p => p.id === match.player1Id);
        const player2 = tournament.participants.find(p => p.id === match.player2Id);
        
        // Her maç için gecikme ile ekle
        setTimeout(() => {
            const card = document.createElement('div');
            card.className = 'match-card';
            card.style.animation = 'slideIn 0.5s ease-out';
            
            const player1Score = match.result ? match.result.player1Score : '';
            const player2Score = match.result ? match.result.player2Score : '';
            
            card.innerHTML = `
                <div class="player">
                    ${player1 ? `👤 ${player1.name}` : 'Bilinmeyen'}
                </div>
                <div class="vs">VS</div>
                <div class="player">
                    ${player2 ? `👤 ${player2.name}` : 'Bilinmeyen'}
                </div>
                <div style="margin-left: 20px; font-weight: bold;">
                    ${player1Score !== '' ? `${player1Score} - ${player2Score}` : '⏳'}
                </div>
            `;
            
            matchesContainer.appendChild(card);
        }, index * 300); // Her 300ms'de bir maç ekle
    });
}

// Update Standings
function updateStandings() {
    const standings = document.getElementById('standings-table');
    
    if (tournament.participants.length === 0) {
        standings.innerHTML = '<p style="text-align: center; padding: 20px;">Henüz katılımcı eklenmemiş</p>';
        return;
    }
    
    // Calculate standings
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

// Update Match Result Inputs
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
        <div style="display: flex; gap: 15px; align-items: center;">
            <div style="flex: 1;">
                <strong>${player1 ? player1.name : 'Oyuncu 1'}</strong>
            </div>
            <div class="match-result-inputs">
                <input type="number" id="score1" value="${p1Score}" placeholder="0" min="0" max="100">
                <span>-</span>
                <input type="number" id="score2" value="${p2Score}" placeholder="0" min="0" max="100">
            </div>
            <div style="flex: 1; text-align: right;">
                <strong>${player2 ? player2.name : 'Oyuncu 2'}</strong>
            </div>
            <button onclick="saveMatchResult(${index})" class="btn btn-success">💾 Kaydet</button>
        </div>
    `;
}

// Save Match Result
function saveMatchResult(matchIndex) {
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
    
    saveData();
    showNotification('Sonuç kaydedildi! ✨', 'success');
}

// Check and Run Draws
function checkAndRun() {
    const now = new Date();
    let drawHappened = false;
    
    tournament.rounds.forEach(round => {
        // Only run draw if:
        // 1. Round not completed
        // 2. Draw time has passed
        // 3. Draw hasn't been done yet
        if (!round.completed && now >= new Date(round.drawDate) && !round.drawCompleted) {
            localStorage.removeItem('tavlaTournament'); // Force clear stale data
            runDraw(round);
            drawHappened = true;
        }
    });
    
    if (drawHappened) {
        saveData();
    }
}

// Run Draw (Create matches for a round)
function runDraw(round) {
    // If matches already created, don't recreate!
    if (round.matches && round.matches.length > 0) {
        console.log(`ℹ️ ${round.name} çekilişi zaten yapılmış`);
        // Mark draw as done so checkAndRun doesn't call this again
        if (!round.drawCompleted) {
            round.drawCompleted = true;
        }
        return;
    }
    
    // Get eligible players
    let eligible = tournament.participants.filter(p => !p.eliminated);
    
    if (eligible.length < 2) {
        round.completed = true;
        round.drawCompleted = true;
        return;
    }
    
    // Initialize matches array
    round.matches = [];
    
    // Shuffle participants
    eligible = shuffleArray(eligible);
    
    // Validate shuffle result
    const ids = eligible.map(p => p.id);
    if (new Set(ids).size !== ids.length) {
        console.error('❌ HATA: Shuffle\'da duplicate!');
        return;
    }
    
    // Create matches - pair sequentially
    for (let i = 0; i < eligible.length - 1; i += 2) {
        round.matches.push({
            id: `match_${round.roundNumber}_${i/2}_${Date.now()}`,
            player1Id: eligible[i].id,
            player2Id: eligible[i + 1].id,
            result: null
        });
    }
    
    // Mark draw as completed
    round.drawCompleted = true;
    
    console.log(`✅ ${round.name}: ${round.matches.length} maç oluşturuldu`);
    showNotification(`🎉 ${round.name} Çekilişi Yapıldı! (${round.matches.length} maç)`, 'success');
}

// Create Next Round
function createNextRound(roundNumber, previousDate) {
    const nextDate = new Date(previousDate);
    nextDate.setDate(nextDate.getDate() + 1);
    
    return {
        id: Date.now(),
        name: `${roundNumber}. Tur`,
        roundNumber: roundNumber,
        drawDate: nextDate.toISOString(),
        completed: false,
        matches: [],
        createWinnerRound: roundNumber < 5 // Limit rounds
    };
}

// Shuffle Array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Show Tabs
function showTab(tabName) {
    // Check admin access
    if (tabName === 'admin' && !isAdminLoggedIn) {
        document.getElementById('admin-login-screen').style.display = 'block';
        document.getElementById('admin-panel-content').style.display = 'none';
    } else if (tabName === 'admin' && isAdminLoggedIn) {
        document.getElementById('admin-login-screen').style.display = 'none';
        document.getElementById('admin-panel-content').style.display = 'block';
        updateAllUI();
    }
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Deactivate all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Activate corresponding nav button
    event.target.classList.add('active');
    
    if (tabName !== 'admin') {
        updateAllUI();
    }
}

// Admin Login
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
        updateAllUI();
        showNotification('Başarıyla giriş yaptın! ✅', 'success');
    } else {
        showNotification('Yanlış şifre! ❌', 'error');
        document.getElementById('admin-password').value = '';
    }
}

// Admin Logout
function adminLogout() {
    if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
        isAdminLoggedIn = false;
        document.getElementById('admin-login-screen').style.display = 'block';
        document.getElementById('admin-panel-content').style.display = 'none';
        showNotification('Çıkış yaptın 👋', 'success');
    }
}

// Cancel Admin Login
function cancelAdminLogin() {
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-login-screen').style.display = 'none';
    
    // Switch to another tab
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById('overview').classList.add('active');
    document.querySelectorAll('.nav-btn')[0].classList.add('active');
}

// Change Admin Password
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
    saveData();
    showNotification('Şifre değiştirildi! 🔐', 'success');
}

// Show Notification
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

// Play Notification Sound
function playNotificationSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// Reset Tournament
function resetTournament() {
    if (confirm('⚠️ Turnuvayı sıfırlamak istediğinizden emin misiniz? Tüm veriler silinecektir!')) {
        localStorage.removeItem('tavlaTournament');
        tournament = createNewTournament();
        saveData();
        showNotification('Turnuva sıfırlandı! 🔄', 'success');
    }
}

// Download Data
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

// Upload Data
function uploadData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            tournament = data;
            saveData();
            showNotification('Veriler yüklendi! 📤', 'success');
        } catch (error) {
            showNotification('Dosya yüklenemedi! ❌', 'error');
        }
    };
    reader.readAsText(file);
}

// Update Rounds Manager
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
        
        const item = document.createElement('div');
        item.className = 'round-item';
        item.innerHTML = `
            <div>
                <div class="round-item-label">Tur Adı</div>
                <input type="text" value="${round.name}" onchange="updateRoundName(${index}, this.value)" style="width: 100%;">
            </div>
            <div>
                <div class="round-item-label">Tarih ve Saat</div>
                <input type="datetime-local" value="${dateStr}" onchange="updateRoundDate(${index}, this.value)">
            </div>
            <div>
                <div class="round-item-label">Durum</div>
                <select disabled style="width: 100%;">
                    <option>${round.completed ? '✅ Tamamlandı' : '⏳ Bekleniyor'}</option>
                </select>
            </div>
            <button onclick="deleteRound(${index})" class="round-item-delete">🗑️ Sil</button>
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
        matches: [],
        createWinnerRound: true
    });
    
    saveData();
    showNotification('Yeni tur eklendi! ➕', 'success');
}

// Update Manual Draw Section
function updateManualDrawSection() {
    const section = document.getElementById('manual-draw-section');
    section.innerHTML = '';
    
    if (tournament.rounds.length === 0) {
        section.innerHTML = '<p style="color: #999;">Henüz tur eklenmemiş</p>';
        return;
    }
    
    const html = '<div class="manual-draw-list">';
    let content = '';
    
    tournament.rounds.forEach((round, index) => {
        const drawDate = new Date(round.drawDate);
        const now = new Date();
        const isCompleted = round.completed;
        const isPast = now >= drawDate;
        
        content += `
            <div class="manual-draw-item ${isCompleted ? 'completed' : ''}">
                <div class="manual-draw-text">
                    <strong>${round.name}</strong><br>
                    <span class="countdown">📅 ${drawDate.toLocaleString('tr-TR')}</span><br>
                    <span>${isCompleted ? '✅ Çekilişi yapıldı' : isPast ? '⚠️ Geçti' : '⏳ Bekleniyor'}</span>
                </div>
                <button onclick="manualDrawRound(${index})" class="manual-draw-btn" ${isCompleted || tournament.participants.length < 2 ? 'disabled' : ''}>
                    🎲 Çekiliş Yap
                </button>
            </div>
        `;
    });
    
    section.innerHTML = html + content + '</div>';
}

function manualDrawRound(index) {
    const round = tournament.rounds[index];
    
    if (tournament.participants.length < 2) {
        showNotification('En az 2 katılımcı olmalı!', 'error');
        return;
    }
    
    if (round.completed) {
        showNotification('Bu tur zaten tamamlandı!', 'error');
        return;
    }
    
    runDraw(round);
    saveData();
    updateAllUI();
}
