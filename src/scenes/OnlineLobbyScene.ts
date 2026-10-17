import { CHARACTERS } from '@/characters';
import type { Game } from '@/core/Game';
import type { Scene } from '@/core/Scene';
import { NetClient } from '@/net/NetClient';
import { defaultWsUrl, type ServerMsg } from '@/net/protocol';
import { drawCharacter } from '@/ui/drawCharacter';
import { pointIn } from '@/ui/hit';
import { drawText } from '@/ui/text';
import { ModeSelectScene } from './ModeSelectScene';
import { PlayScene } from './PlayScene';

type Phase = 'connect' | 'menu' | 'joinCode' | 'lobby' | 'error';

export class OnlineLobbyScene implements Scene {
  private phase: Phase = 'connect';
  private net = new NetClient();
  private status = 'Connecting…';
  private code = '';
  private joinBuffer = '';
  private playerId = '';
  private hostId = '';
  private seed = 0;
  private players: { id: string; name: string; character: number }[] = [];
  private selected = 0;
  private menuIndex = 0;
  private name = `Player${Math.floor(Math.random() * 90 + 10)}`;
  private started = false;

  constructor(private game: Game) {
    void this.begin();
  }

  private async begin() {
    try {
      await this.net.connect(defaultWsUrl());
      this.net.onMessage = (msg) => this.onMsg(msg);
      this.net.onClose = () => {
        this.phase = 'error';
        this.status = 'Disconnected from server';
      };
      this.phase = 'menu';
      this.status = '';
    } catch (e) {
      this.phase = 'error';
      this.status = e instanceof Error ? e.message : 'Connection failed';
    }
  }

  private onMsg(msg: ServerMsg) {
    if (msg.type === 'error') {
      this.status = msg.message;
      if (this.phase === 'joinCode') return;
      this.phase = this.phase === 'lobby' ? 'lobby' : 'error';
      return;
    }
    if (msg.type === 'created') {
      this.code = msg.code;
      this.playerId = msg.playerId;
      this.hostId = msg.playerId;
      this.phase = 'lobby';
      return;
    }
    if (msg.type === 'joined') {
      this.code = msg.code;
      this.playerId = msg.playerId;
      this.hostId = msg.hostId;
      this.phase = 'lobby';
      return;
    }
    if (msg.type === 'lobby') {
      this.code = msg.code;
      this.hostId = msg.hostId;
      this.players = msg.players;
      this.started = msg.started;
      this.phase = 'lobby';
      return;
    }
    if (msg.type === 'hello') {
      this.code = msg.code;
      this.playerId = msg.playerId;
      this.seed = msg.seed;
      this.hostId = msg.hostId;
      this.phase = 'lobby';
      this.started = true;
      this.enterGame();
      return;
    }
    if (msg.type === 'state' && !this.started) {
      // ignore until in game
    }
  }

  private enterGame() {
    const me = this.players.find((p) => p.id === this.playerId);
    const character = me?.character ?? this.selected;
    this.game.scenes.switch(
      new PlayScene(this.game, {
        characters: [character],
        splitScreen: false,
        seed: this.seed,
        net: this.net,
        localNetId: this.playerId,
      }),
    );
  }

  private cycleCharacter(dir: number) {
    const n = CHARACTERS.length;
    this.selected = (this.selected + dir + n) % n;
  }

  private hostOrJoin() {
    if (this.menuIndex === 0) {
      this.net.send({ type: 'create', name: this.name, character: this.selected });
    } else {
      this.beginJoin();
    }
  }

  private beginJoin() {
    if (this.game.input.touchPreferred) {
      const code = window.prompt('Enter room code', this.joinBuffer || '');
      if (code && code.trim().length >= 4) {
        this.net.send({
          type: 'join',
          code: code.trim().toUpperCase(),
          name: this.name,
          character: this.selected,
        });
      }
      return;
    }
    this.phase = 'joinCode';
    this.joinBuffer = '';
    this.status = 'Type room code, Enter to join';
  }

  update() {
    const input = this.game.input;
    const { width: w } = this.game;
    if (input.wasPressed('Escape')) {
      this.net.close();
      this.game.scenes.switch(new ModeSelectScene(this.game));
      return;
    }

    if (this.phase === 'error') {
      if (input.consumeTap() || input.wasPressed('Enter', 'Space')) {
        this.net.close();
        this.game.scenes.switch(new ModeSelectScene(this.game));
      }
      return;
    }

    if (this.phase === 'menu') {
      const tap = input.peekTap();
      if (tap) {
        // Character strip: tap left/right of portrait to cycle
        if (pointIn(tap, w / 2 - 160, 100, 100, 120)) {
          input.consumeTap();
          this.cycleCharacter(-1);
          return;
        }
        if (pointIn(tap, w / 2 + 60, 100, 100, 120)) {
          input.consumeTap();
          this.cycleCharacter(1);
          return;
        }
        if (pointIn(tap, w / 2 - 40, 100, 80, 120)) {
          input.consumeTap();
          this.cycleCharacter(1);
          return;
        }
        // Host / Join buttons
        for (let i = 0; i < 2; i++) {
          const x = w / 2 - 140 + i * 160;
          if (pointIn(tap, x, 250, 140, 56)) {
            input.consumeTap();
            this.menuIndex = i;
            this.hostOrJoin();
            return;
          }
        }
      }
      if (input.wasPressed('ArrowLeft', 'KeyA')) this.menuIndex = (this.menuIndex + 1) % 2;
      if (input.wasPressed('ArrowRight', 'KeyD')) this.menuIndex = (this.menuIndex + 1) % 2;
      if (input.wasPressed('ArrowUp', 'KeyW')) this.cycleCharacter(-1);
      if (input.wasPressed('ArrowDown', 'KeyS')) this.cycleCharacter(1);
      for (let i = 0; i < CHARACTERS.length; i++) {
        if (input.wasPressed(`Digit${i + 1}`)) this.selected = i;
      }
      if (input.wasPressed('Enter', 'Space')) this.hostOrJoin();
      return;
    }

    if (this.phase === 'joinCode') {
      this.typeCode();
      if (input.wasPressed('Enter') && this.joinBuffer.length >= 4) {
        this.net.send({
          type: 'join',
          code: this.joinBuffer.toUpperCase(),
          name: this.name,
          character: this.selected,
        });
      }
      if (input.wasPressed('Backspace')) this.joinBuffer = this.joinBuffer.slice(0, -1);
      return;
    }

    if (this.phase === 'lobby') {
      const canStart = this.playerId === this.hostId && !this.started;
      if (canStart && (input.wasPressed('Enter', 'Space') || input.consumeTap())) {
        this.net.send({ type: 'start' });
      }
    }
  }

  private typeCode() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (const ch of letters) {
      const code = ch >= '0' && ch <= '9' ? `Digit${ch}` : `Key${ch}`;
      if (this.game.input.wasPressed(code) && this.joinBuffer.length < 6) {
        this.joinBuffer += ch;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const { width: w, height: h } = this.game;
    drawText(ctx, 'Online Co-op', w / 2, 48, 36, 'center');

    if (this.phase === 'connect') {
      drawText(ctx, this.status || 'Connecting…', w / 2, h / 2, 20, 'center');
      return;
    }

    const touch = this.game.input.touchPreferred;

    if (this.phase === 'error') {
      drawText(ctx, this.status, w / 2, h / 2 - 20, 18, 'center');
      drawText(
        ctx,
        touch ? 'Tap to go back  ·  Run: npm run server' : 'Esc — back  ·  Run: npm run server',
        w / 2,
        h / 2 + 24,
        14,
        'center',
      );
      return;
    }

    if (this.phase === 'menu' || this.phase === 'joinCode') {
      drawText(
        ctx,
        touch
          ? `Character: ${CHARACTERS[this.selected].name} (tap ◀ ▶)`
          : `Character: ${CHARACTERS[this.selected].name} (↑↓ or 1-3)`,
        w / 2,
        100,
        16,
        'center',
      );
      drawCharacter(ctx, CHARACTERS[this.selected], w / 2, 170, 70);
      if (touch) {
        drawText(ctx, '◀', w / 2 - 90, 170, 28, 'center');
        drawText(ctx, '▶', w / 2 + 90, 170, 28, 'center');
      }

      if (this.phase === 'menu') {
        const labels = ['Host room', 'Join room'];
        labels.forEach((label, i) => {
          const x = w / 2 - 140 + i * 160;
          const active = i === this.menuIndex;
          ctx.strokeStyle = active ? '#ffd54f' : 'rgba(255,255,255,0.2)';
          ctx.lineWidth = active ? 2 : 1;
          ctx.fillStyle = active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)';
          ctx.beginPath();
          ctx.roundRect(x, 250, 140, 56, 10);
          ctx.fill();
          ctx.stroke();
          drawText(ctx, label, x + 70, 282, 16, 'center');
        });
        drawText(
          ctx,
          touch ? 'Tap Host or Join  ·  Esc back' : '← → select  ·  Enter confirm  ·  Esc back',
          w / 2,
          h - 40,
          14,
          'center',
        );
      } else {
        drawText(ctx, `Code: ${this.joinBuffer || '____'}`, w / 2, 280, 28, 'center');
        drawText(ctx, this.status || 'Type code · Enter to join', w / 2, 330, 14, 'center');
      }
      return;
    }

    // lobby
    drawText(ctx, `Room ${this.code}`, w / 2, 100, 28, 'center');
    drawText(ctx, this.playerId === this.hostId ? 'You are the host' : 'Waiting for host…', w / 2, 136, 14, 'center');
    this.players.forEach((p, i) => {
      const y = 180 + i * 48;
      drawCharacter(ctx, CHARACTERS[p.character] ?? CHARACTERS[0], w / 2 - 120, y, 36);
      drawText(ctx, `${p.name}${p.id === this.hostId ? ' (host)' : ''}`, w / 2 - 80, y + 6, 16);
    });
    if (this.playerId === this.hostId) {
      drawText(ctx, touch ? 'Tap to start game' : 'Enter — Start game', w / 2, h - 48, 16, 'center');
    } else {
      drawText(ctx, 'Waiting for host to start…', w / 2, h - 48, 16, 'center');
    }
  }

  exit() {
    // Keep socket open when entering PlayScene; close only on Esc from lobby/menu.
  }
}
