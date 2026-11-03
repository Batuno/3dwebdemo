// Named camera positions, in site metres. The Unreal export reads the same list.
export interface CameraPreset {
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export const cameras = {
  /** Landing shot: low across the open garden, looking slightly up at both towers. */
  opening: { pos: [150, 8, 120], target: [-2, 40, 0], fov: 36 },
  /** Elevated 3/4 view that zooming out from the opening shot arrives at. */
  overview: { pos: [176, 176, 268], target: [0, 22, 0], fov: 38 },
} satisfies Record<string, CameraPreset>;
