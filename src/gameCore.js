export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const GROUND_Y = 440;

const PLAYER = {
  x: 142,
  y: GROUND_Y - 78,
  width: 54,
  height: 78,
  velocityY: 0,
};

const DIFFICULTY = {
  startSpeed: 350,
  maxSpeed: 720,
  acceleration: 8,
  gravity: 2200,
  jumpVelocity: -820,
  obstacleGapMin: 360,
  obstacleGapMax: 620,
  memoryGapMin: 240,
  memoryGapMax: 420,
};

function makeRandom(seed = 123456) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function between(random, min, max) {
  return min + random() * (max - min);
}

export function createInitialState(seed = Date.now()) {
  return {
    status: 'ready',
    elapsed: 0,
    score: 0,
    best: readBestScore(),
    memories: 0,
    speed: DIFFICULTY.startSpeed,
    player: { ...PLAYER, onGround: true },
    obstacles: [],
    pickups: [],
    scenery: createScenery(makeRandom(seed)),
    nextObstacleIn: 520,
    nextPickupIn: 260,
    random: makeRandom(seed),
  };
}

function readBestScore() {
  try {
    return Number.parseInt(globalThis.localStorage?.getItem('memoryLaneBest') ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score) {
  try {
    globalThis.localStorage?.setItem('memoryLaneBest', String(score));
  } catch {
    // Local storage can be unavailable in private browsing or tests.
  }
}

function createScenery(random) {
  return Array.from({ length: 8 }, (_, index) => ({
    x: index * 160,
    width: between(random, 58, 112),
    height: between(random, 95, 185),
    lit: random() > 0.45,
  }));
}

export function startGame(state) {
  if (state.status === 'playing') return state;
  return { ...state, status: 'playing' };
}

export function togglePause(state) {
  if (state.status === 'playing') return { ...state, status: 'paused' };
  if (state.status === 'paused') return { ...state, status: 'playing' };
  return state;
}

export function jump(state) {
  if (state.status === 'ready') {
    return jump(startGame(state));
  }

  if (state.status !== 'playing' || !state.player.onGround) return state;

  return {
    ...state,
    player: {
      ...state.player,
      velocityY: DIFFICULTY.jumpVelocity,
      onGround: false,
    },
  };
}

export function updateGame(state, deltaSeconds) {
  if (state.status !== 'playing') return state;

  const delta = Math.min(deltaSeconds, 0.033);
  const speed = Math.min(DIFFICULTY.maxSpeed, state.speed + DIFFICULTY.acceleration * delta);
  const distance = speed * delta;

  const player = updatePlayer(state.player, delta);
  const obstacleUpdate = moveAndSpawnObstacles(state, distance);
  const pickupUpdate = moveAndSpawnPickups(state, distance, player);
  const obstacles = obstacleUpdate.items;
  const pickups = pickupUpdate.items;
  const scenery = state.scenery.map((building) => {
    const x = building.x - distance * 0.22;
    return x + building.width < 0
      ? { ...building, x: GAME_WIDTH + between(state.random, 20, 120), height: between(state.random, 95, 185), lit: state.random() > 0.45 }
      : { ...building, x };
  });

  const collectedPickups = pickups.filter((pickup) => pickup.collected);
  const activePickups = pickups.filter((pickup) => !pickup.collected && pickup.x + pickup.width > 0);
  const activeObstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > 0);
  const score = state.score + distance * 0.07 + collectedPickups.length * 75;
  const hit = activeObstacles.some((obstacle) => rectanglesOverlap(player, obstacle));
  const best = Math.max(state.best, score);

  if (hit) {
    saveBestScore(best);
  }

  return {
    ...state,
    status: hit ? 'gameover' : 'playing',
    elapsed: state.elapsed + delta,
    score,
    best,
    memories: state.memories + collectedPickups.length,
    speed,
    player,
    obstacles: activeObstacles,
    pickups: activePickups,
    scenery,
    nextObstacleIn: obstacleUpdate.nextIn,
    nextPickupIn: pickupUpdate.nextIn,
  };
}

function updatePlayer(player, delta) {
  const velocityY = player.velocityY + DIFFICULTY.gravity * delta;
  const y = Math.min(GROUND_Y - player.height, player.y + velocityY * delta);
  const onGround = y >= GROUND_Y - player.height;

  return {
    ...player,
    y,
    velocityY: onGround ? 0 : velocityY,
    onGround,
  };
}

function moveAndSpawnObstacles(state, distance) {
  const moved = state.obstacles.map((obstacle) => ({ ...obstacle, x: obstacle.x - distance }));

  if (state.nextObstacleIn > distance) {
    return { items: moved, nextIn: state.nextObstacleIn - distance };
  }

  const height = between(state.random, 38, 82);
  const width = between(state.random, 46, 82);
  moved.push({
    x: GAME_WIDTH + width,
    y: GROUND_Y - height,
    width,
    height,
    type: state.random() > 0.55 ? 'pothole' : 'traffic-cone',
  });

  return {
    items: moved,
    nextIn: between(state.random, DIFFICULTY.obstacleGapMin, DIFFICULTY.obstacleGapMax),
  };
}

function moveAndSpawnPickups(state, distance, player) {
  const moved = state.pickups.map((pickup) => ({ ...pickup, x: pickup.x - distance }));
  let nextIn = state.nextPickupIn - distance;

  if (state.nextPickupIn <= distance) {
    moved.push({
      x: GAME_WIDTH + 30,
      y: between(state.random, 220, 350),
      width: 34,
      height: 34,
      collected: false,
      hue: Math.floor(between(state.random, 35, 56)),
    });
    nextIn = between(state.random, DIFFICULTY.memoryGapMin, DIFFICULTY.memoryGapMax);
  }

  return {
    items: moved.map((pickup) => ({
      ...pickup,
      collected: pickup.collected || rectanglesOverlap(player, pickup),
    })),
    nextIn,
  };
}

export function rectanglesOverlap(a, b) {
  const inset = 8;
  return (
    a.x + inset < b.x + b.width &&
    a.x + a.width - inset > b.x &&
    a.y + inset < b.y + b.height &&
    a.y + a.height - inset > b.y
  );
}
