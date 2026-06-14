import { GameMode, ShipClass } from './types';
import { InputHandler } from './input';
import { SoundSynthesizer } from './sound';
import { GameEngine } from './engine';
import { SHIP_CONFIGS } from './ships';

// Setup global controllers
const input = new InputHandler();
const sound = new SoundSynthesizer();

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const engine = new GameEngine(canvas, input, sound, handleEngineStateChange);

// DOM Screens
const screens: Record<GameMode, HTMLElement | null> = {
  menu: document.getElementById('menu-screen'),
  settings: document.getElementById('settings-screen'),
  select: document.getElementById('ship-select-screen'),
  asteroids: null, // canvas only
  duel: null,
  'vs-ai': null,
  shop: document.getElementById('shop-screen'),
  'game-over': document.getElementById('game-over-screen'),
};

// HUD Elements
const survivalHUD = document.getElementById('survival-hud') as HTMLElement;
const duelHUD = document.getElementById('duel-hud') as HTMLElement;
const warningNotice = document.getElementById('warning-notice') as HTMLElement;

// Main state tracking
let selectedMode: 'asteroids' | 'duel' | 'vs-ai' = 'asteroids';
let p1SelectedClass: ShipClass | null = null;
let p2SelectedClass: ShipClass | null = null;

// ==================== SCREEN SWITCHING CONTROLLER ====================
function showScreen(mode: GameMode) {
  // Hide all screens
  Object.keys(screens).forEach((key) => {
    const screen = screens[key as GameMode];
    if (screen) screen.classList.add('hidden');
  });
  
  // Hide HUDs by default
  survivalHUD.classList.add('hidden');
  duelHUD.classList.add('hidden');
  warningNotice.classList.add('hidden');

  // Show selected screen
  const targetScreen = screens[mode];
  if (targetScreen) {
    targetScreen.classList.remove('hidden');
    targetScreen.classList.add('active');
  }

  // Handle gameplay HUD triggers
  if (mode === 'asteroids') {
    survivalHUD.classList.remove('hidden');
  } else if (mode === 'duel' || mode === 'vs-ai') {
    duelHUD.classList.remove('hidden');
  }

  // Handle special screen setup
  if (mode === 'select') {
    setupShipSelectUI();
  } else if (mode === 'shop') {
    setupShopUI();
  } else if (mode === 'game-over') {
    setupGameOverUI();
  }
}

// Callback sent to the GameEngine to change screen triggers
function handleEngineStateChange(newMode: GameMode) {
  if (newMode === 'shop') {
    showScreen('shop');
  } else if (newMode === 'game-over') {
    showScreen('game-over');
  }
}

// ==================== SHIP SELECTION PANEL BUILDER ====================
function setupShipSelectUI() {
  const p2Column = document.getElementById('p2-select') as HTMLElement;
  const p2Title = document.getElementById('p2-select-title') as HTMLElement;
  const btnStart = document.getElementById('btn-start-game') as HTMLElement;

  btnStart.classList.add('hidden');
  p1SelectedClass = null;
  p2SelectedClass = null;

  // 1. Set titles/columns based on mode
  if (selectedMode === 'asteroids') {
    p2Column.style.display = 'none'; // Only 1 player needed for survival
  } else {
    p2Column.style.display = 'flex';
    p2Title.textContent = selectedMode === 'vs-ai' ? 'CYBER AI OPPONENT' : 'PLAYER 2';
  }

  // 2. Populate columns
  populateShipList('p1-ship-list', 'p1', (shipClass) => {
    p1SelectedClass = shipClass;
    sound.playCollect();
    checkLaunchValidity();
  });

  populateShipList('p2-ship-list', 'p2', (shipClass) => {
    p2SelectedClass = shipClass;
    sound.playCollect();
    checkLaunchValidity();
  });
}

function populateShipList(containerId: string, side: 'p1' | 'p2', onSelect: (shipClass: ShipClass) => void) {
  const container = document.getElementById(containerId) as HTMLElement;
  container.innerHTML = '';

  Object.entries(SHIP_CONFIGS).forEach(([key, config]) => {
    const shipClass = key as ShipClass;
    const card = document.createElement('div');
    card.className = `ship-card ${side === 'p2' ? 'p2-side-card' : ''}`;
    card.dataset.class = shipClass;

    // Calculate stat bars out of 10 for visuals
    const shieldPercent = Math.min(100, (config.maxShield / 220) * 100);
    const speedPercent = Math.min(100, (config.acceleration / 600) * 100);
    const delayPercent = Math.min(100, (0.12 / config.fireDelay) * 100); // Inverse (shorter fire delay = higher fire rate)

    card.innerHTML = `
      <div class="ship-card-header">
        <span class="ship-name" style="color: ${config.color}">${config.name}</span>
      </div>
      <div class="ship-desc">${config.desc}</div>
      <div class="ship-stats-list">
        <div class="stat-row">
          <span class="stat-label">DEFENSE:</span>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${shieldPercent}%; background-color: ${config.color}"></div></div>
        </div>
        <div class="stat-row">
          <span class="stat-label">SPEED:</span>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${speedPercent}%; background-color: ${config.color}"></div></div>
        </div>
        <div class="stat-row">
          <span class="stat-label">FIRE RATE:</span>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width: ${delayPercent}%; background-color: ${config.color}"></div></div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      // Toggle selection styling within same side
      const parent = card.parentElement!;
      parent.querySelectorAll('.ship-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      onSelect(shipClass);
    });

    container.appendChild(card);
  });
}

function checkLaunchValidity() {
  const btnStart = document.getElementById('btn-start-game') as HTMLElement;
  if (selectedMode === 'asteroids' && p1SelectedClass) {
    btnStart.classList.remove('hidden');
  } else if (selectedMode !== 'asteroids' && p1SelectedClass && p2SelectedClass) {
    btnStart.classList.remove('hidden');
  } else {
    btnStart.classList.add('hidden');
  }
}

// ==================== DOCKING UPGRADE SHOP SYSTEM ====================
function setupShopUI() {
  const scrapCounter = document.getElementById('shop-scrap') as HTMLElement;
  scrapCounter.textContent = `$${engine.scrap}`;

  // Update shop card buttons with current dynamic upgrade costs
  const cards = document.querySelectorAll('.shop-card');
  cards.forEach((card) => {
    const upgradeType = card.getAttribute('data-upgrade') as 'weapon' | 'shield' | 'engine' | 'special';
    const cost = engine.getUpgradeCost(upgradeType);
    const button = card.querySelector('.shop-buy-btn') as HTMLButtonElement;
    
    button.textContent = `UPGRADE - $${cost}`;
    button.dataset.cost = cost.toString();
    
    // Disable button if not enough scrap
    if (engine.scrap < cost) {
      button.classList.add('btn-secondary');
      button.classList.remove('btn-action');
      button.disabled = true;
    } else {
      button.classList.add('btn-action');
      button.classList.remove('btn-secondary');
      button.disabled = false;
    }
  });
}

// ==================== GAME OVER UI ====================
function setupGameOverUI() {
  const title = document.getElementById('game-over-title') as HTMLElement;
  const summary = document.getElementById('game-over-summary') as HTMLElement;

  if (selectedMode === 'asteroids') {
    title.textContent = 'MISSION FAILED';
    title.className = 'danger-title';
    summary.innerHTML = `SURVIVED WAVE: <span class="p1-color">${engine.wave}</span><br>FINAL SCORE: <span class="text-gold">${engine.score.toLocaleString()}</span>`;
  } else {
    // Duel Winner display
    const p1Wins = engine.player1?.wins || 0;
    const p2Wins = engine.player2?.wins || 0;
    
    if (p1Wins === p2Wins) {
      title.textContent = 'ROUND DRAW';
      title.className = 'text-gold';
    } else if (p1Wins > p2Wins) {
      title.textContent = 'PLAYER 1 VICTORIOUS';
      title.className = 'p1-color';
    } else {
      title.textContent = selectedMode === 'vs-ai' ? 'CYBER AI VICTORIOUS' : 'PLAYER 2 VICTORIOUS';
      title.className = 'p2-color';
    }

    summary.innerHTML = `P1 WINS: <span class="p1-color">${p1Wins}</span> | ${selectedMode === 'vs-ai' ? 'AI' : 'P2'} WINS: <span class="p2-color">${p2Wins}</span>`;
  }
}

// ==================== REALTIME HUD DATA SYNC ====================
function syncHUD() {
  if (!engine.player1) return;

  if (selectedMode === 'asteroids') {
    // Survival HUD updates
    const scoreVal = document.getElementById('survival-score') as HTMLElement;
    const waveVal = document.getElementById('survival-wave') as HTMLElement;
    const scrapVal = document.getElementById('survival-scrap') as HTMLElement;
    const livesVal = document.getElementById('survival-lives') as HTMLElement;
    const p1ShieldBar = document.getElementById('survival-shield-bar') as HTMLElement;
    const p1EnergyBar = document.getElementById('survival-energy-bar') as HTMLElement;

    scoreVal.textContent = engine.score.toString().padStart(6, '0');
    waveVal.textContent = engine.wave.toString();
    scrapVal.textContent = `$${engine.scrap}`;
    livesVal.textContent = '❤'.repeat(Math.max(0, engine.lives));

    // Bars
    const shieldPct = (engine.player1.shield / engine.player1.maxShield) * 100;
    const energyPct = (engine.player1.energy / engine.player1.maxEnergy) * 100;
    
    p1ShieldBar.style.width = `${shieldPct}%`;
    p1EnergyBar.style.width = `${energyPct}%`;

    // Low shield warning blinker
    if (shieldPct < 25 && engine.player1.active) {
      warningNotice.textContent = 'SHIELD CRITICAL';
      warningNotice.classList.remove('hidden');
    } else {
      warningNotice.classList.add('hidden');
    }
  } else if (engine.player2) {
    // Duel HUD updates
    const p1HUDName = document.getElementById('p1-hud-name') as HTMLElement;
    const p1HUDScore = document.getElementById('p1-hud-score') as HTMLElement;
    const p1ShieldBar = document.getElementById('p1-shield-bar') as HTMLElement;
    const p1EnergyBar = document.getElementById('p1-energy-bar') as HTMLElement;

    const p2HUDName = document.getElementById('p2-hud-name') as HTMLElement;
    const p2HUDScore = document.getElementById('p2-hud-score') as HTMLElement;
    const p2ShieldBar = document.getElementById('p2-shield-bar') as HTMLElement;
    const p2EnergyBar = document.getElementById('p2-energy-bar') as HTMLElement;

    p1HUDName.textContent = engine.player1.name;
    p1HUDScore.textContent = `WINS: ${engine.player1.wins}`;
    p1ShieldBar.style.width = `${(engine.player1.shield / engine.player1.maxShield) * 100}%`;
    p1EnergyBar.style.width = `${(engine.player1.energy / engine.player1.maxEnergy) * 100}%`;

    p2HUDName.textContent = engine.player2.name;
    p2HUDScore.textContent = `WINS: ${engine.player2.wins}`;
    p2ShieldBar.style.width = `${(engine.player2.shield / engine.player2.maxShield) * 100}%`;
    p2EnergyBar.style.width = `${(engine.player2.energy / engine.player2.maxEnergy) * 100}%`;
  }
}

// Continuous interval loop for HUD synchronization
setInterval(syncHUD, 50);

// ==================== EVENT LISTENERS & SETUP ====================

// Mode selection
document.getElementById('btn-asteroids')?.addEventListener('click', () => {
  selectedMode = 'asteroids';
  showScreen('select');
});
document.getElementById('btn-vs-ai')?.addEventListener('click', () => {
  selectedMode = 'vs-ai';
  showScreen('select');
});
document.getElementById('btn-duel')?.addEventListener('click', () => {
  selectedMode = 'duel';
  showScreen('select');
});

// Settings buttons
document.getElementById('btn-settings')?.addEventListener('click', () => {
  showScreen('settings');
});
document.getElementById('btn-settings-back')?.addEventListener('click', () => {
  showScreen('menu');
});

// Volume adjustments
document.getElementById('volume-sfx')?.addEventListener('input', (e) => {
  const val = parseInt((e.target as HTMLInputElement).value);
  sound.setSfxVolume(val);
});
document.getElementById('volume-music')?.addEventListener('input', (e) => {
  const val = parseInt((e.target as HTMLInputElement).value);
  sound.setMusicVolume(val);
});

// Navigation back
document.getElementById('btn-select-back')?.addEventListener('click', () => {
  showScreen('menu');
});

// Launch!
document.getElementById('btn-start-game')?.addEventListener('click', () => {
  if (p1SelectedClass) {
    showScreen(selectedMode); // Show the game overlay UI
    engine.start(selectedMode, p1SelectedClass, p2SelectedClass || undefined);
  }
});

// Shop / Docking bay triggers
document.querySelectorAll('.shop-card').forEach((card) => {
  const button = card.querySelector('.shop-buy-btn') as HTMLButtonElement;
  button.addEventListener('click', () => {
    const upgradeType = card.getAttribute('data-upgrade') as 'weapon' | 'shield' | 'engine' | 'special';
    if (engine.buyUpgrade(upgradeType)) {
      // Reload shop UI to reflect updated cash/costs
      setupShopUI();
    }
  });
});

document.getElementById('btn-next-wave')?.addEventListener('click', () => {
  showScreen('asteroids');
  engine.nextWave();
});

// Restart / Quit from game over
document.getElementById('btn-restart')?.addEventListener('click', () => {
  if (p1SelectedClass) {
    showScreen(selectedMode);
    engine.start(selectedMode, p1SelectedClass, p2SelectedClass || undefined);
  }
});

document.getElementById('btn-quit')?.addEventListener('click', () => {
  showScreen('menu');
});

// Initial load
showScreen('menu');
