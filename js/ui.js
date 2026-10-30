export class UIManager {
  constructor(contentData, courseManager, sceneInstance, livingWorld) {
    this.content = contentData;
    this.course = courseManager;
    this.scene = sceneInstance;
    this.living = livingWorld;

    this.activeDialogueTarget = null;
    this.dialogueIndex = 0;
    this.audioCtx = null;
    this.isAudioPlaying = false;

    this.initThemeAndFont();
    this.setupModalTriggers();
    this.setupAudio();
    this.setupDialogueActions();
    this.renderLocationsList('all');
    this.updateCounters();
  }

  initThemeAndFont() {
    // 1. Font size
    const savedFontSize = localStorage.getItem('wh_font_size') || 'medium';
    this.setFontSize(savedFontSize);

    document.getElementById('font-small').addEventListener('click', () => this.setFontSize('small'));
    document.getElementById('font-medium').addEventListener('click', () => this.setFontSize('medium'));
    document.getElementById('font-large').addEventListener('click', () => this.setFontSize('large'));

    // 2. Theme
    const savedTheme = localStorage.getItem('wh_theme') || 'auto';
    this.setTheme(savedTheme);

    document.getElementById('theme-auto').addEventListener('click', () => this.setTheme('auto'));
    document.getElementById('theme-morning').addEventListener('click', () => this.setTheme('晨光'));
    document.getElementById('theme-mist').addEventListener('click', () => this.setTheme('海霧'));
    document.getElementById('theme-night').addEventListener('click', () => this.setTheme('夜海'));

    // 3. Day/Night switches
    document.getElementById('dn-day').addEventListener('click', () => this.living.setTimeOfDay('day'));
    document.getElementById('dn-dusk').addEventListener('click', () => this.living.setTimeOfDay('dusk'));
    document.getElementById('dn-night').addEventListener('click', () => this.living.setTimeOfDay('night'));
    document.getElementById('dn-auto').addEventListener('click', () => this.living.setTimeOfDay('auto'));

    // 4. Quality & Motion
    const qualityBtn = document.getElementById('btn-quality');
    qualityBtn.addEventListener('click', () => {
      const isHigh = this.scene.quality === 'high';
      const newQ = isHigh ? 'low' : 'high';
      this.scene.setQuality(newQ);
      qualityBtn.textContent = newQ === 'high' ? '💎 極致' : '⚡ 效能';
    });

    const motionBtn = document.getElementById('btn-motion');
    motionBtn.addEventListener('click', () => {
      this.scene.reducedMotion = !this.scene.reducedMotion;
      document.body.classList.toggle('reduced-motion', this.scene.reducedMotion);
      motionBtn.classList.toggle('active', this.scene.reducedMotion);
    });
  }

  setFontSize(size) {
    document.documentElement.setAttribute('data-font-size', size);
    localStorage.setItem('wh_font_size', size);

    ['small', 'medium', 'large'].forEach(s => {
      const btn = document.getElementById(`font-${s}`);
      if (btn) btn.classList.toggle('active', s === size);
    });
  }

  setTheme(themeName) {
    localStorage.setItem('wh_theme', themeName);

    ['auto', 'morning', 'mist', 'night'].forEach(t => {
      const btn = document.getElementById(`theme-${t}`);
      if (btn) btn.classList.remove('active');
    });

    if (themeName === 'auto') {
      document.getElementById('theme-auto').classList.add('active');
      // Sync with daytime
      const t = this.living.dayTime;
      const autoTheme = (t >= 0.2 && t < 0.65) ? '晨光' : (t >= 0.65 && t < 0.85 ? '海霧' : '夜海');
      document.documentElement.setAttribute('data-theme', autoTheme);
    } else {
      if (themeName === '晨光') document.getElementById('theme-morning').classList.add('active');
      if (themeName === '海霧') document.getElementById('theme-mist').classList.add('active');
      if (themeName === '夜海') document.getElementById('theme-night').classList.add('active');
      document.documentElement.setAttribute('data-theme', themeName);
    }
  }

  setupModalTriggers() {
    // Open modal buttons
    const bindModal = (btnId, modalId) => {
      const btn = document.getElementById(btnId);
      const modal = document.getElementById(modalId);
      if (btn && modal) {
        btn.addEventListener('click', () => {
          modal.classList.add('open');
          if (modalId === 'modal-backpack') this.renderBackpack();
          if (modalId === 'modal-collection') this.renderCollection();
          if (modalId === 'modal-cert') this.renderCertificate();
        });
      }
    };

    bindModal('btn-brand-story', 'modal-brand');
    bindModal('btn-open-list', 'modal-list');
    bindModal('btn-open-search', 'modal-search');
    bindModal('btn-open-backpack', 'modal-backpack');
    bindModal('btn-open-collection', 'modal-collection');
    bindModal('btn-open-guide', 'modal-guide');
    bindModal('btn-open-cert', 'modal-cert');
    bindModal('btn-open-share', 'modal-share');

    // Close buttons on all modals
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        if (modalId) document.getElementById(modalId).classList.remove('open');
      });
    });

    // Close modal on background click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    });

    // Search action
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('btn-run-search');
    const doSearch = () => this.runSearch(searchInput.value.trim());
    if (searchBtn) searchBtn.addEventListener('click', doSearch);
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
      });
    }

    // Guide QA action
    const guideInput = document.getElementById('guide-input');
    const guideBtn = document.getElementById('btn-guide-ask');
    const doGuide = () => this.runGuideQA(guideInput.value.trim());
    if (guideBtn) guideBtn.addEventListener('click', doGuide);
    if (guideInput) {
      guideInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doGuide();
      });
    }

    // Reset camera button
    const resetCamBtn = document.getElementById('btn-reset-camera');
    if (resetCamBtn) {
      resetCamBtn.addEventListener('click', () => {
        this.course.closePanel();
        this.scene.resetToOverview();
      });
    }

    // Cinema skip button
    const skipBtn = document.getElementById('cinema-skip-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => this.scene.skipCinema());
    }

    // Share link copy
    const copyShareBtn = document.getElementById('btn-copy-share-url');
    if (copyShareBtn) {
      copyShareBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
          copyShareBtn.textContent = '✅ 已複製網址！';
          setTimeout(() => { copyShareBtn.textContent = '📋 複製分享網址'; }, 2000);
        });
      });
    }

    // Print certificate
    const printCertBtn = document.getElementById('btn-print-cert');
    if (printCertBtn) {
      printCertBtn.addEventListener('click', () => window.print());
    }

    const certNameInput = document.getElementById('cert-name-input');
    if (certNameInput) {
      certNameInput.addEventListener('input', (e) => {
        document.getElementById('cert-user-name').textContent = e.target.value.trim() || '職場健康實踐家';
      });
    }

    // Clear backpack
    const clearBpBtn = document.getElementById('btn-clear-backpack');
    if (clearBpBtn) {
      clearBpBtn.addEventListener('click', () => {
        if (confirm('確定要清空背包物資與探索進度嗎？')) {
          localStorage.clear();
          location.reload();
        }
      });
    }

    // Filter sea buttons
    document.querySelectorAll('#sea-filter-container .tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#sea-filter-container .tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter');
        this.renderLocationsList(filter);
      });
    });
  }

  renderLocationsList(filter) {
    const listContainer = document.getElementById('location-cards-list');
    let html = '';

    const allIslands = [this.content.centerIsland, ...this.content.islands];
    allIslands.forEach(isld => {
      const isCenter = isld.id === 'island-00';
      const groupName = isCenter ? '核心行政' : isld.group;

      if (filter !== 'all' && groupName !== filter) return;

      const isVisited = this.course.storage.visited.includes(isld.id);
      const score = this.course.storage.quizScores[isld.id];

      html += `
        <div class="worksheet-card" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
          <div>
            <span class="panel-group-badge">${groupName}</span>
            <div style="font-family:var(--font-heading); font-size:1.1rem; font-weight:bold; color:var(--primary);">${isld.name}</div>
            <div style="font-size:0.85rem; color:var(--ink-light); margin-top:2px;">${isCenter ? isld.description : isld.intro}</div>
            <div style="font-size:0.75rem; color:var(--muted); margin-top:4px;">
              ${isVisited ? '🟢 已探索' : '⚪ 未拜訪'} ${score !== undefined ? ` ｜ 測驗：${score}分` : ''}
            </div>
          </div>
          <button class="export-btn go-island-btn" data-id="${isld.id}">進入島嶼</button>
        </div>
      `;
    });

    listContainer.innerHTML = html;

    listContainer.querySelectorAll('.go-island-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        document.getElementById('modal-list').classList.remove('open');
        this.scene.flyToIsland(id, () => {
          this.course.openIsland(id);
        });
      });
    });
  }

  runSearch(query) {
    const resultsContainer = document.getElementById('search-results-list');
    if (!query) {
      resultsContainer.innerHTML = '<p style="color:var(--muted);">請輸入關鍵字進行搜尋。</p>';
      return;
    }

    const q = query.toLowerCase();
    const matches = [];

    // Search in islands
    this.content.islands.forEach(isld => {
      let score = 0;
      if (isld.name.toLowerCase().includes(q)) score += 5;
      if (isld.intro.toLowerCase().includes(q)) score += 3;
      if (isld.points.some(p => p.toLowerCase().includes(q))) score += 2;
      if (isld.contentMarkdown && isld.contentMarkdown.toLowerCase().includes(q)) score += 1;

      if (score > 0) {
        matches.push({ island: isld, score, preview: isld.intro });
      }
    });

    if (matches.length === 0) {
      resultsContainer.innerHTML = `<p style="color:var(--muted);">未找到與「${query}」相符的內容，試試看搜尋「法規」、「危害」、「過勞」、「伸展」或「ESG」！</p>`;
      return;
    }

    let html = `<p style="font-size:0.85rem; color:var(--muted); margin-bottom:10px;">找到 ${matches.length} 項相符結果：</p>`;
    matches.sort((a, b) => b.score - a.score).forEach(m => {
      html += `
        <div class="worksheet-card" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:bold; color:var(--primary);">${m.island.name}</div>
            <div style="font-size:0.85rem; color:var(--ink);">${m.preview}</div>
          </div>
          <button class="export-btn go-island-btn" data-id="${m.island.id}">閱讀內容</button>
        </div>
      `;
    });

    resultsContainer.innerHTML = html;
    resultsContainer.querySelectorAll('.go-island-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        document.getElementById('modal-search').classList.remove('open');
        this.scene.flyToIsland(id, () => {
          this.course.openIsland(id);
        });
      });
    });
  }

  runGuideQA(query) {
    const answersContainer = document.getElementById('guide-answers-list');
    if (!query) {
      answersContainer.innerHTML = '<p style="color:var(--muted);">請輸入問題關鍵字，如：退避權、SDS、久坐、478呼吸法...</p>';
      return;
    }

    const q = query.toLowerCase();
    const qaList = this.content.guideQA || [];
    const results = qaList.filter(item => {
      return item.keywords.some(k => q.includes(k.toLowerCase()) || k.toLowerCase().includes(q)) ||
             item.question.toLowerCase().includes(q) ||
             item.answer.toLowerCase().includes(q);
    });

    if (results.length === 0) {
      answersContainer.innerHTML = `
        <div class="qa-card" style="border-left-color:var(--accent);">
          <div class="qa-question">小鹿正在查閱講義資料庫...</div>
          <div class="qa-answer">找不到與「${query}」完全吻合的問答。建議嘗試點擊下方熱門主題：退避權、危害分類、SDS、478呼吸法、人體工學坐姿、PDCA、ESG！</div>
        </div>
      `;
      return;
    }

    let html = '';
    results.forEach(res => {
      html += `
        <div class="qa-card">
          <div class="qa-question">❓ ${res.question}</div>
          <div class="qa-answer">${res.answer}</div>
          <div class="qa-source">📖 出處：<a href="#" class="qa-goto-link" data-id="${res.islandId}">${res.islandName}</a></div>
        </div>
      `;
    });

    answersContainer.innerHTML = html;
    answersContainer.querySelectorAll('.qa-goto-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = link.getAttribute('data-id');
        if (id && id.startsWith('island-')) {
          document.getElementById('modal-guide').classList.remove('open');
          this.scene.flyToIsland(id, () => {
            this.course.openIsland(id);
          });
        }
      });
    });
  }

  renderBackpack() {
    const grid = document.getElementById('inventory-grid');
    const bp = this.course.storage.backpack;

    const itemMeta = {
      'item-shell': { name: '海灘貝殼', icon: '🐚' },
      'item-goggles': { name: '防護護目鏡', icon: '🥽' },
      'item-tube': { name: '採樣試管', icon: '🧪' },
      'item-tea': { name: '舒壓洋甘菊茶', icon: '🍵' },
      'item-band': { name: '活力彈力帶', icon: '🎗️' },
      'item-blueprint': { name: '健促企劃藍圖', icon: '📋' },
      'item-medal': { name: '健康領航金獎章', icon: '🏆' }
    };

    let html = '';
    for (const [id, count] of Object.entries(bp)) {
      if (count > 0 && itemMeta[id]) {
        html += `
          <div class="inventory-slot has-item">
            <span class="inv-count">${count}</span>
            <div class="inv-icon">${itemMeta[id].icon}</div>
            <div class="inv-name">${itemMeta[id].name}</div>
          </div>
        `;
      }
    }

    if (!html) {
      html = '<p style="color:var(--muted); grid-column:1/-1;">背包目前空空如也，快去沙灘撿拾貝殼與居民交易吧！</p>';
    }

    grid.innerHTML = html;
  }

  renderCollection() {
    const grid = document.getElementById('collection-cards-grid');
    const stats = this.course.getProgressStats();

    document.getElementById('collection-percent-text').textContent = `${stats.percent}%`;
    document.getElementById('collection-progress-bar').style.width = `${stats.percent}%`;

    let html = '';
    this.content.islands.forEach(isld => {
      const isVisited = this.course.storage.visited.includes(isld.id);
      const score = this.course.storage.quizScores[isld.id];

      html += `
        <div class="inventory-slot ${isVisited ? 'has-item' : ''}">
          <div class="inv-icon">${isVisited ? '🏝️' : '🔒'}</div>
          <div class="inv-name">${isld.name}</div>
          <div style="font-size:0.75rem; color:${score ? 'var(--accent)' : 'var(--muted)'};">
            ${score !== undefined ? `${score}分` : (isVisited ? '已訪' : '未訪')}
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  renderCertificate() {
    const dateEl = document.getElementById('cert-issue-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('zh-TW');
  }

  updateCounters() {
    const stats = this.course.getProgressStats();
    const bpCounter = document.getElementById('backpack-counter');
    const colCounter = document.getElementById('collection-counter');

    let totalItems = 0;
    for (const count of Object.values(this.course.storage.backpack)) {
      totalItems += count;
    }

    if (bpCounter) bpCounter.textContent = totalItems;
    if (colCounter) colCounter.textContent = `${stats.visitedCount}/${stats.totalIslands}`;
  }

  showDialogueBubble(targetData, screenPos) {
    this.activeDialogueTarget = targetData;
    this.dialogueIndex = 0;

    const bubble = document.getElementById('dialogue-bubble');
    document.getElementById('dlg-avatar').textContent = targetData.avatar || (targetData.icon || '🧑');
    document.getElementById('dlg-name').textContent = targetData.name || '居民';
    document.getElementById('dlg-title').textContent = targetData.title || (targetData.type === 'animal' ? '島上動物' : '訪客');

    const dlgText = document.getElementById('dlg-text');
    if (targetData.dialogues && targetData.dialogues.length > 0) {
      dlgText.textContent = targetData.dialogues[0];
    } else if (targetData.talk) {
      dlgText.textContent = targetData.talk;
    } else {
      dlgText.textContent = '歡迎來到這座島嶼，記得保持身心健康！';
    }

    // Trade button visibility
    const tradeBtn = document.getElementById('btn-dialogue-trade');
    if (targetData.tradeId) {
      tradeBtn.style.display = 'inline-flex';
    } else {
      tradeBtn.style.display = 'none';
    }

    // Position bubble smoothly
    bubble.style.left = `${Math.min(window.innerWidth - 160, Math.max(160, screenPos.x))}px`;
    bubble.style.top = `${Math.max(100, screenPos.y - 40)}px`;
    bubble.style.display = 'block';

    this.playTone(440, 'triangle', 0.15);
  }

  setupDialogueActions() {
    const closeBtn = document.getElementById('btn-close-dialogue');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('dialogue-bubble').style.display = 'none';
        this.activeDialogueTarget = null;
      });
    }

    const moreBtn = document.getElementById('btn-dialogue-more');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        if (!this.activeDialogueTarget) return;
        const dlgs = this.activeDialogueTarget.dialogues;
        if (dlgs && dlgs.length > 1) {
          this.dialogueIndex = (this.dialogueIndex + 1) % dlgs.length;
          document.getElementById('dlg-text').textContent = dlgs[this.dialogueIndex];
          this.playTone(520, 'sine', 0.12);
        }
      });
    }

    const tradeBtn = document.getElementById('btn-dialogue-trade');
    if (tradeBtn) {
      tradeBtn.addEventListener('click', () => this.executeTrade());
    }
  }

  executeTrade() {
    if (!this.activeDialogueTarget || !this.activeDialogueTarget.tradeId) return;
    const trade = this.content.trades.find(t => t.id === this.activeDialogueTarget.tradeId);
    if (!trade) return;

    const bp = this.course.storage.backpack;
    const giveCount = bp[trade.give.id] || 0;

    if (giveCount < trade.give.count) {
      alert(`物資不足！需要 ${trade.give.count} 個【${trade.give.name}】才可以交換喔！\n快去沙灘撿貝殼或向上一位居民換取！`);
      return;
    }

    // Deduct & Add
    bp[trade.give.id] -= trade.give.count;
    bp[trade.get.id] = (bp[trade.get.id] || 0) + trade.get.count;
    this.course.saveStorage();
    this.updateCounters();

    document.getElementById('dlg-text').textContent = `🎉 交換成功！你獲得了【${trade.get.name}】！太感謝你了！`;
    this.playTradeSuccessSound();
  }

  setupAudio() {
    const audioBtn = document.getElementById('btn-audio');
    audioBtn.addEventListener('click', () => {
      if (!this.isAudioPlaying) {
        this.startBGM();
        audioBtn.textContent = '🔊 音樂';
        audioBtn.classList.add('active');
        this.isAudioPlaying = true;
      } else {
        this.stopBGM();
        audioBtn.textContent = '🔇 音樂';
        audioBtn.classList.remove('active');
        this.isAudioPlaying = false;
      }
    });
  }

  startBGM() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      // Gentle procedural pentatonic melody
      const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // C D E G A C
      this.bgmTimer = setInterval(() => {
        if (!this.isAudioPlaying) return;
        const note = notes[Math.floor(Math.random() * notes.length)];
        this.playGentleChime(note);
      }, 1800);
    } catch (e) {
      console.warn('AudioContext not allowed without gesture', e);
    }
  }

  stopBGM() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  playGentleChime(freq) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

    gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 1.6);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 1.6);
  }

  playTone(freq, type = 'sine', duration = 0.2) {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch(e) {}
  }

  playTradeSuccessSound() {
    this.playTone(523.25, 'triangle', 0.2);
    setTimeout(() => this.playTone(659.25, 'triangle', 0.25), 120);
    setTimeout(() => this.playTone(783.99, 'triangle', 0.35), 240);
  }
}
