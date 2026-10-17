// Shape and palette are independent axes: any shape works in any palette.
// Both are switchable at runtime (see config-client.js), so nothing here may
// be baked into the renderer.

export const SHAPES = {
  // Bright field, dark pupil. Most legible gaze direction at distance.
  amber: { rxFactor: 1.00, ryFactor: 1.00, hasIris: true,  pupil: 'round', halo: false },
  // No sclera — a glowing orb. Best atmosphere, softer extremes.
  ember: { rxFactor: 0.76, ryFactor: 1.00, hasIris: false, pupil: 'slit',  halo: true  },
  // Aniridia: no iris, so the pupil is the iris's full width — one large dark
  // disc. With no iris muscle it also cannot dilate or constrict, so pupilFixed
  // ignores pose pupil sizes, and a palette's slit override does not apply.
  aniridia: { rxFactor: 1.00, ryFactor: 1.00, hasIris: false, pupil: 'round', halo: false,
              pupilR: 0.43, pupilFixed: true }
};

export const PALETTES = {
  amber: {
    sclera: ['#FFC96A', '#F0A72C', '#B96C07'],
    iris:   ['#B8541A', '#8A3505', '#421400'],
    pupil: '#150300', glint: '#FFF3D6', glintOpacity: 0.5, halo: '#FF8C1A',
    pupilOverride: null
  },
  green: {
    sclera: ['#F2FBCF', '#C3E07A', '#6B9B34'],
    iris:   ['#7BA83A', '#48701E', '#1B3A0A'],
    pupil: '#080F04', glint: '#FBFFE8', glintOpacity: 0.5, halo: '#9FD84A',
    // A cat's eye has a vertical slit — that, not the color alone,
    // is what turns a green eye into a cat.
    pupilOverride: 'slit'
  },
  violet: {
    sclera: ['#EBD6FF', '#B57BEA', '#6A2FA8'],
    iris:   ['#7A2E9E', '#4B1569', '#1E0530'],
    pupil: '#0B0212', glint: '#F8EEFF', glintOpacity: 0.5, halo: '#B266FF',
    pupilOverride: null
  },
  ghost: {
    sclera: ['#E8FBFF', '#9FD8EE', '#3F7FA6'],
    iris:   ['#3A6E9A', '#1E4468', '#0A1C30'],
    pupil: '#030A12', glint: '#FFFFFF', glintOpacity: 0.6, halo: '#8FE3FF',
    pupilOverride: null
  },
  // The classic Halloween clash: lime eye, purple iris.
  slime: {
    sclera: ['#EFFF9A', '#B6F23A', '#5E9E0C'],
    iris:   ['#B04FD6', '#7A1FA3', '#35084D'],
    pupil: '#0E0214', glint: '#FBFFE0', glintOpacity: 0.5, halo: '#C6FF3D',
    pupilOverride: null
  }
};

export const SHAPE_NAMES = Object.keys(SHAPES);
export const PALETTE_NAMES = Object.keys(PALETTES);
