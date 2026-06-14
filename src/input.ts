export class InputHandler {
  private activeKeys: Set<string> = new Set();
  private isCapturing = false;

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  // Prevent default scroll behavior for game keys
  private handleKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    this.activeKeys.add(code);

    if (this.isCapturing && [
      'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Enter', 'Slash'
    ].includes(code)) {
      e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.activeKeys.delete(e.code);
  };

  public startCapturing() {
    this.isCapturing = true;
    this.activeKeys.clear();
  }

  public stopCapturing() {
    this.isCapturing = false;
    this.activeKeys.clear();
  }

  public isPressed(code: string): boolean {
    return this.activeKeys.has(code);
  }

  // Helper mappings for quick check
  public getP1Controls() {
    return {
      thrust: this.isPressed('KeyW'),
      retro: this.isPressed('KeyS'),
      rotateLeft: this.isPressed('KeyA'),
      rotateRight: this.isPressed('KeyD'),
      shoot: this.isPressed('Space'),
      special: this.isPressed('ShiftLeft'),
    };
  }

  public getP2Controls() {
    return {
      thrust: this.isPressed('ArrowUp'),
      retro: this.isPressed('ArrowDown'),
      rotateLeft: this.isPressed('ArrowLeft'),
      rotateRight: this.isPressed('ArrowRight'),
      shoot: this.isPressed('Enter'),
      special: this.isPressed('Slash'),
    };
  }

  public destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
