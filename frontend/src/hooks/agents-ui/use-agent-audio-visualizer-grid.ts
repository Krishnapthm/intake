import { useEffect, useMemo, useState } from 'react';
import type { VisualizerState } from '@/types/intake';

type GridCoordinate = {
  x: number;
  y: number;
};

export function generateConnectingSequence(rows: number, columns: number, radius: number) {
  const seq: GridCoordinate[] = [];
  const centerY = Math.floor(rows / 2);

  // Calculate the boundaries of the ring based on the ring distance
  const topLeft = {
    x: Math.max(0, centerY - radius),
    y: Math.max(0, centerY - radius),
  };
  const bottomRight = {
    x: columns - 1 - topLeft.x,
    y: Math.min(rows - 1, centerY + radius),
  };

  // Top edge
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    seq.push({ x, y: topLeft.y });
  }

  // Right edge
  for (let y = topLeft.y + 1; y <= bottomRight.y; y++) {
    seq.push({ x: bottomRight.x, y });
  }

  // Bottom edge
  for (let x = bottomRight.x - 1; x >= topLeft.x; x--) {
    seq.push({ x, y: bottomRight.y });
  }

  // Left edge
  for (let y = bottomRight.y - 1; y > topLeft.y; y--) {
    seq.push({ x: topLeft.x, y });
  }

  return seq;
}

export function generateListeningSequence(rows: number, columns: number) {
  const center = { x: Math.floor(columns / 2), y: Math.floor(rows / 2) };
  const seq: GridCoordinate[] = [];
  const maxRadius = Math.floor(Math.max(rows, columns) / 2);

  // Expand outward: highlight all dots at each Chebyshev distance from center
  for (let r = 0; r <= maxRadius; r++) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const dist = Math.max(Math.abs(x - center.x), Math.abs(y - center.y));
        if (dist === r) seq.push({ x, y });
      }
    }
  }

  // Contract back to center
  for (let r = maxRadius; r >= 0; r--) {
    for (let y = rows - 1; y >= 0; y--) {
      for (let x = columns - 1; x >= 0; x--) {
        const dist = Math.max(Math.abs(x - center.x), Math.abs(y - center.y));
        if (dist === r) seq.push({ x, y });
      }
    }
  }

  return seq;
}

export function generateThinkingSequence(rows: number, columns: number) {
  const seq: GridCoordinate[] = [];

  // Scan left-to-right across each row top-to-bottom
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      seq.push({ x, y });
    }
  }

  // Reverse: scan right-to-left across each row bottom-to-top
  for (let y = rows - 1; y >= 0; y--) {
    for (let x = columns - 1; x >= 0; x--) {
      seq.push({ x, y });
    }
  }

  return seq;
}

export function useAgentAudioVisualizerGridAnimator(
  state: VisualizerState,
  rows: number,
  columns: number,
  interval: number,
  radius?: number,
) {
  const [index, setIndex] = useState(0);
  const sequence = useMemo(() => {
    const clampedRadius = radius
      ? Math.min(radius, Math.floor(Math.max(rows, columns) / 2))
      : Math.floor(Math.max(rows, columns) / 2);

    if (state === 'thinking') {
      return generateThinkingSequence(rows, columns);
    }

    if (state === 'connecting' || state === 'initializing') {
      return generateConnectingSequence(rows, columns, clampedRadius);
    }

    if (state === 'listening') {
      return generateListeningSequence(rows, columns);
    }

    return [{ x: Math.floor(columns / 2), y: Math.floor(rows / 2) }];
  }, [state, rows, columns, radius]);

  useEffect(() => {
    if (state === 'speaking') {
      return;
    }

    const indexInterval = setInterval(() => {
      setIndex((prev) => {
        return prev + 1;
      });
    }, interval);

    return () => clearInterval(indexInterval);
  }, [interval, columns, rows, state, sequence.length]);

  return (sequence[index % sequence.length] ?? { x: Math.floor(columns / 2), y: Math.floor(rows / 2) });
}
