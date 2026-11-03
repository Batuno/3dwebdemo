// Places where Appendix A cannot be met as written. Furniture is never shrunk to hide one of these.
// The test suite fails if a new violation appears, or if one listed here no longer happens.
// docs/INTERIOR_NOTES.md explains each one for the design owner.
export interface ClearanceException {
  key: string;
  why: string;
}

export const exceptions: ClearanceException[] = [
  {
    key: '2RF_T1|walking-route|between-sofa-and-tv',
    why: 'Room 2.90 m minus sofa 0.85, gap 0.45, table 0.50, console 0.40 leaves 0.70 m, not the 0.90 m path.',
  },
  {
    key: '2RF_T2|walking-route|between-sofa-and-tv',
    why: 'Room 3.00 m minus sofa 0.85, gap 0.45, table 0.50, console 0.40 leaves 0.80 m, not the 0.90 m path.',
  },
  {
    key: '4R|behind-dining-chair|dining/dining-chair-4',
    why: 'Table 0.90 + two chair rows 1.00 + two 0.75 m walkways needs 3.40 m in a 3.00 m room. The hall side keeps its 0.90 m.',
  },
  {
    key: '4R|behind-dining-chair|dining/dining-chair-5',
    why: 'Same row as chair 4.',
  },
  {
    key: '4R|behind-dining-chair|dining/dining-chair-6',
    why: 'Same row as chair 4.',
  },
];
