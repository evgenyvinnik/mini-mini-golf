/*

Copyright 2022 Cliff Earl, Antix Development

Permission is hereby granted, free of charge, to any person obtaining a copy of 
this software and  associated documentation  files (the "Software"), to deal in 
the  Software without restriction,  including without limitation  the rights to 
use, copy,  modify, merge, publish, distribute,  sublicense, and/or sell copies 
of the Software, and to permit persons  to whom the Software is furnished to do 
so, subject to the following conditions:

The above copyright notice and this  permission notice shall be included in all 
copies or substantial portions of the Software.

THE  SOFTWARE IS  PROVIDED "AS  IS", WITHOUT  WARRANTY OF ANY  KIND, EXPRESS OR 
IMPLIED,  INCLUDING BUT  NOT  LIMITED  TO THE  WARRANTIES  OF  MERCHANTABILITY, 
FITNESS FOR A  PARTICULAR PURPOSE  AND NONINFRINGEMENT. IN  NO EVENT  SHALL THE 
AUTHORS  OR  COPYRIGHT  HOLDERS BE  LIABLE  FOR  ANY CLAIM,  DAMAGES  OR  OTHER 
LIABILITY, WHETHER IN  AN ACTION OF  CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION  WITH THE SOFTWARE OR THE USE  OR OTHER DEALINGS IN THE 
SOFTWARE.

*/

//
// Constants
//

const launchTime = Date.now(),
  D = document,
  W = window,
  STORAGE = W.localStorage,
  SAVEFILE_NAME = "io.github.evgenyvinnik", // Namespace for localstorage operations
  M = Math,
  PI = M.PI,
  PI2 = M.PI * 2,
  sin = M.sin,
  cos = M.cos,
  imul = M.imul,
  atan2 = M.atan2,
  ceil = M.ceil,
  floor = M.floor,
  hypot = M.hypot,
  min = M.min,
  abs = M.abs,
  P_N = 1, // Directions for node bitmasks (search for "angry fish adventures in bitmasking" on the wayback machine or the internet archive)
  P_S = 4,
  P_E = 2,
  P_W = 8,
  MIN_PUTTER_LENGTH = 25, // If the putter length is less than this value, releasing the mouse will NOT initiate a new putt
  M_P_L = 400, // Maximum length of the putter shaft
  M_B_S = 700, // Maximum speed the ball can travel at
  HOLE_RADIUS = 12, // Radius of the goal hole
  WATER_HAZZARD = 0, // Hazzard types
  S_H = 1,
  W_T = 8,
  B_T = 4;

(M_N = 0), // Game modes
  (MODE_TITLE = 1),
  (MODE_INSTRUCTIONS = 2),
  (MODE_PLAY = 3),
  (MODE_FADE_OUT = 4), // Fade out between holes
  (MODE_FADE_IN = 5), // Fade in new hole
  (oneCell = 160), // Hardcoded sizes for drawing nodes
  (halfCell = 80),
  // The canvas dimensions are derived from the trimmed width and height of the path, multiplied by the cell size
  (canvasWidth = oneCell * 5 + 4),
  (canvasHeight = oneCell * 5 + 4);

//
// Variables
//

let // Various screens
  stats,
  title,
  titleButtons,
  hudScreen,
  rS,
  rSButtons,
  iS,
  iSButtons,
  instructionsVisible,
  dontResetOnInstructionsClosed,
  thisFrame, // Dates used for calculating DeltaTime between `onEnterFrame events`
  lastFrame,
  DT, // Time elapsed (in milliseconds) since last the last `onEnterFrame` event
  BG_CANVAS, // Canvas
  BG_CTX, // Drawing context
  OBJ_CANVAS, // ...
  OBJ_CTX,
  FG_CANVAS,
  FG_CTX,
  data, // Temp variable for data loaded from local storage
  gameState, // The game state
  fadeInOutCounter, // Counter for fades between holes
  ballResetX,
  ballResetY, // Used for repositioning the ball when it has entered a water hazzard
  ballInSand,
  friction,
  gameMode = MODE_TITLE, // Current game mode
  ball = null, // The ball
  ballResetPosition,
  goal = {
    // The goal
    C: null, // Position
    B: 12, // Radius
  },
  obstacle,
  hazzards = [], // Water and sand hazzards
  puttAngle, // Putter aiming angle (radians)
  putterLength, // The power of the putter shaft chosen by the player
  putterEnabled = false, // True if the player can make another putt, False when the ball is in motion
  mouseDownPosition,
  mouseMovePosition,
  mouseUpPosition, // Mouse tracking, used for aiming the putter
  pathLength, // Length of the path (in nodes), excluding extra nodes
  path, // A 2 dimensional array to hold rows of `PathNode`
  nodes, // Pointer to any given array of `PathNode`
  node,
  tempVar, // A temp variable
  statsVisible,
  secondCounter,
  statUpdateRequired,
  generatorParameters = {
    width: 0, // Path dimensions
    height: 0,
    maxPathLength: 0, // Maximum number of nodes (excluding extra nodes) to generate
    generateExtraNodes: true, // True if we want to generate side roms off the main path.
    chanceToGenerateExtraNode: 1, // Chance (0-1) to generate side rooms.
    maxExtraNodes: 0, // Maximum number of side rooms to generate.
    chanceToGenerateObstacle: 0.35, // Chance to generate an obstacle in any empty `PathNode` that is NOT an extra node. TODO variable should scale over time
    chanceToGenerateWindmill: 0.35, // Chance to generate a windmill, otherwise generate a blocker
  };

// #region -- Utility functions

// Get the HTML element with the given id
let getByID = (id) => document.getElementById(id),
  // Append the given HTML element to the documents body
  appendToDocumentBody = (el) => D.body.appendChild(el),
  // Set the opacity of the documents body, essentially allowing the entire display to fade in and out of the background
  setOpacity = (opacity) => (D.body.style.opacity = `${opacity}`),
  // Make the given HTML element visible or invisible, according to the given state
  showElement = (el, state) =>
    state ? el.classList.remove("i") : el.classList.add("i"),
  // Update the `innerHTML` of the element with the given id, with the given text
  setTextByID = (id, t) => (getByID(id).innerHTML = t),
  // Constrain the given number to the given range
  clamp = (v, min, max) => (v < min ? min : v > max ? max : v),
  // Set the game mode
  setMode = (mode) => {
    gameMode = mode;
    //console.log(`gameMode changed to ${['M_N', 'MODE_TITLE', 'MODE_INSTRUCTIONS', 'MODE_PLAY', 'MODE_FADE_OUT', 'MODE_FADE_IN'][mode]}`);
  },
  // Create a new button with the given label and onclick function
  newButton = (label, onclick) => {
    let b = D.createElement("a");
    b.classList.add("btn");
    b.innerHTML = label;
    b.onclick = onclick;

    return b;
  },
  // Create a new canvas with the given dimensions and id, then append it to the document body
  newCanvas = (w, h, id) => {
    let c = D.createElement("canvas"), // Create a new canvas
      ctx = c.getContext("2d"); // Get drawing context
    c.ctx = ctx;
    c.width = w; // Set canvas dimensions
    c.height = h;
    c.id = id; // Set id
    appendToDocumentBody(c); // Attach to document body
    return c;
  };

// #endregion

// #region -- Pseudo Random Number Generator

// A deterministic random number generator (Mulberry32)
let rng = {
    // Set the random seed
    setSeed: (seed) => {
      rng.seed = seed;
    },

    // Get the random seed
    getSeed: () => {
      return rng.seed;
    },

    // Get a new random number (0-1)
    random: () => {
      rng.seed += 0x6d2b79f5;
      let t = rng.seed;
      t = imul(t ^ (t >>> 15), t | 1);
      t ^= t + imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  },
  // Get a random float between 0 and 1
  random = () => rng.random(),
  // Get a random number in the given range
  getRandomIntInclusive = (min, max) => {
    min = ceil(min);
    return floor(random() * (floor(max) - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
  };

// #region -- Physics (a modified version of the Github repository at https://github.com/xem/mini2Dphysics/)

// 2D vector tools
let Vec2 = (x, y) => ({ x, y }),
  length = (v) => dot(v, v) ** 0.5,
  add = (v, w) => Vec2(v.x + w.x, v.y + w.y),
  subtract = (v, w) => add(v, scale(w, -1)),
  scale = (v, n) => Vec2(v.x * n, v.y * n),
  dot = (v, w) => v.x * w.x + v.y * w.y,
  cross = (v, w) => v.x * w.y - v.y * w.x,
  rotate = (v, center, angle, x = v.x - center.x, y = v.y - center.y) =>
    Vec2(
      x * cos(angle) - y * sin(angle) + center.x,
      x * sin(angle) + y * cos(angle) + center.y
    ),
  normalize = (v) => scale(v, 1 / (length(v) || 1)),
  distance = (v, w) => length(subtract(v, w)),
  // All shapes
  objects = [],
  // Collision info
  collisionInfo = {}, // final collision between two shapes
  // collisionInfoR1 = {}, // temp collision: rect 1 vs rect 2
  // collisionInfoR2 = {}; // temp collision: rect 1 vs rect 1

  // Collision info setter
  setInfo = (collision, D, N, S) => {
    collision.D = D; // depth
    collision.N = N; // normal
    collision.S = S; // start
    collision.E = add(S, scale(N, D)); // end
  },
  // New shape
  RigidShape = (C, mass, F, R, T, B, W, H, shape) => {
    shape = {
      T, // 0 circle / 1 rectangle
      C, // center
      F, // friction
      R, // restitution (bouncing)
      M: mass ? 1 / mass : 0, // inverseMass (0 if immobile)
      V: Vec2(0, 0), // velocity (speed)
      A: Vec2(0, 0), //mass ? mGravity : Vec2(0, 0), // acceleration
      G: 0, // angle
      v: 0, // angle velocity
      a: 0, // angle acceleration
      B, // (bounds) radius
      W, // width
      H, // height
      I: T // inertia
        ? (hypot(W, H) / 2,
          mass > 0 ? 1 / ((mass * (W ** 2 + H ** 2)) / 12) : 0) // rectangle
        : mass > 0
        ? (mass * B ** 2) / 12
        : 0, // circle
      N: [], // face normals array (rectangles)
      X: [
        // Vertex: 0: TopLeft, 1: TopRight, 2: BottomRight, 3: BottomLeft (rectangles)
        Vec2(C.x - W / 2, C.y - H / 2),
        Vec2(C.x + W / 2, C.y - H / 2),
        Vec2(C.x + W / 2, C.y + H / 2),
        Vec2(C.x - W / 2, C.y + H / 2),
      ],
    };

    // Prepare rectangle
    if (T /* == 1 */) computeRectNormals(shape);

    objects.push(shape);

    return shape;
  },
  // Move a shape along a vector
  moveShape = (shape, v, i) => {
    // Center
    shape.C = add(shape.C, v);

    // Rectangle (move vertex)
    // if(shape.T){
    //   for(i = 4; i--;){
    //     shape.X[i] = add(shape.X[i], v);
    //   }
    // }
  },
  // Rotate a shape around its center
  rotateShape = (shape, angle, i) => {
    // Update angle
    shape.G += angle;

    // Rectangle (rotate vertex)
    if (shape.T) {
      for (i = 4; i--; ) {
        shape.X[i] = rotate(shape.X[i], shape.C, angle);
      }
      computeRectNormals(shape);
    }
  },
  // Test if two shapes have intersecting bounding circles, and therefore possibly be colliding
  boundTest = (s1, s2) => length(subtract(s2.C, s1.C)) <= s1.B + s2.B,
  // Compute face normals (for rectangles)
  computeRectNormals = (shape, i) => {
    // N: normal of each face toward outside of rectangle
    // 0: Top, 1: Right, 2: Bottom, 3: Left
    for (i = 4; i--; ) {
      shape.N[i] = normalize(
        subtract(shape.X[(i + 1) % 4], shape.X[(i + 2) % 4])
      );
    }
  },
  // Test collision between two shapes
  testCollision = (c1, c2, info) => {
    // Circle vs circle
    // if(!c1.T && !c2.T){
    //   var
    //   vFrom1to2 = subtract(c2.C, c1.C),
    //   rSum = c1.B + c2.B,
    //   dist = length(vFrom1to2);

    //   if(dist <= M.sqrt(rSum * rSum)){

    //     // overlapping but not same position
    //     var
    //     normalFrom2to1 = normalize(scale(vFrom1to2, -1)),
    //     radiusC2 = scale(normalFrom2to1, c2.B);
    //     setInfo(collisionInfo, rSum - dist, normalize(vFrom1to2), add(c2.C, radiusC2));
    //   }

    //   return 1;
    // }

    // Rect vs Rect
    // if(c1.T /*== 1*/ && c2.T /*== 1*/){
    //   var
    //   status1 = 0,
    //   status2 = 0;

    //   // find Axis of Separation for both rectangles
    //   status1 = findAxisLeastPenetration(c1, c2, collisionInfoR1);
    //   if(status1){
    //     status2 = findAxisLeastPenetration(c2, c1, collisionInfoR2);
    //     if(status2){

    //       // if both of rectangles are overlapping, choose the shorter normal as the normal
    //       if(collisionInfoR1.D < collisionInfoR2.D){
    //         setInfo(collisionInfo, collisionInfoR1.D, collisionInfoR1.N, subtract(collisionInfoR1.S, scale(collisionInfoR1.N, collisionInfoR1.D)));
    //       }

    //       else {
    //         setInfo(collisionInfo, collisionInfoR2.D, scale(collisionInfoR2.N, -1), collisionInfoR2.S);
    //       }
    //     }
    //   }
    //   return status1 && status2;
    // }

    // Rectangle vs Circle
    // (c1 is the rectangle and c2 is the circle, invert the two if needed)
    if (!c1.T && c2.T /*== 1*/) {
      [c1, c2] = [c2, c1];
    }

    if (c1.T /*== 1*/ && !c2.T) {
      var inside = 1,
        bestDistance = -1e9,
        nearestEdge = 0,
        i,
        v,
        circ2Pos,
        projection;

      for (i = 4; i--; ) {
        // find the nearest face for center of circle
        circ2Pos = c2.C;
        v = subtract(circ2Pos, c1.X[i]);
        projection = dot(v, c1.N[i]);
        if (projection > 0) {
          // if the center of circle is outside of c1angle
          bestDistance = projection;
          nearestEdge = i;
          inside = 0;
          break;
        }

        if (projection > bestDistance) {
          bestDistance = projection;
          nearestEdge = i;
        }
      }
      var dis, normal;

      if (inside) {
        // the center of circle is inside of c1angle
        setInfo(
          collisionInfo,
          c2.B - bestDistance,
          c1.N[nearestEdge],
          subtract(circ2Pos, scale(c1.N[nearestEdge], c2.B))
        );
      } else {
        // the center of circle is outside of c1angle
        // v1 is from left vertex of face to center of circle
        // v2 is from left vertex of face to right vertex of face
        var v1 = subtract(circ2Pos, c1.X[nearestEdge]),
          v2 = subtract(c1.X[(nearestEdge + 1) % 4], c1.X[nearestEdge]),
          dotp = dot(v1, v2);
        if (dotp < 0) {
          // the center of circle is in corner region of X[nearestEdge]
          dis = length(v1);

          // compare the distance with radium to decide collision
          if (dis > c2.B) {
            return;
          }
          normal = normalize(v1);
          setInfo(
            collisionInfo,
            c2.B - dis,
            normal,
            add(circ2Pos, scale(normal, -c2.B))
          );
        } else {
          // the center of circle is in corner region of X[nearestEdge+1]
          // v1 is from right vertex of face to center of circle
          // v2 is from right vertex of face to left vertex of face
          v1 = subtract(circ2Pos, c1.X[(nearestEdge + 1) % 4]);
          v2 = scale(v2, -1);
          dotp = dot(v1, v2);
          if (dotp < 0) {
            dis = length(v1);

            // compare the distance with radium to decide collision
            if (dis > c2.B) {
              return;
            }
            normal = normalize(v1);
            setInfo(
              collisionInfo,
              c2.B - dis,
              normal,
              add(circ2Pos, scale(normal, -c2.B))
            );
          } else {
            // the center of circle is in face region of face[nearestEdge]
            if (bestDistance < c2.B) {
              setInfo(
                collisionInfo,
                c2.B - bestDistance,
                c1.N[nearestEdge],
                subtract(circ2Pos, scale(c1.N[nearestEdge], c2.B))
              );
            } else {
              return;
            }
          }
        }
      }
      return 1;
    }
  },
  // Resolve collision between two shapes
  resolveCollision = (s1, s2, collisionInfo) => {
    if (!s1.M && !s2.M) {
      return;
    }

    // correct positions
    var num = (collisionInfo.D / (s1.M + s2.M)) * 0.8, // .8 = poscorrectionrate = percentage of separation to project objects
      correctionAmount = scale(collisionInfo.N, num),
      n = collisionInfo.N;

    moveShape(s1, scale(correctionAmount, -s1.M));
    moveShape(s2, scale(correctionAmount, s2.M));

    // the direction of collisionInfo is always from s1 to s2
    // but the Mass is inversed, so start scale with s2 and end scale with s1
    var start = scale(collisionInfo.S, s2.M / (s1.M + s2.M)),
      end = scale(collisionInfo.E, s1.M / (s1.M + s2.M)),
      p = add(start, end),
      // r is vector from center of object to collision point
      r1 = subtract(p, s1.C),
      r2 = subtract(p, s2.C),
      // newV = V + v cross R
      v1 = add(s1.V, Vec2(-1 * s1.v * r1.y, s1.v * r1.x)),
      v2 = add(s2.V, Vec2(-1 * s2.v * r2.y, s2.v * r2.x)),
      relativeVelocity = subtract(v2, v1),
      // Relative velocity in normal direction
      rVelocityInNormal = dot(relativeVelocity, n);

    // if objects moving apart ignore
    if (rVelocityInNormal > 0) {
      return;
    }

    // compute and apply response impulses for each object
    var newRestituion = min(s1.R, s2.R),
      newFriction = min(s1.F, s2.F),
      // R cross N
      R1crossN = cross(r1, n),
      R2crossN = cross(r2, n),
      // Calc impulse scalar
      // the formula of jN can be found in http://www.myphysicslab.com/collision.html
      jN =
        (-(1 + newRestituion) * rVelocityInNormal) /
        (s1.M + s2.M + R1crossN * R1crossN * s1.I + R2crossN * R2crossN * s2.I),
      // impulse is in direction of normal ( from s1 to s2)
      impulse = scale(n, jN);

    // impulse = F dt = m * ?v
    // ?v = impulse / m
    s1.V = subtract(s1.V, scale(impulse, s1.M));
    s2.V = add(s2.V, scale(impulse, s2.M));
    s1.v -= R1crossN * jN * s1.I;
    s2.v += R2crossN * jN * s2.I;
    var tangent = scale(
        normalize(
          subtract(relativeVelocity, scale(n, dot(relativeVelocity, n)))
        ),
        -1
      ),
      R1crossT = cross(r1, tangent),
      R2crossT = cross(r2, tangent),
      jT =
        (-(1 + newRestituion) * dot(relativeVelocity, tangent) * newFriction) /
        (s1.M + s2.M + R1crossT * R1crossT * s1.I + R2crossT * R2crossT * s2.I);

    // friction should less than force in normal direction
    if (jT > jN) {
      jT = jN;
    }

    // impulse is from s1 to s2 (in opposite direction of velocity)
    impulse = scale(tangent, jT);
    s1.V = subtract(s1.V, scale(impulse, s1.M));
    s2.V = add(s2.V, scale(impulse, s2.M));
    s1.v -= R1crossT * jT * s1.I;
    s2.v += R2crossT * jT * s2.I;
  },
  // New circle
  Circle = (center, radius, mass, friction, restitution, draw = 0) =>
    RigidShape(center, mass, friction, restitution, 0, radius, draw),
  // New rectangle
  Rectangle = (center, width, height, mass, friction, restitution) =>
    RigidShape(
      center,
      mass,
      friction,
      restitution,
      1,
      hypot(width, height) / 2,
      width,
      height
    ),
  // Check for, and resolve collisions between the ball and other physics shapes
  checkResolveObjectCollisions = () => {
    for (i = objects.length; i--; ) {
      if (objects[i] != ball) {
        // Don't check ball vs ball collisions

        let other = objects[i];

        if (boundTest(other, ball)) {
          // Test bounds

          if (testCollision(other, ball, collisionInfo)) {
            // Test collision

            // Make sure the normal is always from object[i] to object[j]
            if (dot(collisionInfo.N, subtract(ball.C, other.C)) < 0) {
              collisionInfo = {
                D: collisionInfo.D,
                N: scale(collisionInfo.N, -1),
                S: collisionInfo.E,
                E: collisionInfo.S,
              };
            }

            // ball.collided = true; // Let other parts of the application know that the ball hit a physics object and had its position and velocity corrected

            resolveCollision(other, ball, collisionInfo); // Resolve collision

            if (!ball.inGoal) {
              // Ball in goal?

              if (other.isWindmill) {
                gameState.flips++;
                statUpdateRequired = true;
                //console.log('ball hit windmill');
              } else if (other.isBlocker) {
                gameState.bumps++;
                statUpdateRequired = true;
                //console.log('ball hit blocker');
              } else {
                gameState.rebounds++;
                statUpdateRequired = true;
                //console.log('ball hit wall');
              }
            } // End "ball in goal" check

            //
            // There is an edge-case where the ball comes to rest, the player starts to aim, and then a moving
            // object collides with the ball! In this case we need to cancel the aiming process.
            //

            if (mouseDownPosition) {
              // Is the player aiming a new putt when the ball is colliding??
              erasePutter();
              mouseDownPosition = null;
              mouseMovePosition = null;
              putterEnabled = false;
            } // End "balll collided whilst aiming" check

            return;
          } // End "object collided with object" test
        } // End "broad phase collision" loop
      } // End "ball vs ball" test
    } // End outer loop
  },
  //#endregion

  // #region -- Hole generation

  // Generate the next hole
  nextHole = () => {
    //console.log('advancing to next hole');

    gameState.hole++;
    gameState.putts = 0;

    generateHole();

    updateHUD();

    fadeInOutCounter = 0; // Set fade counter to fade in over 1 second
    setMode(MODE_FADE_IN); // Begin the next hole fading in
  },
  // Generate a new hole
  generateHole = () => {
    gameState.seed = rng.getSeed(); // Store the random seed

    //
    // Update generatr params
    //

    let maxWidthOrHeight = 3; // Max width and height of any hole

    generatorParameters.maxPathLength = 4;
    generatorParameters.chanceToGenerateExtraNode = 0.3;
    generatorParameters.chanceToGenerateObstacle = 0.3;
    generatorParameters.chanceToGenerateWindmill = 0.25;

    if (gameState.hole < 4) {
      generatorParameters.chanceToGenerateObstacle = 0.1; // Don't generate any obstacles for thr first 4 holes
    }

    if (gameState.hole > 5) {
      maxWidthOrHeight++;
      generatorParameters.maxPathLength = 6;
      generatorParameters.chanceToGenerateExtraNode = 0.45;
      generatorParameters.chanceToGenerateObstacle = 0.4;
      generatorParameters.chanceToGenerateWindmill = 0.3;
    }

    if (gameState.hole > 10) {
      generatorParameters.maxPathLength = 8;
      generatorParameters.chanceToGenerateExtraNode = 0.6;
      generatorParameters.chanceToGenerateObstacle = 0.5;
      generatorParameters.chanceToGenerateWindmill = 0.35;
    }

    if (gameState.hole > 15) {
      maxWidthOrHeight++;
      generatorParameters.maxPathLength = 10;
      generatorParameters.chanceToGenerateExtraNode = 0.75;
      generatorParameters.chanceToGenerateObstacle = 0.6;
      generatorParameters.chanceToGenerateWindmill = 0.4;
    }

    generatorParameters.width = getRandomIntInclusive(3, maxWidthOrHeight);
    generatorParameters.height = getRandomIntInclusive(3, maxWidthOrHeight);

    hazzards = []; // Clear hazzards and objects from previous hole
    objects = [];

    generateMainPathNodes(generatorParameters); // Generate a new path using the given options

    generateExtraPathNodes(generatorParameters); // Generate extra nodes off the main path using the given options

    getBounds();

    trim();

    // //console.log(`Path bounds = left: ${path.leftEdge} right: ${path.rightEdge} top: ${path.topEdge} bottom: ${path.bottomEdge} width: ${(path.rightEdge - path.leftEdge) + 1} height: ${path.bottomEdge + 1}`);

    finalizeAndDrawHole();

    //console.log('hole generated');
  },
  // Set the given nodes wall with the given direction as being open
  openNodeWall = (node, direction) => (node.bitMask |= direction),
  // Set the given node as being part of the path.
  includeNodeInPath = (node) => (node.partOfPath = true),
  // Create a new path
  newPath = (params) => {
    //
    // Create and populate a grid (2d array) of empty path nodes
    //

    nodes = [];

    for (let r = 0; r < params.height; r++) {
      // Create this many rows

      let row = []; // Create a new row

      for (let c = 0; c < params.width; c++) {
        // Crete this many columns

        //
        // Insert a new path node
        //

        row.push({
          // partOfPath:     false, // True if this node is part of the path.
          // isFirstNode:    false, // True if this node is the first in the path.
          // isLastNode:     false, // True if this node is the last in the path.
          // extra:          false, // True of this node is an extra cell.
          // isWaterTrap:    false, // True if this is a water hazzard, false if this is a sand hazzard.
          // potentialExtra: false, // True of this node could potentially be an extra.
          // extraDirection: '', // Direction of neighboring node on main path if this node becomes an extra node.

          // NOTE: Only the following are actually required for initilaztion.. the rest can be set later in the generation process

          bitMask: 0, // The bitmask representation of the nodes overall accessability.
          row: r, // Row that this node occupies in the grid.
          col: c, // Column that this node occupies in the grid.
        }); // add the new path node to the row
      } // End cols loop

      nodes.push(row); // Add the row to the grid
    } // End rows loop

    // Return a new path structure
    return {
      width: params.width, // Dimensions
      height: params.height,

      leftEdge: 0, // Bounds
      rightEdge: 0,
      topEdge: 0,
      bottomEdge: 0,

      // firstNode: null, // First and last nodes
      // lastNode: null,

      pathNodes: nodes, // Collection of PathNode
    };
  },
  // Create and return a new path.
  generateMainPathNodes = (params) => {
    const maxPathLength = params.maxPathLength - 1, // Determine maximum path length
      maxX = params.width - 1, // Axis constraints.
      maxY = params.height - 1;

    // Advance the path to the East, or South if it is unable to do that
    let advanceEast = () => {
        if (pathX < maxX) {
          // Can path advance further to the east?

          // The path can advance east.
          includeNodeInPath(node); // Set current node as part of path.
          openNodeWall(node, P_E); // Open east wall at current position.

          pathX++;

          getNode(); // New current node is the node to east of the curent cell.
          openNodeWall(node, P_W); // Open west wall to previous cell.
          pathLength++;
        } else {
          // Path cannot advance any further east, force south

          advanceSouth();
        } // End "path can advance east" check
      },
      // Advance the path to the West, or South if it is unable to do that
      advanceWest = () => {
        if (pathX > 0) {
          // Can path advance further to the west?

          // The path can advance west.
          includeNodeInPath(node); // Set current node as part of path.
          openNodeWall(node, P_W); // Open east wall at current position.

          pathX--;

          getNode(); // New current node is the node to west of the curent cell.
          openNodeWall(node, P_E); // Open east wall to previous cell.
          pathLength++;
        } else {
          // Path cannot advance any further west, force south

          advanceSouth();
        } // End "path can advance west" check
      },
      // Advance the path to the South, or end the path if it is unable to do that
      advanceSouth = () => {
        if (pathY < maxY) {
          // Can path advance further to the south?

          // The path can advance south.
          includeNodeInPath(node); // Set current node as part of path.
          openNodeWall(node, P_S); // Open south wall at current position.

          pathY++;

          getNode(); // New current node is the node to south of the curent cell.
          openNodeWall(node, P_N); // Open north wall to previous cell.
          pathLength++;

          chooseRandomPathDirection();
        } else {
          // Path cannot advance any further south, end the path.

          endMainPath();
        } // End "path can advance south" check
      },
      // Maximum nodes have been placed or the path is unable to advance further south.. so end the main path
      endMainPath = () => {
        includeNodeInPath(node); // Set current node as part of path.

        //
        // 50% of holes will flow from top to bottom, and 50% will be reversed and flow from bottom to top
        //

        if (random() < 0.5) {
          // Should the hole flow be reversed?

          //
          // Reverse the holes direction so it flows from bottom to top
          //

          // Change current first node to be the last node
          tempVar = path.firstNode;
          tempVar.isFirstNode = false;
          tempVar.isLastNode = true;
          path.lastNode = tempVar;

          // Set the current node as the first node (instead of the last node)
          path.firstNode = node;
          node.isFirstNode = true;

          //console.log('hole direction reversed');
        } else {
          //
          // The hole flows from top to bottom
          //

          node.isLastNode = true; // Set current node as the last node in the path.
          path.lastNode = node;
        } // End "reverse hole flow" decision

        done = true;
      },
      // Choose a random direction to move in
      chooseRandomPathDirection = () => {
        if (pathX === maxX) {
          // Is the cursor already at the east-most edge?

          movingEast = false; // Yes, set the new direction to west.
        } else if (pathX === 0) {
          // Is the cursor at the west-most edge?

          movingEast = true; // Yes, set new direction to east.
        } else {
          // The cursor is not at either edge.

          movingEast = random() < 0.5; // Either direction will do.
        }
      },
      // Get the node at the path's current x, y
      getNode = () => {
        node = nodes[pathY][pathX];
      },
      // Start in a random node in the top row
      pathX = getRandomIntInclusive(0, maxX), // Random column
      pathY = 0, // Always start in the top row
      done = false; // True when the main path has been generated

    path = newPath(generatorParameters); // Create a new empty path using the given parameters.

    pathLength = 0; // Set current path length

    nodes = path.pathNodes; // Get the path nodes

    getNode();

    node.isFirstNode = true; // Set as first node in the main path
    path.firstNode = node;

    includeNodeInPath(node); // And also as part of the main path
    chooseRandomPathDirection(); // Choose a random direction to move in

    //
    // Main generation loop
    //

    while (!done) {
      // Loop until done

      if (movingEast) {
        // Is the path advancing east?

        if (random() < 0.7) {
          // 70% chance to keep advancing east.

          if (pathX < maxX) {
            // Can the path continue to advance east?
            advanceEast();
          } else {
            // The path cannot advance any further east.
            advanceSouth();
          }
        } else {
          // 30% chance to advance south.
          advanceSouth();
        }
      } else {
        // The path is advancing west.

        if (random() < 0.7) {
          // 70% chance to keep advancing west.

          if (pathX > 0) {
            // Can the path continue to advance west?
            advanceWest();
          } else {
            // The path cannot advance any further west.
            advanceSouth();
          }
        } else {
          // 30% chance to advance south.
          advanceSouth();
        }
      } // End "moving east or west" check

      if (maxPathLength != -1 && pathLength >= maxPathLength) {
        // End the path if the desired number of nodes have been created
        endMainPath();
      }
    } // End "path generation" loop
  },
  // Calculate the bounds of the path inside it's array of `pathNode`
  getBounds = () => {
    const nodes = path.pathNodes;

    let getRightEdge = () => {
        for (let c = path.width - 1; c > 0; c--) {
          for (let r = 0; r < path.height; r++) {
            if (nodes[r][c].partOfPath) {
              path.rightEdge = c;
              return;
            }
          }
        }
        path.rightEdge = path.width - 1;
      },
      getLeftEdge = () => {
        for (let c = 0; c < path.width; c++) {
          for (let r = 0; r < path.height; r++) {
            if (nodes[r][c].partOfPath) {
              path.leftEdge = c;
              return;
            }
          }
        }
        path.leftEdge = 0;
      };

    getLeftEdge();
    getRightEdge();
    //  getBottomEdge();

    // let getBottomEdge = () => {
    for (let r = path.height - 1; r > 0; r--) {
      for (let c = 0; c < path.width; c++) {
        if (nodes[r][c].partOfPath) {
          path.bottomEdge = r;
          return;
        }
      }
    }
    path.bottomEdge = path.height - 1;
    // },
  },
  // Create a new 2D array of existing `PathNode` minus empty columns and rows of nodes
  trim = () => {
    let newNodes = [];
    for (let r = 0; r <= path.bottomEdge; r++) {
      let row = [];
      for (let c = path.leftEdge; c <= path.rightEdge; c++) {
        row.push(path.pathNodes[r][c]);
      } // End col loop
      newNodes.push(row);
    } // End row loop
    path.width = path.rightEdge - path.leftEdge + 1;
    path.height = path.bottomEdge + 1;

    path.pathNodes = newNodes; // Save new nodes
  },
  // Generate extra nodes off the main path using the given parameters
  generateExtraPathNodes = (params) => {
    if (params.generateExtraNodes) {
      // Only generate extra nodes if required

      let potentialExtras = [], // list of nodes in the grid that could be potentially made into extra nodes off the main path
        tempVar = [], // A temporary list used initially to get the data contained in the list above
        // If the given node is not already a potential extra node, check to see if it could possibly be one, and if so, add it to the collection of potential extra nodes
        checkAndAddCandidate = (node, direction) => {
          if (!node.potentialExtra) {
            // Skip this node if it is already a potential extra node

            if (!node.partOfPath) {
              // Nodes that are not part of the path will be empty

              node.potentialExtra = true; // Mark node as a potential extra node
              node.extraDirection = direction;

              tempVar.push(node);
            } // End "is node empty" check
          } // End "is node already in list" check
        };

      const maxX = params.width - 1, // Axis constraints.
        maxY = params.height - 1,
        nodes = path.pathNodes; // Get the collection of path nodes

      // For each node that is part of the path, find all adjacent empty nodes, and add
      // them to the potential extras list (if they are not already in the list).

      for (let r = 0; r < nodes.length; r++) {
        // Process all rows
        const row = nodes[r]; // Next row

        for (let c = 0; c < row.length; c++) {
          // Process all columns

          if (row[c].partOfPath) {
            // Only check if the current node is part of the main path

            if (c > 0) checkAndAddCandidate(row[c - 1], P_E); // Only check if there is a node to the west
            if (c < maxX) checkAndAddCandidate(row[c + 1], P_W); // Only check if there is a node to the east
            if (r > 0) checkAndAddCandidate(nodes[r - 1][c], P_S); // Only check if there is a node to the north
            if (r < maxY) checkAndAddCandidate(nodes[r + 1][c], P_N); // Only check if there is a node to the south
          } // End "node is part of main path" check
        } // End column loop
      } // End row loop

      //
      // All empty nodes that are adjacent to occupied nodes have now been added to the list of potential extras
      //

      // Randomize / Shuffle the order of the potential nodes
      for (let i = tempVar.length - 1; i >= 0; i--) {
        potentialExtras.push(tempVar.splice(floor(random() * i), 1)[0]); // Remove a random node from the ordered collection and add it to the unordered collection
      }

      let n = clamp(potentialExtras.length, 0, potentialExtras.length); // Get and constrain the maximum number of extra nodes that cen be generated

      for (let i = 0; i < n; i++) {
        // Process n potential extras

        if (random() <= params.chanceToGenerateExtraNode) {
          // Only generate an extra if the threshold is met

          let node = potentialExtras.shift(), // Get the first node from the list (also removes it)
            r = node.row,
            c = node.col,
            noAdjacentExtraNodes = true,
            // Check for adjacent node that is an extra node in the given direction and update flag if one is found
            chk = (r, c) => {
              if (nodes[r][c].extra) noAdjacentExtraNodes = false;
            };

          // Check all adjacent nodes to determine whether any of them are extra nodes. This is done so that no two extra nodes ever border eachother as this would make the hole look less asthetic
          if (c > 0) chk(r, c - 1); // Check node to WEST
          if (c < maxX) chk(r, c + 1); // Check node to EAST
          if (r > 0) chk(r - 1, c); // Check node to NORTH
          if (r < maxY) chk(r + 1, c); // Check node to SOUTH

          if (noAdjacentExtraNodes) {
            // Only proceed if there are NO extra nodes adjacent to this node

            //
            // No nodes adjacent to this node are extra nodes, so it can be made into an extra node
            //

            node.extra = true; // Set this node as an extra node, and part of the path
            node.partOfPath = true;

            // Open walls and set way forward according to the direction to the next path node from this extra node
            switch (node.extraDirection) {
              case P_N: // 1
                //console.log(`case:north (1) generating extra at r:${node.row} c:${node.col}`);
                openNodeWall(nodes[node.row - 1][node.col], P_S); // Other node
                openNodeWall(node, P_N); // This node
                break;

              case P_S: // 4
                //console.log(`case:south (4) generating extra at r:${node.row} c:${node.col}`);
                openNodeWall(nodes[node.row + 1][node.col], P_N);
                openNodeWall(node, P_S);
                break;

              case P_E: // 2
                //console.log(`case:east (2) generating extra at r:${node.row} c:${node.col}`);
                openNodeWall(nodes[node.row][node.col + 1], P_W);
                openNodeWall(node, P_E);
                break;

              default: // The only other direction possible is P_W (8)
                //console.log(`case:west (8) generating extra at r:${node.row} c:${node.col}`);
                openNodeWall(nodes[node.row][node.col - 1], P_E);
                openNodeWall(node, P_W);
                break;
            } // End direction switch
          } // End "no adjacent extra nodes" check

          node.potentialExtra = false; // Clear this flag to stop wierd stuff happening later
        } // End "chance to generate" check
      } // End potentialExtras nodes loop
    } // End "is extra node generation required" check
  },
  // Generate hazzards and obstacles, place ball and goal, and draw the background accordingly
  finalizeAndDrawHole = () => {
    nodes = path.pathNodes; // Get the collection of path nodes

    let row,
      x,
      y,
      id = 1, // Identifier for windmills
      // Clear a rectangular area of the background canvas with the given coordinates and dimensions
      clearRectBG = (x, y, w, h) => BG_CTX.clearRect(x, y, w, h),
      // Set the fill color for the background canvas
      setFillStyleBG = (c) => (BG_CTX.fillStyle = `#${c}`),
      // Fill a rectangular area of the background canvas with the given coordinates and dimensions
      fillRectBG = (x, y, w, h) => BG_CTX.fillRect(x, y, w, h),
      // Fill a cell on the background canvas, then fill 4 more smaller rectangular areas inside that to make a grid pattern, using the given colors
      fillNode = (lineColor, backColor) => {
        setFillStyleBG(lineColor); // Set the line color
        fillRectBG(x, y, oneCell, oneCell); // Fill

        setFillStyleBG(backColor); // Set the background color
        fillRectBG(x + 1, y + 1, halfCell - 2, halfCell - 2); // Fill 4 small rectangular areas to create the illusion of a grid drawn inside the cell
        fillRectBG(x + 1, y + halfCell + 1, halfCell - 2, halfCell - 2);
        fillRectBG(x + halfCell + 1, y + 1, halfCell - 2, halfCell - 2);
        fillRectBG(
          x + halfCell + 1,
          y + halfCell + 1,
          halfCell - 2,
          halfCell - 2
        );
      },
      // Add a new hazzard with the given type to the collection of hazzards
      generateHazzard = (type, c1, c2) => {
        fillNode(c1, c2); // Fill the node with the correct color that represents the type of hazzard

        hazzards.push({
          // Add the new hazzard
          bitMask: node.bitMask, // Used to determine where the ball should be placed after it enters a water trap
          type: type, // Water or Sand
          x: x, // Position
          y: y,
        });
      };

    clearRectBG(0, 0, canvasWidth, canvasHeight); // Clear the background canvas where all nodes will be drawn

    for (let r = 0; r < nodes.length; r++) {
      // Process all nodes
      row = nodes[r]; // Next row of nodes

      for (let c = 0; c < row.length; c++) {
        node = row[c]; // Next node

        node.x = c * oneCell + (5 - path.width) * halfCell;
        node.y = r * oneCell + (5 - path.height) * halfCell;

        if (node.partOfPath) {
          // Only process nodes that are part of the path (grass, water hazzards, and sand hazzards)

          // //console.log(`r=${r} c=${c}  bitMask=${node.bitMask}`);

          // Calculate where the node will be drawn on the background canvas
          (x = node.x), //;(c * oneCell) + ((5 - path.width) * halfCell),
            (y = node.y);
          r * oneCell + (5 - path.height) * halfCell;

          if (node.extra) {
            // Extra nodes are where hazzards are generated. ALL extra nodes shall contain a hazzard

            // hazzards have a 50% chance to be either water or sand hazzards

            if (random() < 0.5) {
              //
              // Create a water hazzard and fill the background at its coordinates with the correct colored grid to represent water
              //

              generateHazzard(WATER_HAZZARD, "48c", "69c");
            } else {
              //
              // Create a sand hazzard and fill the background at its coordinates with the correct colored grid to represent sand
              //

              generateHazzard(S_H, "a95", "ba6");
            }
          } else {
            // This node is a grass node

            // Fill the background at this cells coordinates with the correct colored grid to represent grass
            fillNode("595", "6a6");

            if (node.isFirstNode) {
              // The first node is where the ball is spawned

              //
              // Create the ball
              //

              ball = Circle(Vec2(x + halfCell, y + halfCell), 6, 1, 0, 1); // Create the ball object

              ball.inGoal = false;
              // ball.collided = false; // Clear collision flag

              ball.draw = true;

              //console.log(`created ball at r:${r} c:${c}`);
            } else if (node.isLastNode) {
              // The last node is where the goal is spawned

              //
              // Create the goal
              //

              goal.C = Vec2(x + halfCell, y + halfCell); // Set hole position

              // Render the hole
              BG_CTX.beginPath();
              BG_CTX.arc(goal.C.x, goal.C.y, 12, 0, 7);
              setFillStyleBG("6a6");
              BG_CTX.fill();
              BG_CTX.stroke();

              //console.log(`created goal at r:${r} c:${c}`);
            } else {
              // All empty nodes have a chance to contain an obstacle

              if (random() < generatorParameters.chanceToGenerateObstacle) {
                // Should a new obstacle be generated?

                //
                // Generate an obstacle
                //

                if (random() < generatorParameters.chanceToGenerateWindmill) {
                  // Should a windmill be generated?

                  //
                  // Generate a windmill
                  //

                  obstacle = Rectangle(
                    Vec2(x + halfCell, y + halfCell),
                    100,
                    8,
                    0,
                    1,
                    1
                  );

                  random() < 0.5 ? (obstacle.v = 1.5) : (obstacle.v = -1.5); // 50% of windmills will rotate clockwise, the other 50% will rotate anti-clockwise
                  obstacle.isWindmill = true;
                  obstacle.id = id++;
                  obstacle.draw = true;

                  //console.log(`created windmill at r:${r} c:${c}`);
                } else {
                  //
                  // Generate a blocker
                  //

                  obstacle = Rectangle(
                    Vec2(x + halfCell, y + halfCell),
                    25,
                    25,
                    0,
                    1,
                    1
                  ); // Create the blocker physics object
                  rotateShape(obstacle, PI * 0.25);
                  //obstacle.G = PI * .25; // Rotate it 45°
                  obstacle.isBlocker = true;
                  obstacle.draw = true;
                  // random() < .5 ? obstacle.v = 1.5 : obstacle.v = -1.5; // 50% of windmills will rotate clockwise, the other 50% will rotate anti-clockwise

                  //console.log(`created blocker at r:${r} c:${c}`);
                } // End "obstacle creation type" decision
              } // End "generate new obstacle" chance check
            } // End "node type" check
          } // End "node part of path" check

          //
          // Hazzards and obstacles have been generated, and the ball and goal have been placed
          //

          setFillStyleBG("232"); // Set the color for drawing walls

          // Generate a physics shape for the current nodes left side, and draw a filled rectangle to represent it visually
          let lineLeft = (l = 0) => {
              Rectangle(
                Vec2(x + l, y + halfCell),
                W_T,
                oneCell + 4,
                0,
                1,
                1
              ); // l
              fillRectBG(x - 2 + l, y - 1, B_T, oneCell + 1);
            },
            // The same, but for the right side
            lineRight = (r = 0) => {
              Rectangle(
                Vec2(x + oneCell + r, y + halfCell - 1),
                W_T,
                oneCell + 2,
                0,
                1,
                1
              ); // r
              fillRectBG(
                x + oneCell + r - 4,
                y - 1,
                B_T,
                oneCell + 1
              );
            },
            // Etc
            lineTop = (t = 0) => {
              Rectangle(
                Vec2(x + halfCell, y + 2 + t),
                oneCell,
                W_T,
                0,
                1,
                1
              ); // t
              fillRectBG(x - 2, y - 2 + t, oneCell, B_T);
            },
            lineBottom = (b = 0) => {
              Rectangle(
                Vec2(x + halfCell, y + oneCell + b + 2),
                oneCell,
                W_T,
                0,
                1,
                1
              ); // b
              fillRectBG(
                x - 2,
                y - 2 + oneCell + b,
                oneCell + 2,
                B_T
              );
            };

          //
          // Create physics shapes for the current node, and draw it to the background canvas
          //

          switch (
            node.bitMask // The nodes `bitMask` determines which shapes get created and how the node is drawn
          ) {
            case 1:
              lineLeft();
              lineRight();

              if (node.extra) {
                // Is this node an extra node?

                //
                // Fix rendered output for hazzards, which are only half the width or height (depending on their orientation) of a normal node.. by clearing the appropriate area and drawing a new wall line
                //

                // Fix bottom
                clearRectBG(x - 2, y + halfCell, oneCell + 4, halfCell + 1); // Clear canvas area
                lineBottom(-halfCell); // Draw an adjusted line and create the associated physics shape
              } else {
                // No.. this is just a normal node

                lineBottom(); // Draw a non adjusted line and create the associated physics shape
              }
              break;

            case 2:
              lineBottom();
              lineTop();

              if (node.extra) {
                // Fix left
                clearRectBG(x - 2, y - 2, halfCell + 2, oneCell + 4);
                lineLeft(halfCell);
              } else {
                lineLeft();
              }
              break;

            case 3:
              lineLeft();
              lineBottom();
              break;

            case 4:
              lineLeft();
              lineRight();

              if (node.extra) {
                // Fix top
                clearRectBG(x - 2, y - 1, oneCell + 4, halfCell);
                lineTop(halfCell);
              } else {
                lineTop();
              }
              break;

            case 5:
              lineLeft();
              lineRight();
              break;

            case 6:
              lineLeft();
              lineTop();
              break;

            case 7:
              lineLeft();
              break;

            case 8:
              lineTop();
              lineBottom();

              if (node.extra) {
                // Fix right
                clearRectBG(x + halfCell, y - 2, halfCell, oneCell + 4);
                lineRight(-halfCell);
              } else {
                lineRight();
              }
              break;

            case 9:
              lineRight();
              lineBottom();
              break;

            case 10:
              lineTop();
              lineBottom();
              break;

            case 11:
              lineBottom();
              break;

            case 12:
              lineTop();
              lineRight();
              break;

            case 13:
              lineRight();
              break;

            case 14:
              lineTop();
              break;

            // case 15:
            default:
              break;
          }
        } // End "is node part of path" check
      } // End column loop
    } // End row loop
  },
  // #endregion

  // Reposition canvas and HUD elements
  repositionContent = () => {
    // Set the given elements style properties to update its position inside the browser window
    let reposition = (e, x, y) => {
        e.style.left = `${x}px`;
        e.style.top = `${y}px`;
      },
      x1 = W.innerWidth / 2 - canvasWidth / 2,
      y1 = W.innerHeight / 2 - canvasHeight / 2,
      x2 = x1 - 210,
      x3 = x1 + canvasWidth,
      y3 = y1 + canvasHeight - 80;

    reposition(BG_CANVAS, x1, y1);
    reposition(OBJ_CANVAS, x1, y1);
    reposition(getByID("hd"), x2, y1);
    reposition(getByID("pd"), x3, y1);
    reposition(getByID("td"), x2, y3);
    reposition(getByID("ad"), x3, y3);
  },
  // Update HUD elements
  updateHUD = () => {
    setTextByID("ht", gameState.hole);
    setTextByID("pt", gameState.putts);
    setTextByID("tt", gameState.total);

    setTextByID("at", floor(gameState.total / gameState.hole));
  },
  // Update statistic page
  updateStatPage = () => {
    updatePlayTime();

    setTextByID("s1", `Holes in one: ${gameState.holesInOne}`);
    setTextByID("s2", `Holes in two: ${gameState.holesInTwo}`);
    setTextByID("s3", `Holes in three: ${gameState.holesInThree}`);

    setTextByID("s4", `Close calls: ${gameState.closeCalls}`);

    setTextByID("s5", `Bumps: ${gameState.bumps}`);
    setTextByID("s6", `Flips: ${gameState.flips}`);
    setTextByID("s7", `Rebounds: ${gameState.rebounds}`);

    setTextByID("s8", `Sand shots: ${gameState.beached}`);
    setTextByID("s9", `Water shots:  ${gameState.splashes}`);
  },
  loadGameState = () => {
    tempVar = STORAGE.getItem(SAVEFILE_NAME); // Attempt to load a previously saved game state

    if (!tempVar) {
      // Did the load fail?

      // No data was loaded.. create a new game state

      gameState = {
        seed: 11091968, // Random seed
        ball: null, // The ball
        windmills: null,
        hole: 1, // Current hole
        putts: 0, // Number of putts this hole
        total: 0, // Total number of putts
        beached: 0, // How many times the player ended up in a sand hazzard
        splashes: 0, // How many times the player ended up in a water hazzard
        holesInOne: 0, // How many times the ball landed in the goal in one shot
        holesInTwo: 0, // In two shots
        holesInThree: 0, // And three shots
        closeCalls: 0, // How many times the ball stopped really close to the hole
        bumps: 0, // The ball has hit a blocker this many times
        flips: 0, // The ball has hit a windmill this many times
        rebounds: 0, // The ball has hit a wall this many times
        playTime: 0,
        mode: 0,
      };

      rng.setSeed(gameState.seed); // Set the random seed

      // //console.log(`game state created`);

      showElement(title, true); // Show title screen (on first run)

      return false;
    } else {
      // The load succeeded

      // Yes.. use the loaded game state

      gameState = JSON.parse(tempVar); // get the object from the saved data

      rng.setSeed(gameState.seed); // Set the random seed

      // //console.log(`game state loaded`);

      switch (gameState.mode) {
        case MODE_TITLE:
          showElement(title, true);
          setMode(MODE_TITLE);
          break;

        case MODE_INSTRUCTIONS:
          showElement(iS, true);
          setMode(MODE_INSTRUCTIONS);
          break;

        default: // for all other modes, generate the hole and start the game
          generateHole(); // Generate the hole

          // //console.log('restoring game state');

          // Get the windmill with the given id
          let getWindmillByID = (id) => {
            for (let i = 0; i < objects.length; i++) {
              // Check all objects
              obstacle = objects[i];
              if (obstacle.isWindmill && obstacle.id === id) return obstacle; // Return the windmill with the given id
            }
          };

          if (gameState.windmills) {
            // Does the game state contain any saved windmills
            for (let i = 0; i < gameState.windmills.length; i++) {
              // Restore all windmills
              tempVar = gameState.windmills[i]; // Next saved data
              obstacle = getWindmillByID(tempVar.id); // Next windmill

              obstacle.v = tempVar.v; // Rotation speed
              rotateShape(obstacle, tempVar.G); // Rotate to previous angle
            } // End "restore windmills" loop
          } // End "`gameState.windmills` exists" test

          if (gameState.ball) {
            // Does the game state contain a ball?

            objects.splice(objects.indexOf(ball), 1); // Remove the ball that was created during hole generation

            ball = gameState.ball; // Overwrite with the saved ball
            objects.push(ball); // Add the saved ball to the physics objects array

            // //console.log('BALL:');
            // //console.log(ball);

            if (ball.inGoal) {
              // Did the player leave the page when the ball was in the hole?

              // //console.log('gamestate thinks ball is in goal');

              ball.V = Vec2(0, 0); // Stop the ball

              setOpacity(0); // Essentially make the entire document contents invisible
              setMode(M_N);

              nextHole(); // Advance to the next hole
            } else {
              setOpacity(1); // Make the entire document contents visible
              setMode(MODE_PLAY); // Set mode
            } // End "ball in goal" check
          } // End "`gameState.ball` exists" test

          updateHUD();
          showElement(hudScreen, true); // Show HUD

          putterEnabled = true;

          break;
      }
    } // End "game state load failed" check
  },
  // Save the game state
  saveGameState = () => {
    if (objects.length > 0) {
      // Are there any objects to possibly save?

      tempVar = [];

      for (let i = 0; i < objects.length; i++) {
        // Check all objects

        obstacle = objects[i]; // Next object

        if (obstacle.isWindmill) {
          // Is this obstacle a windmill?

          tempVar.push({
            // Add the relevant data to the array
            id: obstacle.id, // ID
            v: obstacle.v, // Rotation velocity
            G: obstacle.G, // Rotation
          });
        } // End "is windmill" check
      } // End "check all objects" loop

      gameState.windmills = tempVar;
    } // End "objects might need saving" check

    gameState.ball = ball; // This is qicker and less code than extracting and storing ONLY the required variables

    gameState.mode = gameMode; // Save to resolve issue where player presses F5 whilst in menus and the putter is not enabled
    gameState.playTime += (Date.now() - launchTime) / 1000;

    // STORAGE.removeItem(SAVEFILE_NAME);

    STORAGE.setItem(SAVEFILE_NAME, JSON.stringify(gameState));
  };

//#region -- Putter management (aiming, putting, rendering)

// Erase the area where the putter was, in preperation to draw it in its new position/orientation
(erasePutter = () => {
  if (mouseMovePosition) {
    /*
    Swapping the coordinates around is a bit  convoluted but required so that the rectangular area 
    to be cleared can be expanded on all sides by an arbitrary number of pixels, which is required 
    for the entire area of the putter to be cleared correctly.

    TODO: Research a more efficient method to acomplish the clear.

    FG_CTX.clearRect(0, 0, FG_CANVAS.width, FG_CANVAS.height);

    */

    let x = clamp(mouseMovePosition.x, 0, W.innerWidth), // Calculate top left corner of rectangular area to clear
      w = mouseDownPosition.x - x,
      y = clamp(mouseMovePosition.y, 0, W.innerHeight), // Calculate bottom right corner of rectangular area to clear
      h = mouseDownPosition.y;
    -y;

    if (mouseDownPosition.x < mouseMovePosition.x) {
      // Recalculate top left if required
      x = mouseDownPosition.x;
      w = mouseMovePosition.x - x;
    }

    if (mouseDownPosition.y < mouseMovePosition.y) {
      // Recalculate bottom right if required
      y = mouseDownPosition.y;
      h = mouseMovePosition.y - y;
    }

    FG_CTX.clearRect(x - 8, y - 8, w + 16, h + 16); // Clear the rectangle (expanded by 3 pixels on each edge)

    // //console.log(`erasePutter() x=${x} y=${y} w=${w} h=${h}`);
  }
}),
  //Reset the putter
  (resetPutter = () => {
    erasePutter(); // Erase the putter graphic

    mouseMovePosition = null; // Clear all positioning variables so no putter is drawn
    mouseDownPosition = null;

    putterLength = 0; // Set to 0 to stop phantom putts
  });

// Save the position of the `mousedown` event (when the left mouse button was pressed down)
D.onmousedown = (e) => {
  if (putterEnabled && e.button === 0 && gameMode === MODE_PLAY) {
    if (length(ball.V) === 0) mouseDownPosition = Vec2(e.x, e.y); // Create the mouse down coordinates ONLY if the ball is also not moving
  }
};

// Update the putter according to mouse movement, when the left mouse button is held down
D.onmousemove = (e) => {
  if (mouseDownPosition && putterEnabled && gameMode === MODE_PLAY) {
    // Only proceed if the left mouse button is held down

    erasePutter();

    let sx = mouseDownPosition.x, // Cache coordinates
      sy = mouseDownPosition.y,
      x = e.x,
      y = e.y;

    puttAngle = atan2(sy - y, sx - x); // Get direction that the ball will move in IF a putt is initiated

    let pa = atan2(y - sy, x - sx); // Get direction that the putter is facing

    let b = PI * 0.25, // 45 degree angle in radians
      c = b * 2, // 90 degree angle in radians
      x1 = cos(pa - b) * 8, // Generate pointy end coordinates
      y1 = sin(pa - b) * 8,
      x2 = cos(pa + b) * 8,
      y2 = sin(pa + b) * 8,
      x3 = cos(pa - c) * 6, // Generate flat end coordinates
      y3 = sin(pa - c) * 6,
      x4 = cos(pa + c) * 6,
      y4 = sin(pa + c) * 6;

    (putterLength = distance(mouseDownPosition, { x, y })), // Get the distance between the `mousedown` and `mouseup` events
      // Set putter color according to it's length
      (putterColor = "fff");

    if (putterLength > M_P_L) putterLength = M_P_L; // Constrain length

    x = cos(pa) * putterLength + sx; // Generate constrained end of shaft coordinates
    y = sin(pa) * putterLength + sy;

    mouseMovePosition = { x, y }; // Save for later calculations and checks

    FG_CTX.strokeStyle = "#fff"; // Putter color
    FG_CTX.lineWidth = 3; // Thickness

    FG_CTX.beginPath(); // Begin the path that defines the putter (in lines)

    let moveToFG = (x, y) => {
        FG_CTX.moveTo(x, y);
      },
      lineToFG = (x, y) => {
        FG_CTX.lineTo(x, y);
      };

    moveToFG(x1 + sx, y1 + sy); // Pointy end
    lineToFG(sx, sy);
    lineToFG(x2 + sx, y2 + sy);

    moveToFG(sx, sy); // Shaft
    lineToFG(x, y);

    moveToFG(x3 + x, y3 + y); // Flat end
    lineToFG(x4 + x, y4 + y);

    FG_CTX.stroke(); // Draw the putter
  }
};

// Initiate a new putt if the putter is enabled, the left mouse was released, and `mouseDownPosition` exists
D.onmouseup = (e) => {
  if (
    putterEnabled &&
    e.button === 0 &&
    mouseDownPosition &&
    gameMode === MODE_PLAY
  ) {
    erasePutter();

    mouseMovePosition = null;
    mouseDownPosition = null;

    if (putterLength >= MIN_PUTTER_LENGTH) {
      // Is the putter at least the minimum length?

      // Yes.. initiate a new putt

      putterEnabled = false; // Prevent putter aiming

      ballResetPosition = ball.C; // Save position for edge cases where the ball escapes the confines of the hole

      let puttMagnitude = putterLength / M_P_L; // Get magnitude (0-1)

      ball.V = Vec2(
        cos(puttAngle) * (puttMagnitude * M_B_S),
        sin(puttAngle) * (puttMagnitude * M_B_S)
      ); // Set the balls velocity

      putterLength = 0; // Set to 0 to stop phantom putts

      gameState.putts++;

      gameState.total++;

      updateHUD();
    } // End "putter length ok" check
  } // End "putter enabled, and mousedown and up exist" check
};

// Manage key up events
D.onkeyup = (e) => {
  // //console.log(e);

  if (gameMode === MODE_PLAY) {
    switch (e.keyCode) {
      case 32: // SPACE key released?
        resetPutter();

        e.preventDefault();
        break;

      case 16: // SHIFT key released?
        showElement(stats, false); // Hide the stats screen
        statsVisible = false;
        e.preventDefault();
        break;

      case 8: // BACKSPACE key released?
        resetPutter();
        putterEnabled = false;
        showElement(rS, true);
        e.preventDefault();
        break;

      case 192: // TILDE key released?
        resetPutter();
        showElement(iS, true);
        instructionsVisible = true;
        dontResetOnInstructionsClosed = true;
        e.preventDefault();
        break;

      default:
        break;
    } // End "keycode switch"
  } // End "MODE_PLAY" check
};

// Manage key down events
D.onkeydown = (e) => {
  // //console.log(e);

  if (e.keyCode === 16 && gameMode === MODE_PLAY && !statsVisible) {
    // was the SHIFT key pressed?

    updateStatPage();

    showElement(stats, true);

    secondCounter = 0; // Reset counter for live elapsed play time
    statsVisible = true;

    e.preventDefault();
  }
};

//#endregion

W.onresize = repositionContent; // Reposition content whenever the browser window is resized

W.onbeforeunload = saveGameState; // Save the game state whenever the page is closed

// When the page is loaded, execute this code, which actually starts the ball rolling (pun fully intended)
W.onload = () => {
  //
  // Get various screens
  //

  stats = getByID("ss");
  title = getByID("ts");
  titleButtons = getByID("tsb");
  hudScreen = getByID("hud");
  rS = getByID("rs");
  rSButtons = getByID("rsb");
  iS = getByID("is");
  iSButtons = getByID("isb");

  //
  // Create menu buttons
  //

  titleButtons.appendChild(
    newButton("OK", () => {
      // Close title screen button
      showElement(title, false); // Hide title screen
      setMode(MODE_INSTRUCTIONS); // Set mode
      showElement(iS, true); // Show instruction screen
    })
  );

  iSButtons.appendChild(
    newButton("OK", () => {
      // Close instructions screen button
      showElement(iS, false); // Hide instruction screen

      instructionsVisible = false;

      if (!dontResetOnInstructionsClosed) {
        // Should the game generate a hole when the instructions screen is closed?
        setOpacity(0); // Essentially make the entire document contents invisible

        generateHole(); // Generate the current hole

        showElement(hudScreen, true); // Show HUD

        fadeInOutCounter = 0;
        setMode(MODE_FADE_IN); // Set mode
      } // End "generate on instructions closed" check
    })
  );

  rSButtons.appendChild(
    newButton("YES", () => {
      // Confirm reset button
      showElement(rS, false);
      W.onbeforeunload = null; // Stop the gamestate being saved, which would cause the game to not fully reset
      STORAGE.removeItem(SAVEFILE_NAME); // Remove the local data
      location.reload(); // Reload!
    })
  );

  rSButtons.appendChild(
    newButton("NO", () => {
      // Cancel reset button
      showElement(rS, false);
      putterEnabled = true;
    })
  );

  //
  // Create HTML canvasses and attach them to the document body
  //

  // Background (the hole) will be drawn on this canvas
  BG_CANVAS = newCanvas(canvasWidth, canvasHeight, "bg"); // Create a new canvas
  BG_CTX = BG_CANVAS.ctx; // Get drawing context

  // Windmills, Ball, and particles will be drawn on this canvas
  OBJ_CANVAS = newCanvas(canvasWidth, canvasHeight, "bg");
  OBJ_CTX = OBJ_CANVAS.ctx;

  // Putter will be drawn on this canvas
  FG_CANVAS = newCanvas(W.innerWidth, W.innerHeight, "fg");
  FG_CTX = FG_CANVAS.ctx;

  loadGameState();

  // //console.log('GAMESTATE:')
  // //console.log(gameState);

  repositionContent(); // Perform initial rescale

  lastFrame = Date.now(); // Set the (fake) last EnterFrame event time
  onEnterFrame(); // Request the first actual EnterFrame event
};

// Check and resolve collisions between the ball and hazzards ()
let checkResolveHazzardCollisions = () => {
    let ballResetX = ball.C.x;
    ballResetY = ball.C.y;

    // if (!ball.inGoal) { // Ball not currently in goal?

    for (let i = 0; i < hazzards.length; i++) {
      const hazzard = hazzards[i]; // Next hazzard

      // //console.log(hazzard);

      if (
        ballResetX > hazzard.x &&
        ballResetX < hazzard.x + oneCell &&
        ballResetY > hazzard.y &&
        ballResetY < hazzard.y + oneCell
      ) {
        // Check if the ball has entered the hazzard

        // The ball has entered a hazzard. Determine which type of hazzard the ball has entered and resolve accordingly

        if (hazzard.type === S_H) {
          // Is it a sand hazzard?
          if (!ball.inSand) {
            gameState.beached++; // Increment number of times the ball ended up in a sand hazzard
          }

          ball.inSand = true; // The ball is currently inside a sand hazzard

          // if (!ball.inSand) { // Ball currently not in sand?

          //   ball.inSand = true; // The ball is in a sand hazzard

          //   gameState.beached ++; // Increment number of times the ball ended up in a sand hazzard

          // } // End "ball not in sand" check

          friction = 0.75; // Set a higher friction so the ball moves really slow in sand
        } else {
          // It must be a water hazzard

          // Calaulate the balls position to place it outside the water hazzard

          switch (
            hazzard.bitMask // Proceed according to which type of node the ball entered?
          ) {
            case 1:
              ballResetX = hazzard.x + halfCell; // Calculate position where ball will be placed outside of the water hazzard
              ballResetY = hazzard.y - 8;
              break;

            case 2:
              ballResetX = hazzard.x + oneCell + 8;
              ballResetY = hazzard.y + halfCell;
              break;

            case 4:
              ballResetX = hazzard.x + halfCell;
              ballResetY = hazzard.y + oneCell + 8;
              break;

            default: // Otherwise it can only be 8
              ballResetX = hazzard.x - 8;
              ballResetY = hazzard.y + halfCell;
              break;
          } // End "`hazzard.bitMask` switch"

          ball.C = Vec2(ballResetX, ballResetY); // Reposition ball outside water hazzard
          ball.V = Vec2(0, 0); // Set velocity

          putterEnabled = true;

          gameState.splashes++; // Increment number of times the ball ended up in a water hazzard
          statUpdateRequired = true;
        } // End "which type of hazzard ball is in" check
      } else {
        ball.inSand = ballInSand;
      } // End "ball in water hazzard" check

      // } // End "ball vs hazzard check" loop
    } // End "balll not in goal" check
  },
  secondsToHMS = (s) =>
    `${floor(s / 3600)}h, ${floor((s % 3600) / 60)}m, ${floor(
      (s % 3600) % 60
    )}s`,
  updatePlayTime = () =>
    setTextByID(
      "s0",
      `Play time: ${secondsToHMS(
        gameState.playTime + (Date.now() - launchTime) / 1000
      )}`
    ),
  //
  // The main game logic loop
  //

  onEnterFrame = () => {
    statUpdateRequired = false; // No update required

    //
    // Calculate the time elapsed (in seconds) since the last EnterFrame event
    //

    thisFrame = Date.now();
    DT = (thisFrame - lastFrame) / 1000;
    lastFrame = thisFrame;

    if (statsVisible) {
      // Is the statistics page visible?
      secondCounter += DT; // Count up to one second
      if (secondCounter >= 1) {
        secondCounter -= 1; // Decrement by one second
        updatePlayTime(); // Update the pages play time readout in real-time
      }
    } // End "statistics page visible?" check

    //
    // Move all objects (including the ball)
    //

    for (i = objects.length; i--; ) {
      // Draw all objects

      let o = objects[i]; // Next object to update

      // Update object position
      o.V = add(o.V, scale(o.A, DT));
      moveShape(o, scale(o.V, DT));

      // Update object rotation
      o.v += o.a * DT;
      rotateShape(o, o.v * DT);
    }

    //
    // Check for, and resolve collisions between the ball and other objects
    //

    checkResolveObjectCollisions();

    //
    // Collisions between the ball and all physics objects have been detected and resolved
    //

    //
    // Application logic proceeds now according to `gameMode`
    //

    switch (gameMode) {
      //
      // When `gameMode` is `MODE_PLAY`, the player is aiming and making putts and the ball is interacting with various game elements
      //

      case MODE_PLAY:
        //
        // Begin with a sanity check because sometimes, somehow, the ball escapes the confines of the hole.
        //

        let ballX = ball.C.x,
          ballY = ball.C.y,
          fixBall = false; // Nofix required

        if (
          ballX > 0 ||
          ballX < canvasWidth ||
          ballY > 0 ||
          ballY < canvasHeight
        ) {
          // Ball's position is inside the canvas?

          nodes = path.pathNodes; // Get nodes
          node = nodes[0][0]; // Get first node

          // //console.log(`${floor((ballY - node.y) / oneCell)}, ${floor((ballX - node.x) / oneCell)}`);

          let node2 =
            nodes[floor((ballY - node.y) / oneCell)][
              floor((ballX - node.x) / oneCell)
            ];
          if (!node2.partOfPath) {
            fixBall = true; // Fix required!
            //console.log('ball escaped confines of hole')
          }
        } else {
          // Whoops, somehow the ball escaped!

          fixBall = true; // Fix required!
          //console.log('ball entirely left the canvas!');
        } // End "ball inside canvas" check

        if (fixBall) {
          // Does the ball's position require fixing?

          // Fix the ball's position
          ball.C = ballResetPosition; // Reset the ball's position to the last putt position
          ball.V = Vec2(0, 0); // Stop the ball

          gameState.putts--; // Decrement putts for this hole
          statUpdateRequired = true;

          putterEnabled = true; // Allow the player to putt again
        } // End "fix required" check

        let ballSpeed = length(ball.V); // Get the current speed the ball is moving at

        if (ballSpeed > 0) {
          //
          // The ball IS moving
          //

          friction = 0.985; // Default ground friction

          checkResolveHazzardCollisions();

          ball.V = scale(ball.V, friction); // Apply friction to the ball, causing it to slow down over time

          let distanceToGoal = distance(ball.C, goal.C); // Get the distance between the ball and the goal

          if (ballSpeed < 10) {
            // Is the ball moving so slowly that the player cannot perceive it?

            ball.V = Vec2(0, 0); // Stop the ball

            if (ball.inGoal) {
              // Did the ball come to rest inside the goal?

              fadeInOutCounter = 1; // Set fade counter so it counts down from 1 to 0
              setMode(MODE_FADE_OUT); // Begin scene fading out
            } else {
              // The ball came to rest, but not inside the goal

              // nodes = path.pathNodes; // Get nodes
              // node = nodes[0][0]; // Get first node
              //if (!nodes[floor((ball.C.y - node.y) / oneCell)][floor((ball.C.x - node.x) / oneCell)].extra) ball.inSand = false; // Fix edge case where browser refresh button is held when exiting a sand trap

              if (distanceToGoal < 25) {
                // Did the ball come to rest really close to the goal?

                gameState.closeCalls++;
                statUpdateRequired = true;
              } // End "ball very close to goal"

              putterEnabled = true; // Allow the player to putt again
            } // End "did the ball came to rest inside goal" check
          } // End "ball moving really slowly" test

          if (!ball.inGoal && distanceToGoal <= HOLE_RADIUS) {
            // Is the ball's center inside the goal?

            ball.V = scale(ball.V, 0.5); // Slow the ball down to "hopefully" prevent it escaping the goal, as it likes to do from time to time

            let x = goal.C.x,
              y = goal.C.y;

            // Constrain the ball to the goals area
            Rectangle(Vec2(x - 20, y), 16, 40, 0, 1, 1); // l
            Rectangle(Vec2(x + 20, y), 16, 40, 0, 1, 1); // r
            Rectangle(Vec2(x, y - 20), 40, 16, 0, 1, 1); // t
            Rectangle(Vec2(x, y + 20), 40, 16, 0, 1, 1); // b

            if (gameState.putts === 1) {
              // Did the player score a "hole in one"?

              gameState.holesInOne++; // Increment number of times the player got a hole in one
              statUpdateRequired = true;
            } else {
              // No hole in one

              if (gameState.putts == 2) {
                // Was the hole completed in 2 putts?

                gameState.holesInTwo++;
                statUpdateRequired = true;
              } else if (gameState.putts == 3) {
                // Was the hole completed in 3 putts?

                gameState.holesInThree++;
                statUpdateRequired = true;
              }
            } // End "hole in one" test

            //console.log('The ball is in the goal');

            ball.inGoal = true; // The ball is officially in the hole

            putterEnabled = false; // Disable any new putts being made
          } else if (ball.inGoal && distanceToGoal > 25) {
            // Perform a sanity check

            //
            // WTTF?! The ball is in the goal, but somehow outside it at the same time.
            //

            ball.C = goal.C; // Dirty kludge

            //console.log('ball is in goal, but outside goal at the same time. fixed');
          } // End "ball's center inside goal" check
        } // End "ball moving" check

        break; // End "MODE_PLAY" case

      //
      // When `gameMode` is `MODE_FADE_OUT`, the entire html document is fading OUT to become invisible
      //

      case MODE_FADE_OUT:
        fadeInOutCounter -= DT; // Countdown to 0
        if (fadeInOutCounter <= 0) {
          // Fade out completed?
          fadeInOutCounter = 0; // Set for completely invisible

          setMode(M_N);

          nextHole(); // Generate the next hole
        } // End "fade completed" check

        setOpacity(fadeInOutCounter); // Set the opacity of the documents contents

        break; // End "MODE_FADE_OUT" case

      //
      // When `gameMode` is `MODE_FADE_IN`, the entire html document is fading IN to become visible
      //

      case MODE_FADE_IN:
        fadeInOutCounter += DT; // Increment couter

        if (fadeInOutCounter >= 1) {
          // Fade in complete?
          fadeInOutCounter = 1; // Fix to maximum

          setMode(MODE_PLAY); // Set the mode as playing

          putterEnabled = true; // Allow the payer to putt the ball
        } // End "fade complete" check

        setOpacity(fadeInOutCounter); // Set the opacity of the documents contents

        break; // End "MODE_FADE_IN" case

      default: // M_N
        break;
    } // End "`gameMode` switch"

    //
    // The remaining code is executed no matter what `gameMode` contains
    //

    //
    // Draw / update scene to reflect changes since last `onEnterFrame` event
    //

    OBJ_CTX.clearRect(0, 0, canvasWidth, canvasHeight); // Clear the object canvas

    OBJ_CTX.strokeStyle = "#222"; // All objects are drawn with this outline color
    OBJ_CTX.lineJoin = "bevel"; // Bevel lines just for the heck of it

    for (i = objects.length; i--; ) {
      // Draw all objects

      let o = objects[i]; // Next object to update

      if (o.draw) {
        // If the objects mass is greater than 0 then it is mobile, and should be rendered

        OBJ_CTX.save(); // Save context state
        OBJ_CTX.translate(o.C.x, o.C.y); // Move context cursor to object x,y
        OBJ_CTX.rotate(o.G); // Rotate the context to enable drawing of rotated shapes

        if (o.T) {
          // Is it a rectangle?

          OBJ_CTX.fillStyle = "#aaa"; // Set color
          OBJ_CTX.strokeRect(-o.W / 2, -o.H / 2, o.W, o.H); // Outline
          OBJ_CTX.fillRect(-o.W / 2, -o.H / 2, o.W, o.H); // Fill
        } else {
          // It must be a circle

          OBJ_CTX.fillStyle = "#eee";
          OBJ_CTX.beginPath();
          OBJ_CTX.arc(0, 0, o.B, 0, 7);
          OBJ_CTX.fill();
          OBJ_CTX.stroke();
        }

        OBJ_CTX.restore(); // Restore the context state for the next object
      } // End "object draw" check
    } // End "object draw" loop

    if (statUpdateRequired) {
      // Did any of the players statistics change this frame?
      updateStatPage(); // Update in real-time
    } // End "statistic update required" check

    requestAnimationFrame(onEnterFrame); // Request next animation frame event
  };
