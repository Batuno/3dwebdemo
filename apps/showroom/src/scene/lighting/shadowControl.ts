// The sun doesn't move, so the shadow map only re-renders when geometry changes.
let dirty = true;
export const requestShadowUpdate = () => {
  dirty = true;
};
export const consumeShadowUpdate = (): boolean => {
  const d = dirty;
  dirty = false;
  return d;
};
