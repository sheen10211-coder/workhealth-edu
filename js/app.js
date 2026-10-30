import { IslandScene } from './scene.js';
import { LivingWorld } from './living-world.js';
import { CourseManager } from './course.js';
import { UIManager } from './ui.js';

class IslandApp {
  constructor() {
    this.labelsContainer = document.getElementById('island-labels-container');
    this.labels = [];
    this.init();
  }

  async init() {
    try {
      const resp = await fetch('data/content.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.content = await resp.json();
    } catch (e) {
      console.error('Failed to load content.json, using fallback', e);
      return;
    }

    // 1. Initialize 3D Scene
    this.scene = new IslandScene(
      'canvas-container',
      (islandId) => this.handleIslandSelect(islandId),
      (npcData, pos) => this.handleNPCClick(npcData, pos),
      (animalData, pos) => this.handleAnimalClick(animalData, pos),
      (shellData, pos) => this.handleShellClick(shellData, pos)
    );

    // 2. Initialize Living World (Day/Night, NPCs, Animals, Sky, Ships)
    this.living = new LivingWorld(this.scene, this.content);

    // 3. Initialize Course & Progress Manager
    this.course = new CourseManager(this.content, (stats) => {
      if (this.ui) this.ui.updateCounters();
      this.updateLabelsStatus();
    });

    // 4. Initialize UI Manager (Modals, Audio, Themes, Font Size)
    this.ui = new UIManager(this.content, this.course, this.scene, this.living);

    // 5. Build dynamic HTML 2D Island Labels
    this.buildIslandLabels();

    // 6. Start God-view Opening Cinema
    const hasSeenCinema = localStorage.getItem('wh_seen_cinema');
    if (!hasSeenCinema) {
      this.scene.startGodViewCinema(() => {
        localStorage.setItem('wh_seen_cinema', 'true');
      });
    } else {
      this.scene.skipCinema();
    }

    // Render loop for floating HTML labels tracking 3D positions
    this.startLabelTracking();
  }

  handleIslandSelect(islandId) {
    this.scene.flyToIsland(islandId, () => {
      this.course.openIsland(islandId);
    });
  }

  handleNPCClick(npcData, hitPoint) {
    const screenPos = this.toScreenPosition(hitPoint);
    this.ui.showDialogueBubble(npcData, screenPos);
  }

  handleAnimalClick(animalData, hitPoint) {
    const screenPos = this.toScreenPosition(hitPoint);
    this.ui.showDialogueBubble(animalData, screenPos);
  }

  handleShellClick(shellData, hitPoint) {
    if (shellData.isCollected) return;
    const bp = this.course.storage.backpack;
    bp['item-shell'] = (bp['item-shell'] || 0) + 1;
    this.course.saveStorage();
    this.ui.updateCounters();

    // Trigger shell respawn & sound
    const targetShell = this.living.shells.find(s => s.userData.islandId === shellData.islandId);
    if (targetShell) {
      this.living.respawnShell(targetShell);
    }

    const screenPos = this.toScreenPosition(hitPoint);
    this.ui.showDialogueBubble({
      name: '拾取發現',
      title: '海灘貝殼 +1',
      avatar: '🐚',
      dialogues: ['在黑沙灘上撿到了一顆漂亮的天然貝殼！已經放進背包囉！']
    }, screenPos);

    this.ui.playTone(660, 'sine', 0.2);
  }

  toScreenPosition(worldPos) {
    const vec = worldPos.clone();
    vec.project(this.scene.camera);
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      x: (vec.x * 0.5 + 0.5) * w,
      y: (-(vec.y * 0.5) + 0.5) * h
    };
  }

  buildIslandLabels() {
    this.labelsContainer.innerHTML = '';
    this.labels = [];

    const all = [this.content.centerIsland, ...this.content.islands];
    all.forEach((isld, idx) => {
      const isCenter = isld.id === 'island-00';
      const div = document.createElement('div');
      div.className = `island-label ${isCenter ? 'center-island-label' : ''}`;
      div.id = `label-${isld.id}`;

      div.innerHTML = `
        <span class="island-label-num">${isCenter ? '★' : String(idx)}</span>
        <span class="island-label-text">${isld.name}</span>
        <span class="island-label-badge" id="badge-${isld.id}">${isCenter ? '總複習・醫院' : (isld.group || '模組')}</span>
      `;

      div.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleIslandSelect(isld.id);
      });

      this.labelsContainer.appendChild(div);
      this.labels.push({ id: isld.id, element: div, isCenter });
    });

    this.updateLabelsStatus();
  }

  updateLabelsStatus() {
    const visited = this.course.storage.visited || [];
    this.labels.forEach(l => {
      const badge = document.getElementById(`badge-${l.id}`);
      if (badge && !l.isCenter) {
        if (visited.includes(l.id)) {
          badge.textContent = '🟢 已探索';
          badge.style.color = 'var(--primary)';
        }
      }
    });
  }

  startLabelTracking() {
    const update = () => {
      this.labels.forEach(l => {
        const pos = this.scene.getIslandScreenPosition(l.id);
        if (pos && pos.isVisible) {
          l.element.style.display = 'flex';
          l.element.style.left = `${pos.x}px`;
          l.element.style.top = `${pos.y}px`;
        } else {
          l.element.style.display = 'none';
        }
      });
      requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new IslandApp();
});
