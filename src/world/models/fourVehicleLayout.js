/** Shared absolute, vehicle-local anchors for the four reference road cars. Front is -Z. */
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const FOUR_VEHICLE_LAYOUT = freeze({
  convertible: {
    key: 'convertible', width: 2.16, depth: 4.80, height: 1.62,
    eye: [-.53, .50, -.05], fov: 74,
    wheels: { track: .95, radius: .40, y: -.50, frontZ: -1.52, rearZ: 1.37 },
    cabin: {
      innerWidth: 1.88, floorY: -.59, sillY: .12, roofY: null,
      frontZ: -1.04, rearZ: 1.34, dashY: .13, dashZ: -.88,
      steering: [-.53, .13, -.57],
      frontSeats: [[-.53, -.25, .18], [.53, -.25, .18]],
      rearSeats: [[-.47, -.19, .92], [.47, -.19, .92]],
    },
    windshield: [[-.89,.15,-1.04],[.89,.15,-1.04],[.80,.72,-.43],[-.80,.72,-.43]],
  },
  coupe: {
    key: 'coupe', width: 2.22, depth: 5.02, height: 1.75,
    eye: [-.54, .55, -.12], fov: 72,
    wheels: { track: .98, radius: .42, y: -.48, frontZ: -1.55, rearZ: 1.43 },
    cabin: {
      innerWidth: 1.94, floorY: -.59, sillY: .17, roofY: .85,
      frontZ: -1.09, rearZ: 1.50, dashY: .19, dashZ: -.94,
      steering: [-.54, .04, -.66],
      frontSeats: [[-.54, -.23, .12], [.54, -.23, .12]],
      rearSeats: [[-.50, -.18, 1.03], [0, -.18, 1.03], [.50, -.18, 1.03]],
    },
    windshield: [[-.91,.20,-1.09],[.91,.20,-1.09],[.77,.80,-.46],[-.77,.80,-.46]],
  },
  supercar: {
    key: 'supercar', width: 2.24, depth: 4.72, height: 1.40,
    eye: [-.51, .35, .04], fov: 76,
    wheels: { track: 1.00, radius: .39, y: -.51, frontZ: -1.50, rearZ: 1.32 },
    cabin: {
      innerWidth: 1.84, floorY: -.65, sillY: .04, roofY: .50,
      frontZ: -.96, rearZ: .91, dashY: .00, dashZ: -.79,
      steering: [-.51, -.02, -.51],
      frontSeats: [[-.51, -.39, .25], [.51, -.39, .25]], rearSeats: [],
    },
    windshield: [[-.86,.04,-.96],[.86,.04,-.96],[.70,.47,-.39],[-.70,.47,-.39]],
  },
  electric: {
    key: 'electric', width: 2.20, depth: 4.98, height: 1.78,
    eye: [-.56, .59, -.10], fov: 72,
    wheels: { track: .97, radius: .42, y: -.48, frontZ: -1.57, rearZ: 1.40 },
    cabin: {
      innerWidth: 1.92, floorY: -.59, sillY: .18, roofY: .88,
      frontZ: -1.13, rearZ: 1.55, dashY: .19, dashZ: -.96,
      steering: [-.56, .18, -.67],
      frontSeats: [[-.56, -.22, .14], [.56, -.22, .14]],
      rearSeats: [[-.51, -.17, 1.07], [0, -.17, 1.07], [.51, -.17, 1.07]],
    },
    windshield: [[-.91,.20,-1.13],[.91,.20,-1.13],[.77,.84,-.43],[-.77,.84,-.43]],
  },
});
