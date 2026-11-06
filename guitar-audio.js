// A damped, plucked string model. Each string starts a few milliseconds apart,
// so a downstroke travels from the bass strings to the treble strings.
export const openGuitar = [82.4069, 110, 146.8324, 195.9977, 246.9417, 329.6276];
export const practiceChords = {
  G: [3, 2, 0, 0, 0, 3],
  D: [-1, -1, 0, 2, 3, 2],
  Em: [0, 2, 2, 0, 0, 0],
  C: [-1, 3, 2, 0, 1, 0],
};
export function strumNotes(chord = 'G', upstroke = false) {
  const pitches = practiceChords[chord].flatMap((fret, string) =>
    fret < 0 ? [] : [{ string, frequency: openGuitar[string] * 2 ** (fret / 12) }]);
  return upstroke ? pitches.reverse() : pitches;
}
export function pluckedString(frequency, sampleRate, seconds = 1.7) {
  const period = Math.max(2, Math.round(sampleRate / frequency - 0.5));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  // Smooth the initial pick impulse for a warmer acoustic tone.
  for (let i = 0; i < period - 1; i++) ring[i] = (ring[i] + ring[i + 1]) * 0.5;
  const result = new Float32Array(Math.ceil(sampleRate * seconds));
  for (let i = 0; i < result.length; i++) {
    const p = i % period;
    const value = ring[p];
    ring[p] = 0.497 * (value + ring[(p + 1) % period]);
    const attack = Math.min(1, i / (sampleRate * 0.002));
    const release = Math.min(1, (result.length - i) / (sampleRate * 0.05));
    result[i] = value * attack * release;
  }
  return result;
}
export function createGuitar(ctx) {
  const active = new Set();
  const buffers = new Map();
  return {
    strum(time, chord, upstroke) {
      for (const [index, { frequency }] of strumNotes(chord, upstroke).entries()) {
        const key = frequency.toFixed(3);
        if (!buffers.has(key)) {
          const data = pluckedString(frequency, ctx.sampleRate);
          const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
          buffer.copyToChannel(data, 0);
          buffers.set(key, buffer);
        }
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buffers.get(key);
        gain.gain.value = (upstroke ? 0.32 : 0.42) * (0.92 + Math.random() * 0.08);
        source.connect(gain);
        gain.connect(ctx.destination);
        active.add(source);
        source.onended = () => { active.delete(source); source.disconnect(); gain.disconnect(); };
        source.start(time + index * (upstroke ? 0.009 : 0.014));
      }
    },
    stop() { for (const source of active) { try { source.stop(); } catch {} } active.clear(); },
  };
}
