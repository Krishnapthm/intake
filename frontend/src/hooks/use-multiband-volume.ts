import { useEffect, useMemo, useRef, useState } from 'react';

type MultibandVolumeOptions = {
  bands?: number;
  loPass?: number;
  hiPass?: number;
};

export function useMultibandVolume(
  mediaStream: MediaStream | null | undefined,
  { bands = 5, loPass = 100, hiPass = 200 }: MultibandVolumeOptions = {},
) {
  const silentVolumes = useMemo(() => new Array<number>(bands).fill(0), [bands]);
  const [volumes, setVolumes] = useState(silentVolumes);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mediaStream) {
      return;
    }

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    const source = ctx.createMediaStreamSource(mediaStream);
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const binHz = ctx.sampleRate / analyser.fftSize;
    const loBin = Math.max(0, Math.round(loPass / binHz));
    const hiBin = Math.min(analyser.frequencyBinCount - 1, Math.round(hiPass / binHz));
    const bandSize = Math.ceil(Math.max(1, hiBin - loBin) / bands);

    const update = () => {
      analyser.getByteFrequencyData(data);
      const vols = Array.from({ length: bands }, (_, b) => {
        let sum = 0, count = 0;
        const start = loBin + b * bandSize;
        const end = Math.min(hiBin + 1, start + bandSize);
        for (let i = start; i < end; i++) { sum += data[i]; count++; }
        return count > 0 ? sum / count / 255 : 0;
      });
      setVolumes(vols);
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      source.disconnect();
      ctx.close();
    };
  }, [mediaStream, bands, loPass, hiPass]);

  return mediaStream ? volumes : silentVolumes;
}
