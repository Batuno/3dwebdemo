// The Appendix A.0 palette as PBR materials. Names are stable so the Unreal import can swap them by name.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useInteriorSets, useMaterials } from '../materials';
import { applyRoomLights } from './interiorLights';

export const PALETTE = {
  warmWhite: '#F2EFE9',
  sand: '#E6DCCB',
  sage: '#8C9C86',
  oak: '#C9A27A',
  linen: '#CFC6B8',
  stone: '#BDB7AD',
  pureWhite: '#FAFAF7',
  charcoal: '#2B2D2B',
} as const;

export function useInteriorMaterials(roomLit = true) {
  const lib = useMaterials();
  const inside = useInteriorSets();
  const mats = useMemo(() => {
    const std = (name: string, params: THREE.MeshStandardMaterialParameters) =>
      new THREE.MeshStandardMaterial({ name, ...params });
    const set = {
      oak: std('M_Oak', { normalMap: lib.sets.wood.normalMap, roughnessMap: lib.sets.wood.roughnessMap, color: PALETTE.oak, roughness: 0.8, normalScale: new THREE.Vector2(0.25, 0.25) }),
      floorOak: std('M_OakFloor', { ...inside.woodfloor, color: '#e0c6a4', roughness: 0.68, envMapIntensity: 0.55, normalScale: new THREE.Vector2(0.2, 0.2) }),
      linen: std('M_Linen', { normalMap: inside.fabric.normalMap, color: PALETTE.linen, roughness: 1, normalScale: new THREE.Vector2(0.6, 0.6) }),
      sand: std('M_Sand', { normalMap: inside.carpet.normalMap, color: PALETTE.sand, roughness: 1, normalScale: new THREE.Vector2(0.7, 0.7) }),
      sage: std('M_Sage', { color: PALETTE.sage, roughness: 0.82 }),
      sageFabric: std('M_SageFabric', { normalMap: inside.fabric.normalMap, color: PALETTE.sage, roughness: 1 }),
      white: std('M_MatteWhite', { color: PALETTE.pureWhite, roughness: 0.55 }),
      wall: std('M_WarmWhite', { color: PALETTE.warmWhite, roughness: 0.86, normalMap: lib.sets.plaster.normalMap, normalScale: new THREE.Vector2(0.18, 0.18) }),
      accentWall: std('M_SageWall', { color: PALETTE.sage, roughness: 0.88, normalMap: lib.sets.plaster.normalMap, normalScale: new THREE.Vector2(0.18, 0.18) }),
      ceiling: std('M_Ceiling', { color: PALETTE.pureWhite, roughness: 0.92 }),
      quartz: std('M_Quartz', { color: '#ece9e3', roughness: 0.22 }),
      stoneTile: std('M_StoneTile', { ...inside.tile, color: PALETTE.stone, roughness: 0.42 }),
      sageTile: std('M_SageTile', { ...inside.tile, color: PALETTE.sage, roughness: 0.42 }),
      kitchenFloor: std('M_KitchenTile', { ...inside.tile, color: '#d9d5cc', roughness: 0.38 }),
      concrete: std('M_ConcreteFloor', { ...lib.sets.concrete, color: '#b5b2ab', roughness: 0.9 }),
      bare: std('M_BareWall', { color: '#d6d3cc', roughness: 0.9 }),
      wallCut: new THREE.MeshBasicMaterial({ name: 'M_PlanCut', color: '#050505' }),
      wallEdge: new THREE.MeshBasicMaterial({ name: 'M_PlanOutline', color: '#ffffff' }),
      black: std('M_BlackMetal', { color: PALETTE.charcoal, roughness: 0.45, metalness: 0.75 }),
      steel: std('M_Steel', { color: '#b9bcbd', roughness: 0.32, metalness: 0.95 }),
      grey: std('M_GreyMesh', { color: '#6f7274', roughness: 0.9 }),
      porcelain: std('M_Porcelain', { color: '#f6f5f1', roughness: 0.14 }),
      screen: std('M_Screen', { color: '#0e1012', roughness: 0.18, metalness: 0.2 }),
      mirror: std('M_Mirror', { color: '#dfe6e8', roughness: 0.04, metalness: 1 }),
      art: std('M_Art', { color: '#a9836a', roughness: 0.9 }),
      plant: std('M_Plant', { color: '#58704e', roughness: 0.85 }),
      skirting: std('M_Skirting', { color: PALETTE.pureWhite, roughness: 0.5 }),
      frame: std('M_WindowFrame', { color: '#3a3d3d', roughness: 0.5, metalness: 0.4 }),
      curtainSheer: new THREE.MeshStandardMaterial({ name: 'M_CurtainSheer', color: PALETTE.sand, roughness: 1, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }),
      curtainBlackout: std('M_CurtainBlackout', { color: PALETTE.sand, roughness: 1, normalMap: inside.fabric.normalMap, side: THREE.DoubleSide }),
      glass: new THREE.MeshPhysicalMaterial({ name: 'M_Glass', color: '#e2efee', roughness: 0.04, transparent: true, opacity: 0.2, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide }),
      light: std('M_LightOn', { color: '#fff4e0', emissive: '#ffd9a8', emissiveIntensity: 2.4 }),
    };
    // Glass stays out of the room fill, or the view outside turns to haze.
    if (roomLit) Object.values(set).filter((m) => m !== set.glass && m !== set.curtainSheer).forEach((m) => applyRoomLights(m));
    return set;
  }, [lib, inside, roomLit]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

export type InteriorMaterials = ReturnType<typeof useInteriorMaterials>;
export type InteriorMaterialName = keyof InteriorMaterials;
