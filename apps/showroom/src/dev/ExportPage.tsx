// Dev page #/dev/export: writes the GLB and JSON files the Unreal pipeline reads.
// scripts/export-unreal.mjs drives the same runExport function and saves straight to disk.
import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { interiors } from '@bair/project-data';
import { InteriorModel } from '../scene/unit/InteriorModel';
import { SceneRoot } from '../scene/SceneRoot';
import { blockPart, dataFiles, EXPORT_PARTS, interiorPart, sitePart, type Saver } from './exportGltf';

type Stage = { kind: 'site' } | { kind: 'interior'; type: string; cut: boolean } | null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Models stream in, so a scene is ready once its mesh count stops changing. */
async function settled(scene: () => THREE.Object3D | null) {
  let last = -1;
  let steady = 0;
  for (let i = 0; i < 120 && steady < 3; i++) {
    await wait(700);
    let n = 0;
    scene()?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) n++;
    });
    steady = n === last && n > 0 ? steady + 1 : 0;
    last = n;
  }
}

const download: Saver = async (name, data) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data]));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

export function ExportPage() {
  const [stage, setStage] = useState<Stage>(null);
  const [log, setLog] = useState<string[]>([]);
  const interior = useRef<{ scene: THREE.Scene; gl: THREE.WebGLRenderer } | null>(null);

  const run = async (part: string, save: Saver) => {
    if (part === 'data') {
      await dataFiles(save);
    } else if (part === 'site' || part.startsWith('block_')) {
      setStage({ kind: 'site' });
      await new Promise<void>((resolve) => {
        const id = setInterval(() => {
          if ((window as unknown as { __sceneReady?: boolean }).__sceneReady) {
            clearInterval(id);
            resolve();
          }
        }, 300);
      });
      await settled(() => (window as unknown as { __scene?: THREE.Scene }).__scene ?? null);
      if (part === 'site') await sitePart(save);
      else await blockPart(part.slice('block_'.length), save);
    } else {
      const cut = part.startsWith('topview_');
      const type = part.slice(part.indexOf('_') + 1);
      interior.current = null;
      setStage({ kind: 'interior', type, cut });
      await wait(300);
      await settled(() => interior.current?.scene ?? null);
      await interiorPart(type, cut, interior.current!.scene, interior.current!.gl, save);
    }
    setLog((l) => [...l, `${part} ok`]);
  };

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  useEffect(() => {
    Object.assign(window, { __runExport: (part: string, save: Saver) => runRef.current(part, save) });
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff' }}>
      {stage?.kind === 'site' && <SceneRoot />}
      {stage?.kind === 'interior' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Canvas
            key={`${stage.type}-${stage.cut}`}
            onCreated={({ scene, gl }) => {
              interior.current = { scene, gl };
            }}
          >
            <InteriorModel layout={interiors[stage.type]} cut={stage.cut ? 1.2 : null} hideAbove={stage.cut ? 1.2 : undefined} ceiling={!stage.cut} fittings={{ partition: true }} standalone />
          </Canvas>
        </div>
      )}
      <div style={{ position: 'absolute', top: 16, left: 16, padding: 16, background: '#fff', borderRadius: 12, font: '13px system-ui' }}>
        <strong>Unreal export</strong>
        <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          {EXPORT_PARTS.map((p) => (
            <button type="button" key={p} onClick={() => run(p, download)}>
              {p}
            </button>
          ))}
        </div>
        <pre data-testid="export-log">{log.join('\n')}</pre>
      </div>
    </div>
  );
}
