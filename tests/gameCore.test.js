import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, jump, rectanglesOverlap, startGame, togglePause, updateGame } from '../src/gameCore.js';

test('jump starts the game and lifts the grounded player', () => {
  const state = createInitialState(42);
  const jumped = jump(state);

  assert.equal(jumped.status, 'playing');
  assert.equal(jumped.player.onGround, false);
  assert.ok(jumped.player.velocityY < 0);
});

test('pause toggles only while actively playing', () => {
  const playing = startGame(createInitialState(42));

  assert.equal(togglePause(playing).status, 'paused');
  assert.equal(togglePause(togglePause(playing)).status, 'playing');
  assert.equal(togglePause(createInitialState(42)).status, 'ready');
});

test('score increases as the run advances', () => {
  const playing = startGame(createInitialState(42));
  let advanced = playing;
  for (let frame = 0; frame < 30; frame += 1) {
    advanced = updateGame(advanced, 1 / 60);
  }

  assert.ok(advanced.score > playing.score);
  assert.ok(advanced.speed > playing.speed);
});

test('rectangle overlap helper detects collisions with forgiving insets', () => {
  assert.equal(rectanglesOverlap({ x: 10, y: 10, width: 40, height: 40 }, { x: 34, y: 34, width: 20, height: 20 }), true);
  assert.equal(rectanglesOverlap({ x: 10, y: 10, width: 40, height: 40 }, { x: 90, y: 90, width: 20, height: 20 }), false);
});
