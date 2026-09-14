export function sameOrigin(request) {
  return request.headers.origin === `${request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${request.headers.host}`;
}

export function parseStoryboard(value) {
  if (!value || !Array.isArray(value.shots) || !value.shots.length || value.shots.length > 20) throw new Error('Storyboard has no valid shots');
  const ids = new Set();
  const shots = value.shots.map(shot => {
    const duration = Number(shot.duration ?? shot.durationSeconds ?? shot.seconds);
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(shot.id) || ids.has(shot.id) || !Number.isFinite(duration) || duration < 1 || duration > 120) throw new Error('Invalid storyboard shot');
    ids.add(shot.id);
    return { id: shot.id, duration };
  });
  return { shots, duration: shots.reduce((total, shot) => total + shot.duration, 0) };
}
