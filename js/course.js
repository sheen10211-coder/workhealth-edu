export class CourseManager {
  constructor(contentData, onProgressUpdate) {
    this.content = contentData;
    this.onProgressUpdate = onProgressUpdate;
    this.currentIsland = null;

    this.panel = document.getElementById('content-panel');
    this.tabs = document.querySelectorAll('.tab-btn');
    this.panes = document.querySelectorAll('.tab-pane');

    this.initStorage();
    this.setupEventListeners();
  }

  initStorage() {
    this.storage = {
      visited: JSON.parse(localStorage.getItem('wh_visited') || '[]'),
      worksheets: JSON.parse(localStorage.getItem('wh_worksheets') || '{}'),
      quizScores: JSON.parse(localStorage.getItem('wh_quiz_scores') || '{}'),
      centerQuizScore: parseInt(localStorage.getItem('wh_center_quiz_score') || '-1'),
      backpack: JSON.parse(localStorage.getItem('wh_backpack') || '{"item-shell": 3}'),
      unlockedTrades: JSON.parse(localStorage.getItem('wh_trades') || '[]')
    };
  }

  saveStorage() {
    localStorage.setItem('wh_visited', JSON.stringify(this.storage.visited));
    localStorage.setItem('wh_worksheets', JSON.stringify(this.storage.worksheets));
    localStorage.setItem('wh_quiz_scores', JSON.stringify(this.storage.quizScores));
    localStorage.setItem('wh_center_quiz_score', this.storage.centerQuizScore.toString());
    localStorage.setItem('wh_backpack', JSON.stringify(this.storage.backpack));
    localStorage.setItem('wh_trades', JSON.stringify(this.storage.unlockedTrades));

    if (this.onProgressUpdate) {
      this.onProgressUpdate(this.getProgressStats());
    }
  }

  getProgressStats() {
    const totalIslands = (this.content.islands || []).length;
    const visitedCount = this.storage.visited.length;
    const percent = Math.min(100, Math.round((visitedCount / totalIslands) * 100));
    return {
      visitedCount,
      totalIslands,
      percent,
      storage: this.storage
    };
  }

  setupEventListeners() {
    // Tab switching
    this.tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });

    // Close panel
    const closeBtn = document.getElementById('btn-close-panel');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePanel());
    }

    // Export worksheet
    const exportWsBtn = document.getElementById('btn-export-worksheet');
    if (exportWsBtn) {
      exportWsBtn.addEventListener('click', () => this.exportCurrentWorksheet());
    }

    // Center review quiz submit
    const submitCenterBtn = document.getElementById('btn-submit-center-quiz');
    if (submitCenterBtn) {
      submitCenterBtn.addEventListener('click', () => this.submitCenterQuiz());
    }

    // Retry quiz
    const retryBtn = document.getElementById('btn-retry-quiz');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        if (this.currentIsland) {
          delete this.storage.quizScores[this.currentIsland.id];
          this.saveStorage();
          this.renderQuiz(this.currentIsland);
        }
      });
    }

    // Keyboard ESC closes panel
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.panel.classList.contains('open')) {
        this.closePanel();
      }
    });
  }

  switchTab(tabId) {
    this.tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tabId));
    this.panes.forEach(p => p.classList.toggle('active', p.id === tabId.replace('tab-', 'pane-')));
  }

  openIsland(islandId) {
    if (!this.storage.visited.includes(islandId)) {
      this.storage.visited.push(islandId);
      this.saveStorage();
    }

    const isCenter = (islandId === 'island-00');
    const island = isCenter ? this.content.centerIsland : this.content.islands.find(i => i.id === islandId);
    if (!island) return;

    this.currentIsland = island;

    // Set Header info
    document.getElementById('panel-group-badge').textContent = isCenter ? '核心行政・總複習' : (island.group || '專業模組');
    document.getElementById('panel-island-title').textContent = island.name;
    document.getElementById('panel-tagline').textContent = isCenter ? island.description : island.intro;

    const extraBanner = document.getElementById('panel-extra-banner');
    if (isCenter) {
      extraBanner.style.display = 'block';
      document.getElementById('panel-extra-text').textContent = '跨課整合診斷與健康總複習';
    } else {
      extraBanner.style.display = 'block';
      document.getElementById('panel-extra-text').textContent = island.extra || '能說出職場常見危害並理解基本法令保護機制';
    }

    // Toggle tabs visibility for center vs course
    const tabsContainer = document.getElementById('panel-tabs');
    if (isCenter) {
      tabsContainer.style.display = 'none';
      this.panes.forEach(p => p.classList.remove('active'));
      document.getElementById('pane-center-hospital').classList.add('active');
      this.renderCenterHospital();
    } else {
      tabsContainer.style.display = 'flex';
      this.panes.forEach(p => p.classList.remove('active'));
      document.getElementById('pane-textbook').classList.add('active');
      this.tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === 'tab-textbook'));

      this.renderTextbook(island);
      this.renderWorksheet(island);
      this.renderQuiz(island);
    }

    this.panel.classList.add('open');
  }

  closePanel() {
    this.panel.classList.remove('open');
    this.currentIsland = null;
  }

  renderTextbook(island) {
    const target = document.getElementById('textbook-render-target');
    let md = island.contentMarkdown || '';

    // Convert markdown to rich HTML
    target.innerHTML = this.markdownToHtml(md);

    // Download button link
    const dlLink = document.getElementById('link-download-material');
    if (island.materialFile) {
      dlLink.href = island.materialFile;
      dlLink.style.display = 'inline-flex';
    } else {
      dlLink.style.display = 'none';
    }
  }

  renderWorksheet(island) {
    const target = document.getElementById('worksheet-render-target');
    const wsList = island.worksheet || [];

    if (wsList.length === 0) {
      target.innerHTML = '<p style="color:var(--muted);">此單元無自訂實作學習單。</p>';
      return;
    }

    let html = '';
    wsList.forEach((ws, idx) => {
      const storageKey = `${island.id}_${ws.id}`;
      const savedText = this.storage.worksheets[storageKey] || '';

      html += `
        <div class="worksheet-card">
          <div class="ws-title">任務 ${idx + 1}：${ws.question}</div>
          <textarea class="ws-textarea" data-key="${storageKey}" placeholder="${ws.placeholder || '請在此輸入您的見解與回答...'}">${savedText}</textarea>
          <div class="ws-actions">
            <span class="save-status" id="save-status-${storageKey}">✅ 已自動暫存</span>
          </div>
        </div>
      `;
    });

    target.innerHTML = html;

    // Attach auto-save listener
    target.querySelectorAll('.ws-textarea').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const key = e.target.getAttribute('data-key');
        const text = e.target.value;
        this.storage.worksheets[key] = text;
        this.saveStorage();
        const statusEl = document.getElementById(`save-status-${key}`);
        if (statusEl) {
          statusEl.textContent = '💾 儲存中...';
          setTimeout(() => { statusEl.textContent = '✅ 已自動暫存'; }, 300);
        }
      });
    });
  }

  exportCurrentWorksheet() {
    if (!this.currentIsland) return;
    const wsList = this.currentIsland.worksheet || [];
    let mdContent = `# 職人健康領航島｜實作學習單回饋\n\n`;
    mdContent += `**課程島嶼**：${this.currentIsland.name}\n`;
    mdContent += `**導師**：ㄚ秀姐姐／輔英科技大學\n`;
    mdContent += `**填寫日期**：${new Date().toLocaleDateString('zh-TW')}\n\n---\n\n`;

    wsList.forEach((ws, idx) => {
      const key = `${this.currentIsland.id}_${ws.id}`;
      const ans = this.storage.worksheets[key] || '（尚未填寫）';
      mdContent += `### 問題 ${idx + 1}：${ws.question}\n\n> **我的實作回答**：\n\n${ans}\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentIsland.name}_學習單.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  renderQuiz(island) {
    const target = document.getElementById('quiz-render-target');
    const quizList = island.quiz || [];
    const statusBadge = document.getElementById('tab-quiz-status');
    const scoreBadge = document.getElementById('quiz-score-badge');
    const retryBtn = document.getElementById('btn-retry-quiz');

    const savedScore = this.storage.quizScores[island.id];
    const isCompleted = savedScore !== undefined;

    if (isCompleted) {
      statusBadge.textContent = `${savedScore} 分`;
      scoreBadge.textContent = `測驗成果：${savedScore} / 100 分`;
      retryBtn.style.display = 'inline-flex';
    } else {
      statusBadge.textContent = '未測';
      scoreBadge.textContent = '';
      retryBtn.style.display = 'none';
    }

    let html = '';
    quizList.forEach((q, qIdx) => {
      html += `
        <div class="quiz-item" data-qid="${q.id}">
          <span class="quiz-q-num">第 ${qIdx + 1} 題</span>
          <div class="quiz-question">${q.question}</div>
          <div class="quiz-options">
            ${q.options.map(opt => `
              <button class="quiz-opt-btn ${isCompleted ? 'locked' : ''}" data-opt="${opt.id}" data-correct="${q.answer}">
                <b>[${opt.id}]</b> ${opt.text}
              </button>
            `).join('')}
          </div>
          <div class="quiz-explanation" style="${isCompleted ? 'display:block;' : ''}">
            <b>💡 解析：</b>${q.explanation}
          </div>
        </div>
      `;
    });

    target.innerHTML = html;

    // Attach answer click
    if (!isCompleted) {
      target.querySelectorAll('.quiz-item').forEach(item => {
        const btns = item.querySelectorAll('.quiz-opt-btn');
        const expl = item.querySelector('.quiz-explanation');

        btns.forEach(btn => {
          btn.addEventListener('click', () => {
            if (btns[0].classList.contains('locked')) return;

            const selected = btn.getAttribute('data-opt');
            const correct = btn.getAttribute('data-correct');

            btns.forEach(b => {
              b.classList.add('locked');
              if (b.getAttribute('data-opt') === correct) b.classList.add('correct');
              else if (b.getAttribute('data-opt') === selected) b.classList.add('wrong');
            });

            expl.style.display = 'block';

            // Check if all answered
            this.checkQuizCompletion(island);
          });
        });
      });
    }
  }

  checkQuizCompletion(island) {
    const target = document.getElementById('quiz-render-target');
    const items = target.querySelectorAll('.quiz-item');
    let answered = 0;
    let correctCount = 0;

    items.forEach(item => {
      const locked = item.querySelector('.quiz-opt-btn.locked');
      if (locked) {
        answered++;
        const correct = item.querySelector('.quiz-opt-btn.correct');
        const wrong = item.querySelector('.quiz-opt-btn.wrong');
        if (!wrong && correct) correctCount++;
      }
    });

    if (answered === items.length) {
      const score = Math.round((correctCount / items.length) * 100);
      this.storage.quizScores[island.id] = score;
      this.saveStorage();

      document.getElementById('tab-quiz-status').textContent = `${score} 分`;
      document.getElementById('quiz-score-badge').textContent = `測驗成果：${score} / 100 分`;
      document.getElementById('btn-retry-quiz').style.display = 'inline-flex';
    }
  }

  renderCenterHospital() {
    const target = document.getElementById('center-quiz-render-target');
    const quizList = this.content.centerIsland.reviewQuiz || [];
    const scoreBadge = document.getElementById('center-quiz-score-badge');

    if (this.storage.centerQuizScore >= 0) {
      scoreBadge.textContent = `上次評量：${this.storage.centerQuizScore} 分（合格 80 分）`;
    } else {
      scoreBadge.textContent = '';
    }

    let html = '';
    quizList.forEach((q, i) => {
      html += `
        <div class="quiz-item center-review-item" data-qid="${q.id}">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span class="quiz-q-num">複習 ${i + 1} / 10</span>
            <span style="font-size:0.75rem; color:var(--muted);">${q.source}</span>
          </div>
          <div class="quiz-question">${q.question}</div>
          <div class="quiz-options">
            ${q.options.map(opt => `
              <button class="quiz-opt-btn center-opt-btn" data-qid="${q.id}" data-opt="${opt.id}">
                <b>[${opt.id}]</b> ${opt.text}
              </button>
            `).join('')}
          </div>
          <div class="quiz-explanation" id="center-expl-${q.id}">
            <b>💡 解析：</b>${q.explanation}
          </div>
        </div>
      `;
    });

    target.innerHTML = html;

    // Attach select toggle
    target.querySelectorAll('.center-review-item').forEach(item => {
      const btns = item.querySelectorAll('.center-opt-btn');
      btns.forEach(btn => {
        btn.addEventListener('click', () => {
          btns.forEach(b => b.classList.remove('selected', 'active'));
          btn.classList.add('selected', 'active');
        });
      });
    });
  }

  submitCenterQuiz() {
    const target = document.getElementById('center-quiz-render-target');
    const items = target.querySelectorAll('.center-review-item');
    const quizList = this.content.centerIsland.reviewQuiz || [];
    let correct = 0;
    let answered = 0;

    items.forEach((item, idx) => {
      const q = quizList[idx];
      const selectedBtn = item.querySelector('.center-opt-btn.selected');
      const expl = item.querySelector('.quiz-explanation');

      if (selectedBtn) {
        answered++;
        const chosen = selectedBtn.getAttribute('data-opt');
        if (chosen === q.answer) {
          correct++;
          selectedBtn.classList.add('correct');
        } else {
          selectedBtn.classList.add('wrong');
          // Highlight correct one
          item.querySelectorAll('.center-opt-btn').forEach(b => {
            if (b.getAttribute('data-opt') === q.answer) b.classList.add('correct');
          });
        }
      }
      expl.style.display = 'block';
    });

    const finalScore = Math.round((correct / quizList.length) * 100);
    this.storage.centerQuizScore = finalScore;
    this.saveStorage();

    const scoreBadge = document.getElementById('center-quiz-score-badge');
    scoreBadge.textContent = `評量得分：${finalScore} 分！ ${finalScore >= 80 ? '🎉 恭喜及格，可領取結業證書！' : '💪 加油，可再多複習各島內容喔！'}`;
  }

  markdownToHtml(md) {
    if (!md) return '';
    let html = md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/^- \[ \] (.*$)/gim, '<li>☐ $1</li>')
      .replace(/^- \[x\] (.*$)/gim, '<li>☑ $1</li>')
      .replace(/^- (.*$)/gim, '<li>$1</li>');

    // Simple table parser
    if (html.includes('|')) {
      const lines = html.split('\n');
      let inTable = false;
      let tableHtml = '';
      const newLines = [];

      for (let line of lines) {
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
          if (!inTable) {
            inTable = true;
            tableHtml = '<table>';
          }
          if (line.includes('---')) continue; // separator row

          const cells = line.split('|').slice(1, -1).map(c => c.trim());
          tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
        } else {
          if (inTable) {
            tableHtml += '</table>';
            newLines.push(tableHtml);
            inTable = false;
          }
          newLines.push(line);
        }
      }
      if (inTable) {
        tableHtml += '</table>';
        newLines.push(tableHtml);
      }
      html = newLines.join('\n');
    }

    return html.replace(/\n\n/g, '<p></p>');
  }
}
