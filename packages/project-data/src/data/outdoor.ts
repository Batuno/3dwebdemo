// Outdoor standing points, in site metres. View direction is degrees clockwise from plan north (-z).
export interface OutdoorSpot {
  id: string;
  /** Key in the amenity strings. */
  labelKey: string;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  fov: number;
  /** The amenity whose label opens this view. */
  amenity?: string;
}

export const OUTDOOR_EYE_HEIGHT = 1.6;

export const outdoorSpots: OutdoorSpot[] = [
  { id: 'path', labelKey: 'mainPath', x: -22, z: 12.5, yaw: 88, pitch: 3, fov: 68 },
  { id: 'playground', labelKey: 'playground', x: -9, z: 12, yaw: 335, pitch: -2, fov: 70, amenity: 'playground' },
  { id: 'garden', labelKey: 'garden', x: -60, z: 13, yaw: 195, pitch: 0, fov: 70, amenity: 'garden' },
  { id: 'court', labelKey: 'hardCourt', x: 3.5, z: 13, yaw: 14, pitch: 0, fov: 70, amenity: 'court' },
  { id: 'adult-fitness', labelKey: 'adultFitness', x: -34, z: 15.5, yaw: 0, pitch: -3, fov: 68, amenity: 'adult' },
  { id: 'elderly-fitness', labelKey: 'elderlyFitness', x: -44, z: -3, yaw: 90, pitch: -2, fov: 68, amenity: 'elderly' },
  { id: 'pavilion', labelKey: 'pavilion', x: 15, z: 7, yaw: 105, pitch: 2, fov: 68, amenity: 'pavilion' },
  { id: 'drop-off', labelKey: 'dropOff', x: 50, z: 12, yaw: 340, pitch: 2, fov: 70, amenity: 'dropoff' },
  { id: 'garage-entry', labelKey: 'garageEntry', x: 75, z: 38, yaw: 270, pitch: -8, fov: 66, amenity: 'garageEntry' },
  { id: 'entrance-804A', labelKey: 'entrance804A', x: 3, z: -11, yaw: 0, pitch: 14, fov: 72 },
  { id: 'entrance-804B', labelKey: 'entrance804B', x: -3, z: 16, yaw: 180, pitch: 14, fov: 72 },
];

export const outdoorSpotById = (id: string | undefined): OutdoorSpot | undefined =>
  outdoorSpots.find((s) => s.id === id);

/** The view an amenity's label opens, when it has one. */
export const outdoorSpotForAmenity = (amenity: string): OutdoorSpot | undefined =>
  outdoorSpots.find((s) => s.amenity === amenity);
