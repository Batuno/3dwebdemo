// Written by the camera rig every frame and read by the DOM minimap, so looking around never re-renders React.
export const povState = {
  /** View direction on the plan: x right, z down. */
  heading: [0, -1] as [number, number],
};
