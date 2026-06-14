# StarDuel Ultimate

A high-performance, polished 2D space arcade shooter built for modern browsers in a retro-anime vector style. Experience smooth kinetics, dynamic cameras, and synthesized soundscapes.

## Features

- **Smooth Vector Physics**: Kinetic flight models with inertia, drag, retro-thruster braking, and screen wrapping.
- **Anime Aesthetic**: Dynamic cameras featuring zoom tracking, screenshake on impact, speedline thruster trails, and expanding concentric shockwave explosions.
- **Procedural Sound Synthesizer**: Utilizes the browser's native **Web Audio API** to generate retro-futuristic sound effects (lasers, rumbling engines, shield deflectors) on the fly, eliminating heavy external audio asset loads.
- **Compound Hull Collision Detection**: Supports complex, multi-segmented circular hitboxes for asymmetrical ship structures.
- **Upgrade Shop**: Spend scrap cores gathered from waves in Asteroids mode to upgrade weapon damage, shields, engines, and special cooldown speeds.

---

## Game Modes

1. **Asteroids Survival (Solo)**: Fight off waves of splitting, jagged asteroids. Gather glowing gold scrap cores and dock in the spaceport bay between waves to buy permanent ship upgrades.
2. **Versus AI Battle**: Duel a cybernetic AI opponent that dynamically adjusts its acceleration, steering angles, primary lasers, and special abilities based on your positioning.
3. **Local 1v1 Duel**: Grab a friend and fight on the same keyboard. Features a cinematic **Star Control 2** style tracking camera that pans and scales dynamically to keep both fighters in focus.

---

## Ship Classes

| Ship Class | Color | Primary Weapon | Special Ability | Bounding Hulls |
| :--- | :--- | :--- | :--- | :--- |
| **Interceptor** | Cyan | Rapid Laser Blaster | **Warp Dash**: Short range teleport forwards + short invulnerability frame | 1 Center Circle |
| **Dreadnought** | Red | Heavy Dual Lasers | **Homing Missile**: Launches tracking projectile towards closest target | 3 Linear Circles |
| **Bomber** | Gold | Plasma Cannon | **Proximity Mine**: Deploys drift explosives behind tail | 2 Wing Circles |
| **Destroyer** | Magenta | Buster Railgun | **Overload Turbo**: Accelerates speed and doubles primary fire rate | 3 Linear Circles |

---

## Control Mappings

| Action | Player 1 (Left Side) | Player 2 (Right Side) |
| :--- | :--- | :--- |
| **Thrust** | `W` | `▲` (Arrow Up) |
| **Retro-Brake** | `S` | `▼` (Arrow Down) |
| **Rotate Left** | `A` | `◄` (Arrow Left) |
| **Rotate Right** | `D` | `►` (Arrow Right) |
| **Fire Laser** | `Spacebar` | `Enter` |
| **Activate Special** | `Shift` (Left/Right) | `Control` (Left/Right) |

---

## Development & Boot Setup

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Setup Commands
1. Clone the repository and install developer dependencies:
   ```bash
   npm install
   ```

2. Start the local hot-reloaded development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

3. Compile type checks and build the production bundle:
   ```bash
   npm run build
   ```
   The static distribution files will be compiled into the `dist/` directory.
