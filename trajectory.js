const canvas = document.getElementById('trajectory-canvas');
const context = canvas.getContext('2d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollStage = document.querySelector('.space-hero');
const trajectoryHeading = document.querySelector('.trajectory-heading');
const modelContextNote = document.querySelector('.model-context-note');
const modelDetails = document.querySelector('.model-details');
const parameterPanel = document.querySelector('.parameter-panel');
const modelMeta = document.querySelector('.model-meta');
const planeFocusTrigger = document.querySelector('.plane-focus-trigger');
const planeFocusBack = document.querySelector('.orbital-plane-back');
const planeFocusCopy = document.querySelector('.orbital-plane-copy');
const radiusFocusTrigger = document.querySelector('.radius-focus-trigger');
const radiusFocusBack = document.querySelector('.radius-focus-back');
const radiusFocusCopy = document.querySelector('.radius-focus-copy');
const orbitCountTrigger = document.querySelector('.orbit-count-trigger');
const apsisFocusTrigger = document.querySelector('.apsis-focus-trigger');
const apsisFocusBack = document.querySelector('.apsis-focus-back');
const apsisFocusCopy = document.querySelector('.apsis-focus-copy');
const viewTriggers = [planeFocusTrigger, radiusFocusTrigger, orbitCountTrigger, apsisFocusTrigger];

const EARTH_ORBIT_ECCENTRICITY = 0.01671123;
const EARTH_ORBIT_MINOR_RATIO = Math.sqrt(1 - EARTH_ORBIT_ECCENTRICITY ** 2);
const EARTH_ORBIT_TILT = 29.7 * Math.PI / 180;
const EARTH_ORBIT_TILT_SIN = Math.sin(EARTH_ORBIT_TILT);
const EARTH_ORBIT_TILT_COS = Math.cos(EARTH_ORBIT_TILT);

let width = 0;
let height = 0;
let pixelRatio = 1;
let stars = [];
let startTime = performance.now();
let lastRenderTime = startTime;
let scrollFrameRequested = false;
let sceneProgress = 0;
let orbitTheta = Math.PI * 1.72;
let planeFocusProgress = 0;
let planeFocusTarget = 0;
let planeViewRotation = 0;
let planeEarthStartAngle = 0;
let planeEarthTargetAngle = -60.3 * Math.PI / 180;
let planeFocusReady = false;
let radiusFocusProgress = 0;
let radiusFocusTarget = 0;
let radiusFocusReady = false;
let apsisFocusProgress = 0;
let apsisFocusTarget = 0;
let apsisFocusReady = false;
let orbitCountSequenceActive = false;
let orbitCountSequenceStart = 0;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function projectVector(
  x,
  y,
  z,
  viewRotation,
  planeCompression,
  verticalProjection,
  apsisViewTheta = 0,
  apsisCameraProgress = 0,
) {
  const rotatedX = x * Math.cos(viewRotation) - y * Math.sin(viewRotation);
  const rotatedY = x * Math.sin(viewRotation) + y * Math.cos(viewRotation);
  const baseX = rotatedX;
  const baseY = rotatedY * planeCompression - z * verticalProjection;

  const faceOnX = x * Math.cos(apsisViewTheta) + y * Math.sin(apsisViewTheta);
  const faceOnY = -x * EARTH_ORBIT_TILT_SIN * Math.sin(apsisViewTheta)
    + y * EARTH_ORBIT_TILT_SIN * Math.cos(apsisViewTheta)
    - z * EARTH_ORBIT_TILT_COS;

  return {
    x: baseX + (faceOnX - baseX) * apsisCameraProgress,
    y: baseY + (faceOnY - baseY) * apsisCameraProgress,
  };
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  width = Math.max(1, bounds.width);
  height = Math.max(1, bounds.height);
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const starCount = Math.round((width * height) / 6800);
  stars = Array.from({ length: starCount }, (_, index) => ({
    x: seededRandom(index + 4) * width,
    y: seededRandom(index + 91) * height,
    radius: 0.35 + seededRandom(index + 217) * 1.15,
    opacity: 0.2 + seededRandom(index + 403) * 0.68,
    phase: seededRandom(index + 701) * Math.PI * 2,
  }));
}

function projectPoint(
  theta,
  phase,
  centerX,
  centerY,
  scale,
  viewRotation = 0,
  planeCompression = 0.34,
  verticalProjection = 0.78,
  apsisViewTheta = 0,
  apsisCameraProgress = 0,
) {
  const radius = scale * 0.36;
  const earthRadius = scale * 0.027;
  const tiltShift = earthRadius * 0.5;
  const verticalStretch = earthRadius * 0.87;
  const drift = scale * 0.09;

  const x = (radius + earthRadius * Math.cos(phase)) * Math.cos(theta)
    + tiltShift * Math.sin(phase) * Math.sin(theta);
  const y = (radius + earthRadius * Math.cos(phase)) * Math.sin(theta)
    - tiltShift * Math.sin(phase) * Math.cos(theta);
  const z = drift * ((theta - Math.PI) / Math.PI) + verticalStretch * Math.sin(phase);

  const projected = projectVector(
    x,
    y,
    z,
    viewRotation,
    planeCompression,
    verticalProjection,
    apsisViewTheta,
    apsisCameraProgress,
  );

  return {
    x: centerX + projected.x,
    y: centerY + projected.y,
  };
}

function projectSun(
  theta,
  centerX,
  centerY,
  scale,
  viewRotation = 0,
  planeCompression = 0.34,
  verticalProjection = 0.78,
  apsisViewTheta = 0,
  apsisCameraProgress = 0,
) {
  const radius = scale * 0.36;
  const drift = scale * 0.09;
  const x = radius * Math.cos(theta);
  const y = radius * Math.sin(theta);
  const z = drift * ((theta - Math.PI) / Math.PI);
  const projected = projectVector(
    x,
    y,
    z,
    viewRotation,
    planeCompression,
    verticalProjection,
    apsisViewTheta,
    apsisCameraProgress,
  );
  return { x: centerX + projected.x, y: centerY + projected.y };
}

function drawStars(time) {
  for (const star of stars) {
    const twinkle = reducedMotion ? 1 : 0.82 + Math.sin(time * 0.0007 + star.phase) * 0.18;
    context.beginPath();
    context.fillStyle = `rgba(247, 249, 255, ${star.opacity * twinkle})`;
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawPath(
  centerX,
  centerY,
  scale,
  headTheta,
  viewRotation = 0,
  planeCompression = 0.34,
  verticalProjection = 0.78,
  apsisViewTheta = 0,
  apsisCameraProgress = 0,
) {
  const segments = 1300;
  const orbitSpan = Math.PI * 2 * 1.2;
  const tailTheta = headTheta - orbitSpan;
  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.miterLimit = 1;
  context.lineWidth = Math.max(0.7, scale / 900);
  context.strokeStyle = 'rgba(121, 174, 247, 0.48)';
  context.beginPath();

  for (let index = 0; index <= segments; index += 1) {
    const theta = tailTheta + (index / segments) * orbitSpan;
    const phase = theta * 28;
    const point = projectPoint(
      theta,
      phase,
      centerX,
      centerY,
      scale,
      viewRotation,
      planeCompression,
      verticalProjection,
      apsisViewTheta,
      apsisCameraProgress,
    );
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  context.stroke();

  context.lineWidth = 0.8;
  context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  context.beginPath();
  for (let index = 0; index <= 260; index += 1) {
    const theta = tailTheta + (index / 260) * orbitSpan;
    const point = projectSun(
      theta,
      centerX,
      centerY,
      scale,
      viewRotation,
      planeCompression,
      verticalProjection,
      apsisViewTheta,
      apsisCameraProgress,
    );
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  context.stroke();
  context.restore();
}

function drawOrbitCountHighlight(
  centerX,
  centerY,
  scale,
  headTheta,
  progress,
  opacity,
  viewRotation = 0,
  planeCompression = 0.34,
  verticalProjection = 0.78,
  apsisViewTheta = 0,
  apsisCameraProgress = 0,
) {
  if (progress <= 0 || opacity <= 0) return;

  const highlightedSpan = Math.PI * 2 * clamp(progress);
  const startTheta = headTheta - highlightedSpan;
  const segments = Math.max(16, Math.round(1080 * clamp(progress)));

  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.miterLimit = 1;
  context.lineWidth = Math.max(1.25, scale / 720);
  context.strokeStyle = `rgba(255,255,255,${opacity})`;
  context.shadowColor = `rgba(255,255,255,${opacity * 0.6})`;
  context.shadowBlur = 6;
  context.beginPath();

  for (let index = 0; index <= segments; index += 1) {
    const theta = startTheta + (index / segments) * highlightedSpan;
    const phase = theta * 28;
    const point = projectPoint(
      theta,
      phase,
      centerX,
      centerY,
      scale,
      viewRotation,
      planeCompression,
      verticalProjection,
      apsisViewTheta,
      apsisCameraProgress,
    );
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  context.stroke();
  context.restore();
}

function drawBody(point, radius, fill, glow) {
  context.save();
  context.shadowColor = glow;
  context.shadowBlur = radius * 3.2;
  context.beginPath();
  context.fillStyle = fill;
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSagittariusTrail(point, scale) {
  const trailLength = scale * 0.22;
  const trailEndY = point.y + trailLength;
  const trailGradient = context.createLinearGradient(point.x, point.y, point.x, trailEndY);
  trailGradient.addColorStop(0, 'rgba(239, 72, 72, 0.38)');
  trailGradient.addColorStop(1, 'rgba(239, 72, 72, 0)');

  context.save();
  context.beginPath();
  context.moveTo(point.x, point.y);
  context.lineTo(point.x, trailEndY);
  context.lineWidth = Math.max(0.4, scale / 2200);
  context.strokeStyle = trailGradient;
  context.stroke();
  context.restore();
}

function drawSagittariusA(point, scale, time) {
  const coreRadius = Math.max(7, scale * 0.009);
  const pulse = reducedMotion ? 1 : 0.92 + Math.sin(time * 0.0012) * 0.08;
  const glow = context.createRadialGradient(
    point.x,
    point.y,
    coreRadius * 0.35,
    point.x,
    point.y,
    coreRadius * 4.2,
  );
  glow.addColorStop(0, 'rgba(255, 244, 211, 0.95)');
  glow.addColorStop(0.18, 'rgba(244, 181, 77, 0.68)');
  glow.addColorStop(0.48, 'rgba(223, 107, 66, 0.2)');
  glow.addColorStop(1, 'rgba(223, 107, 66, 0)');

  context.save();
  context.beginPath();
  context.fillStyle = glow;
  context.arc(point.x, point.y, coreRadius * 4.2 * pulse, 0, Math.PI * 2);
  context.fill();

  context.translate(point.x, point.y);
  context.rotate(-0.18);
  context.scale(1, 0.34);
  context.lineWidth = Math.max(2, coreRadius * 0.34);
  context.strokeStyle = 'rgba(255, 208, 121, 0.9)';
  context.shadowColor = 'rgba(244, 181, 77, 0.9)';
  context.shadowBlur = coreRadius * 1.6;
  context.beginPath();
  context.ellipse(0, 0, coreRadius * 2.35, coreRadius * 1.45, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  drawBody(point, coreRadius, '#02040a', 'rgba(244,181,77,.72)');
}

function drawOrbitalPlane(radiusX, radiusY, rotation, fill, stroke) {
  context.save();
  context.rotate(rotation);
  context.beginPath();
  context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = 1.2;
  context.strokeStyle = stroke;
  context.stroke();
  context.restore();
}

function mixPlaneColor(target, progress, alpha) {
  const channels = target.map((channel) => Math.round(255 + (channel - 255) * progress));
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

function drawHighlightedPlanes(
  galacticCenter,
  sun,
  galacticRadius,
  galacticCompression,
  earthRadius,
  earthPlaneAngle,
  opacity,
  colorProgress,
) {
  const sunPlaneStroke = mixPlaneColor([244, 181, 77], colorProgress, 0.92);
  const sunPlaneFill = mixPlaneColor([244, 181, 77], colorProgress, 0.085);
  const earthPlaneStroke = mixPlaneColor([121, 174, 247], colorProgress, 0.94);
  const earthPlaneFill = mixPlaneColor([121, 174, 247], colorProgress, 0.13);

  context.save();
  context.globalAlpha = opacity;
  context.translate(galacticCenter.x, galacticCenter.y);
  drawOrbitalPlane(
    galacticRadius,
    Math.max(2, galacticRadius * galacticCompression),
    0,
    sunPlaneFill,
    sunPlaneStroke,
  );
  context.restore();

  context.save();
  context.globalAlpha = opacity;
  context.translate(sun.x, sun.y);
  drawOrbitalPlane(
    earthRadius,
    earthRadius * 0.31,
    earthPlaneAngle,
    earthPlaneFill,
    earthPlaneStroke,
  );
  context.restore();
}

function drawPlaneAngleOverlay(
  center,
  radius,
  earthPlaneAngle,
  opacity,
  colorProgress,
) {
  const sunPlaneStroke = mixPlaneColor([244, 181, 77], colorProgress, 0.94);
  const earthPlaneStroke = mixPlaneColor([121, 174, 247], colorProgress, 0.94);

  context.save();
  context.globalAlpha = opacity;
  context.translate(center.x, center.y);
  context.setLineDash([6, 6]);
  context.lineWidth = 1;
  context.strokeStyle = 'rgba(255,255,255,.68)';
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(radius * 0.7, 0);
  context.moveTo(0, 0);
  context.lineTo(radius * 0.7 * Math.cos(earthPlaneAngle), radius * 0.7 * Math.sin(earthPlaneAngle));
  context.stroke();
  context.beginPath();
  context.arc(0, 0, radius * 0.43, earthPlaneAngle, 0);
  context.stroke();

  context.fillStyle = 'rgba(255,255,255,.88)';
  context.font = '700 12px "Space Mono", monospace';
  context.textAlign = 'left';
  context.fillText('60.3°', radius * 0.35, -radius * 0.2);

  context.fillStyle = sunPlaneStroke;
  context.font = '600 10px "DM Sans", sans-serif';
  context.textAlign = 'left';
  context.fillText('SUN ORBITAL PLANE', radius * 0.54, radius * 0.24);
  context.fillStyle = earthPlaneStroke;
  context.fillText('EARTH ORBITAL PLANE', -radius * 0.58, -radius * 0.56);
  context.restore();
}

function drawLabel(point, label, offsetX, offsetY) {
  const targetX = point.x + offsetX;
  const targetY = point.y + offsetY;
  context.strokeStyle = 'rgba(255,255,255,.38)';
  context.lineWidth = 0.7;
  context.beginPath();
  context.moveTo(point.x, point.y);
  context.lineTo(targetX, targetY);
  context.stroke();
  context.fillStyle = 'rgba(255,255,255,.72)';
  context.font = '600 10px "DM Sans", sans-serif';
  context.textAlign = offsetX < 0 ? 'right' : 'left';
  context.fillText(label.toUpperCase(), targetX + (offsetX < 0 ? -6 : 6), targetY + 3);
}

function drawGalacticRadius(center, sun, progress) {
  const endX = center.x + (sun.x - center.x) * progress;
  const endY = center.y + (sun.y - center.y) * progress;
  const midpointX = (center.x + endX) / 2;
  const midpointY = (center.y + endY) / 2;

  context.save();
  context.strokeStyle = 'rgba(255,255,255,.9)';
  context.lineWidth = 1.4;
  context.shadowColor = 'rgba(255,255,255,.45)';
  context.shadowBlur = 8;
  context.beginPath();
  context.moveTo(center.x, center.y);
  context.lineTo(endX, endY);
  context.stroke();
  context.restore();

  if (progress > 0.72) {
    context.fillStyle = `rgba(255,255,255,${clamp((progress - 0.72) / 0.28) * 0.88})`;
    context.font = '700 11px "Space Mono", monospace';
    context.textAlign = 'center';
    context.fillText('R = 2.5 × 10²⁰ m', midpointX, midpointY - 12);
  }
}

function projectApsisOrbitPoint(
  sun,
  theta,
  anomaly,
  scale,
  viewRotation,
  planeCompression,
  verticalProjection,
  apsisViewTheta,
  apsisCameraProgress,
) {
  const majorRadius = scale * 0.027;
  const minorRadius = majorRadius * EARTH_ORBIT_MINOR_RATIO;
  const radialDistance = majorRadius * (Math.cos(anomaly) + EARTH_ORBIT_ECCENTRICITY);
  const tiltedDistance = minorRadius * Math.sin(anomaly);
  const localX = radialDistance * Math.cos(theta)
    + tiltedDistance * EARTH_ORBIT_TILT_SIN * Math.sin(theta);
  const localY = radialDistance * Math.sin(theta)
    - tiltedDistance * EARTH_ORBIT_TILT_SIN * Math.cos(theta);
  const localZ = tiltedDistance * EARTH_ORBIT_TILT_COS;
  const projected = projectVector(
    localX,
    localY,
    localZ,
    viewRotation,
    planeCompression,
    verticalProjection,
    apsisViewTheta,
    apsisCameraProgress,
  );

  return {
    x: sun.x + projected.x,
    y: sun.y + projected.y,
  };
}

function drawApsisFocusOverlay(
  sun,
  theta,
  phase,
  scale,
  viewRotation,
  planeCompression,
  verticalProjection,
  apsisViewTheta,
  apsisCameraProgress,
  cameraAnchor,
  cameraZoom,
  orbitOpacity,
  labelProgress,
) {
  if (orbitOpacity <= 0) return;

  const toScreen = (point) => ({
    x: cameraAnchor.x + (point.x - sun.x) * cameraZoom,
    y: cameraAnchor.y + (point.y - sun.y) * cameraZoom,
  });
  const projectedPoint = (anomaly) => toScreen(projectApsisOrbitPoint(
    sun,
    theta,
    anomaly,
    scale,
    viewRotation,
    planeCompression,
    verticalProjection,
    apsisViewTheta,
    apsisCameraProgress,
  ));

  context.save();
  context.globalAlpha = orbitOpacity;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.lineWidth = 1.4;
  context.strokeStyle = 'rgba(121,174,247,.88)';
  context.shadowColor = 'rgba(121,174,247,.35)';
  context.shadowBlur = 8;
  context.beginPath();
  for (let index = 0; index <= 180; index += 1) {
    const point = projectedPoint((index / 180) * Math.PI * 2);
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  context.stroke();
  context.restore();

  if (labelProgress <= 0) return;

  const periapsis = projectedPoint(Math.PI);
  const apoapsis = projectedPoint(0);
  const earth = projectedPoint(phase);

  context.save();
  context.globalAlpha = labelProgress * 0.68;
  context.setLineDash([5, 6]);
  context.lineWidth = 0.9;
  context.strokeStyle = 'rgba(255,255,255,.58)';
  context.beginPath();
  context.moveTo(cameraAnchor.x, cameraAnchor.y);
  context.lineTo(periapsis.x, periapsis.y);
  context.moveTo(cameraAnchor.x, cameraAnchor.y);
  context.lineTo(apoapsis.x, apoapsis.y);
  context.stroke();
  context.restore();

  context.save();
  context.globalAlpha = labelProgress;
  drawBody(periapsis, 5.5, '#ff7067', 'rgba(255,112,103,.75)');
  drawBody(apoapsis, 5.5, '#79aef7', 'rgba(121,174,247,.75)');
  context.restore();

  context.save();
  context.globalAlpha = labelProgress;
  context.font = '700 10px "DM Sans", sans-serif';
  context.textBaseline = 'middle';
  const compactLabels = width <= 760;
  context.textAlign = compactLabels ? 'left' : 'right';
  context.fillStyle = '#ff7067';
  context.fillText('PERIAPSIS', periapsis.x + (compactLabels ? 12 : -12), periapsis.y - 8);
  context.font = '400 9px "Space Mono", monospace';
  context.fillStyle = 'rgba(255,255,255,.74)';
  context.fillText('1.47098074 × 10¹¹ m', periapsis.x + (compactLabels ? 12 : -12), periapsis.y + 9);

  context.font = '700 10px "DM Sans", sans-serif';
  context.textAlign = compactLabels ? 'right' : 'left';
  context.fillStyle = '#79aef7';
  context.fillText('APOAPSIS', apoapsis.x + (compactLabels ? -12 : 12), apoapsis.y - 8);
  context.font = '400 9px "Space Mono", monospace';
  context.fillStyle = 'rgba(255,255,255,.74)';
  context.fillText('1.52097701 × 10¹¹ m', apoapsis.x + (compactLabels ? -12 : 12), apoapsis.y + 9);

  context.font = '600 10px "DM Sans", sans-serif';
  context.textAlign = 'center';
  context.fillStyle = 'rgba(255,255,255,.72)';
  context.fillText('SUN', cameraAnchor.x, cameraAnchor.y + 27);
  context.fillText('EARTH · CURRENT POSITION', earth.x, earth.y - 18);
  context.restore();
}

function render(time) {
  context.clearRect(0, 0, width, height);
  drawStars(time);

  const frameDuration = Math.min(50, Math.max(0, time - lastRenderTime));
  lastRenderTime = time;
  let orbitHighlightProgress = 0;
  let orbitHighlightOpacity = 0;

  if (orbitCountSequenceActive) {
    const sequenceElapsed = time - orbitCountSequenceStart;
    if (sequenceElapsed < 1000) {
      orbitHighlightProgress = 0;
    } else if (sequenceElapsed < 3000) {
      orbitHighlightProgress = (sequenceElapsed - 1000) / 2000;
      orbitHighlightOpacity = 0.96;
    } else if (sequenceElapsed < 5000) {
      orbitHighlightProgress = 1;
      orbitHighlightOpacity = sequenceElapsed < 3600
        ? 0.58 + Math.abs(Math.sin((sequenceElapsed - 3000) * 0.018)) * 0.42
        : 1;
    } else if (sequenceElapsed < 5300) {
      orbitHighlightProgress = 1;
      orbitHighlightOpacity = 1 - (sequenceElapsed - 5000) / 300;
    } else {
      orbitCountSequenceActive = false;
      viewTriggers.forEach((trigger) => {
        trigger.disabled = false;
      });
    }
  }

  if (reducedMotion) {
    planeFocusProgress = planeFocusTarget;
    radiusFocusProgress = radiusFocusTarget;
    apsisFocusProgress = apsisFocusTarget;
  } else if (planeFocusProgress !== planeFocusTarget) {
    const direction = Math.sign(planeFocusTarget - planeFocusProgress);
    const transitionDuration = planeFocusTarget === 1 ? 1800 : 650;
    planeFocusProgress = clamp(planeFocusProgress + direction * frameDuration / transitionDuration);
    if (Math.abs(planeFocusTarget - planeFocusProgress) < 0.002) {
      planeFocusProgress = planeFocusTarget;
    }
  }
  if (!reducedMotion && radiusFocusProgress !== radiusFocusTarget) {
    const direction = Math.sign(radiusFocusTarget - radiusFocusProgress);
    const transitionDuration = radiusFocusTarget === 1 ? 1400 : 650;
    radiusFocusProgress = clamp(radiusFocusProgress + direction * frameDuration / transitionDuration);
    if (Math.abs(radiusFocusTarget - radiusFocusProgress) < 0.002) {
      radiusFocusProgress = radiusFocusTarget;
    }
  }
  if (!reducedMotion && apsisFocusProgress !== apsisFocusTarget) {
    const direction = Math.sign(apsisFocusTarget - apsisFocusProgress);
    const transitionDuration = apsisFocusTarget === 1 ? 1650 : 650;
    apsisFocusProgress = clamp(apsisFocusProgress + direction * frameDuration / transitionDuration);
    if (Math.abs(apsisFocusTarget - apsisFocusProgress) < 0.002) {
      apsisFocusProgress = apsisFocusTarget;
    }
  }
  if (
    !reducedMotion
    && planeFocusTarget === 0
    && planeFocusProgress === 0
    && radiusFocusTarget === 0
    && radiusFocusProgress === 0
    && apsisFocusTarget === 0
    && apsisFocusProgress === 0
    && !orbitCountSequenceActive
  ) {
    orbitTheta += frameDuration * 0.000025;
  }

  const scale = Math.min(width, height) * (width < 700 ? 0.92 : 1.15);
  const centerX = width * (width <= 760 ? 0.5 : 0.5 + sceneProgress * 0.23);
  const centerY = height * 0.57;
  const theta = orbitTheta;
  const phase = theta * 28;
  const headDrift = scale * 0.09 * ((theta - Math.PI) / Math.PI);
  const smooth = (value) => value * value * (3 - 2 * value);
  const flashProgress = smooth(clamp(planeFocusProgress / 0.14));
  const levelProgress = smooth(clamp((planeFocusProgress - 0.14) / 0.2));
  const orbitRotateProgress = smooth(clamp((planeFocusProgress - 0.34) / 0.24));
  const zoomProgress = smooth(clamp((planeFocusProgress - 0.58) / 0.16));
  const colorProgressRaw = clamp((planeFocusProgress - 0.74) / 0.26);
  const colorProgress = smooth(colorProgressRaw);
  const annotationProgress = smooth(clamp((planeFocusProgress - 0.7) / 0.24));
  const radiusBirdProgress = smooth(clamp((radiusFocusProgress - 0.12) / 0.62));
  const radiusLineProgress = smooth(clamp((radiusFocusProgress - 0.68) / 0.26));
  const apsisRotateProgress = smooth(clamp((apsisFocusProgress - 0.04) / 0.42));
  const apsisZoomProgress = smooth(clamp((apsisFocusProgress - 0.46) / 0.36));
  const apsisOverlayProgress = smooth(clamp((apsisFocusProgress - 0.58) / 0.24));
  const apsisLabelProgress = smooth(clamp((apsisFocusProgress - 0.76) / 0.18));
  const viewRotation = planeViewRotation * orbitRotateProgress;
  const planeFocusCompression = 0.34 + (0.065 - 0.34) * levelProgress;
  const planeCompression = planeFocusCompression
    + (1 - planeFocusCompression) * radiusBirdProgress;
  const verticalProjection = 0.78 * (1 - radiusBirdProgress);
  const projectionCenterY = centerY + headDrift * verticalProjection;
  const galacticCenter = { x: centerX, y: centerY };
  const sun = projectSun(
    theta,
    centerX,
    projectionCenterY,
    scale,
    viewRotation,
    planeCompression,
    verticalProjection,
    theta,
    apsisRotateProgress,
  );
  const earth = projectPoint(
    theta,
    phase,
    centerX,
    projectionCenterY,
    scale,
    viewRotation,
    planeCompression,
    verticalProjection,
    theta,
    apsisRotateProgress,
  );

  const diagramCenterX = width * (width <= 760 ? 0.5 : 0.64);
  const diagramCenterY = height * (width <= 760 ? 0.36 : 0.39);
  const planeZoom = 1 + zoomProgress * 2.8;
  const planeAnchorX = sun.x + (diagramCenterX - sun.x) * zoomProgress;
  const planeAnchorY = sun.y + (diagramCenterY - sun.y) * zoomProgress;
  const apsisTargetX = width * 0.5;
  const apsisTargetY = height * (width <= 760 ? 0.34 : 0.38);
  const cameraAnchorX = planeAnchorX + (apsisTargetX - planeAnchorX) * apsisZoomProgress;
  const cameraAnchorY = planeAnchorY + (apsisTargetY - planeAnchorY) * apsisZoomProgress;
  const apsisZoomScale = width <= 760 ? 5.4 : 7.2;
  const cameraZoom = planeZoom * (1 + apsisZoomProgress * apsisZoomScale);
  const earthPlaneAngle = planeEarthStartAngle
    + (planeEarthTargetAngle - planeEarthStartAngle) * orbitRotateProgress;
  const localPlaneRadius = Math.max(28, scale * 0.043);

  const modeledEarthX = sun.x
    + localPlaneRadius * Math.cos(phase) * Math.cos(earthPlaneAngle)
    - localPlaneRadius * 0.31 * Math.sin(phase) * Math.sin(earthPlaneAngle);
  const modeledEarthY = sun.y
    + localPlaneRadius * Math.cos(phase) * Math.sin(earthPlaneAngle)
    + localPlaneRadius * 0.31 * Math.sin(phase) * Math.cos(earthPlaneAngle);
  const alignedEarthX = earth.x + (modeledEarthX - earth.x) * orbitRotateProgress;
  const alignedEarthY = earth.y + (modeledEarthY - earth.y) * orbitRotateProgress;
  const apsisEarth = projectApsisOrbitPoint(
    sun,
    theta,
    phase,
    scale,
    viewRotation,
    planeCompression,
    verticalProjection,
    theta,
    apsisRotateProgress,
  );
  const focusedEarthX = alignedEarthX + (apsisEarth.x - alignedEarthX) * apsisOverlayProgress;
  const focusedEarthY = alignedEarthY + (apsisEarth.y - alignedEarthY) * apsisOverlayProgress;
  context.save();
  context.globalAlpha = 1 - zoomProgress * 0.78;
  context.translate(cameraAnchorX, cameraAnchorY);
  context.scale(cameraZoom, cameraZoom);
  context.translate(-sun.x, -sun.y);
  drawPath(
    centerX,
    projectionCenterY,
    scale,
    theta,
    viewRotation,
    planeCompression,
    verticalProjection,
    theta,
    apsisRotateProgress,
  );
  drawOrbitCountHighlight(
    centerX,
    projectionCenterY,
    scale,
    theta,
    orbitHighlightProgress,
    orbitHighlightOpacity,
    viewRotation,
    planeCompression,
    verticalProjection,
  );
  drawSagittariusTrail(galacticCenter, scale);
  drawSagittariusA(galacticCenter, scale, time);
  drawLabel(galacticCenter, 'Sagittarius A*', 42, -34);

  if (planeFocusProgress > 0) {
    drawHighlightedPlanes(
      galacticCenter,
      sun,
      scale * 0.36,
      planeCompression,
      localPlaneRadius,
      earthPlaneAngle,
      flashProgress,
      colorProgress,
    );
  }
  context.restore();

  if (radiusLineProgress > 0) {
    drawGalacticRadius(galacticCenter, sun, radiusLineProgress);
  }

  const sharedEarthX = cameraAnchorX + (focusedEarthX - sun.x) * cameraZoom;
  const sharedEarthY = cameraAnchorY + (focusedEarthY - sun.y) * cameraZoom;
  const sunRadius = Math.max(5, scale * 0.008)
    + (11 - Math.max(5, scale * 0.008)) * zoomProgress
    + apsisZoomProgress * 3;
  const earthRadius = Math.max(2.5, scale * 0.0038)
    + (5 - Math.max(2.5, scale * 0.0038)) * zoomProgress
    + apsisZoomProgress * 1.5;

  const sharedSun = { x: cameraAnchorX, y: cameraAnchorY };
  const sharedEarth = { x: sharedEarthX, y: sharedEarthY };

  drawApsisFocusOverlay(
    sun,
    theta,
    phase,
    scale,
    viewRotation,
    planeCompression,
    verticalProjection,
    theta,
    apsisRotateProgress,
    sharedSun,
    cameraZoom,
    apsisOverlayProgress,
    apsisLabelProgress,
  );

  context.save();
  drawBody(sharedSun, sunRadius, '#f4b54d', 'rgba(244,181,77,.85)');
  drawBody(sharedEarth, earthRadius, '#b5dcff', 'rgba(181,220,255,.9)');
  context.globalAlpha = 1 - apsisLabelProgress;
  drawLabel(sharedSun, 'Sun', -34, -24);
  drawLabel(sharedEarth, 'Earth', 32, 24);

  if (annotationProgress > 0) {
    drawPlaneAngleOverlay(
      sharedSun,
      Math.min(localPlaneRadius * planeZoom, 205),
      earthPlaneAngle,
      annotationProgress,
      colorProgress,
    );
  }
  context.restore();

  const readyNow = planeFocusTarget === 1 && planeFocusProgress >= 0.995;
  if (readyNow !== planeFocusReady) {
    planeFocusReady = readyNow;
    document.body.classList.toggle('plane-focus-ready', readyNow);
    planeFocusCopy.setAttribute('aria-hidden', String(!readyNow));
    if (readyNow) planeFocusBack.focus({ preventScroll: true });
  }

  const radiusReadyNow = radiusFocusTarget === 1 && radiusFocusProgress >= 0.995;
  if (radiusReadyNow !== radiusFocusReady) {
    radiusFocusReady = radiusReadyNow;
    document.body.classList.toggle('radius-focus-ready', radiusReadyNow);
    radiusFocusCopy.setAttribute('aria-hidden', String(!radiusReadyNow));
    if (radiusReadyNow) radiusFocusBack.focus({ preventScroll: true });
  }

  const apsisReadyNow = apsisFocusTarget === 1 && apsisFocusProgress >= 0.995;
  if (apsisReadyNow !== apsisFocusReady) {
    apsisFocusReady = apsisReadyNow;
    document.body.classList.toggle('apsis-focus-ready', apsisReadyNow);
    apsisFocusCopy.setAttribute('aria-hidden', String(!apsisReadyNow));
    if (apsisReadyNow) apsisFocusBack.focus({ preventScroll: true });
  }

  if (!reducedMotion) requestAnimationFrame(render);
}

function updateScrollScene() {
  const bounds = scrollStage.getBoundingClientRect();
  const scrollRange = Math.max(1, bounds.height - window.innerHeight);
  const progress = clamp(-bounds.top / scrollRange);
  const titleFade = clamp(progress / 0.34);
  const dataReveal = reducedMotion ? (progress > 0.18 ? 1 : 0) : clamp((progress - 0.18) / 0.48);
  const noteReveal = reducedMotion ? (progress > 0.36 ? 1 : 0) : clamp((progress - 0.36) / 0.14);
  const compactView = window.innerWidth <= 760;
  sceneProgress = dataReveal;

  trajectoryHeading.style.opacity = String(1 - titleFade);
  trajectoryHeading.style.transform = `translate3d(0, ${-220 * progress}px, 0)`;
  modelContextNote.style.opacity = String(noteReveal);
  modelContextNote.style.transform = `translate3d(0, ${-8 * (1 - noteReveal)}px, 0)`;
  modelContextNote.style.pointerEvents = noteReveal > 0.9 ? 'auto' : 'none';

  const contentWidth = modelDetails.parentElement.getBoundingClientRect().width;
  const detailsWidth = modelDetails.getBoundingClientRect().width;
  const horizontalShift = compactView ? 0 : (1 - dataReveal) * Math.max(0, (contentWidth - detailsWidth) / 2);
  const verticalShift = compactView ? -190 * progress : -255 * progress;
  modelDetails.style.transform = `translate3d(${horizontalShift}px, ${verticalShift}px, 0)`;
  modelMeta.style.transform = `translate3d(${horizontalShift}px, ${verticalShift}px, 0)`;

  parameterPanel.style.opacity = String(dataReveal);
  parameterPanel.style.transform = `translate3d(${(1 - dataReveal) * 48}px, 0, 0)`;
  parameterPanel.style.pointerEvents = dataReveal > 0.85 ? 'auto' : 'none';
  scrollFrameRequested = false;
}

function requestScrollUpdate() {
  if (scrollFrameRequested) return;
  scrollFrameRequested = true;
  requestAnimationFrame(updateScrollScene);
}

function setPlaneFocus(active) {
  if (active) {
    planeEarthTargetAngle = -60.3 * Math.PI / 180;
    planeEarthStartAngle = planeEarthTargetAngle;
    planeViewRotation = Math.PI / 2 - (orbitTheta % (Math.PI * 2));
    while (planeViewRotation > Math.PI) planeViewRotation -= Math.PI * 2;
    while (planeViewRotation < -Math.PI) planeViewRotation += Math.PI * 2;
  }
  planeFocusTarget = active ? 1 : 0;
  document.body.classList.toggle('plane-focus-active', active);
  if (!active) {
    planeFocusReady = false;
    document.body.classList.remove('plane-focus-ready');
    planeFocusCopy.setAttribute('aria-hidden', 'true');
    planeFocusTrigger.focus({ preventScroll: true });
  }
}

function setRadiusFocus(active) {
  radiusFocusTarget = active ? 1 : 0;
  document.body.classList.toggle('radius-focus-active', active);
  if (!active) {
    radiusFocusReady = false;
    document.body.classList.remove('radius-focus-ready');
    radiusFocusCopy.setAttribute('aria-hidden', 'true');
    radiusFocusTrigger.focus({ preventScroll: true });
  }
}

function setApsisFocus(active) {
  apsisFocusTarget = active ? 1 : 0;
  document.body.classList.toggle('apsis-focus-active', active);
  if (!active) {
    apsisFocusReady = false;
    document.body.classList.remove('apsis-focus-ready');
    apsisFocusCopy.setAttribute('aria-hidden', 'true');
    apsisFocusTrigger.focus({ preventScroll: true });
  }
}

function startOrbitCountSequence() {
  if (orbitCountSequenceActive) return;
  orbitCountSequenceActive = true;
  orbitCountSequenceStart = performance.now();
  viewTriggers.forEach((trigger) => {
    trigger.disabled = true;
  });
}

planeFocusTrigger.addEventListener('click', () => setPlaneFocus(true));
planeFocusBack.addEventListener('click', () => setPlaneFocus(false));
radiusFocusTrigger.addEventListener('click', () => setRadiusFocus(true));
radiusFocusBack.addEventListener('click', () => setRadiusFocus(false));
apsisFocusTrigger.addEventListener('click', () => setApsisFocus(true));
apsisFocusBack.addEventListener('click', () => setApsisFocus(false));
orbitCountTrigger.addEventListener('click', startOrbitCountSequence);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && planeFocusTarget === 1) setPlaneFocus(false);
  if (event.key === 'Escape' && radiusFocusTarget === 1) setRadiusFocus(false);
  if (event.key === 'Escape' && apsisFocusTarget === 1) setApsisFocus(false);
});

window.addEventListener('resize', () => {
  resizeCanvas();
  requestScrollUpdate();
});
window.addEventListener('scroll', requestScrollUpdate, { passive: true });
resizeCanvas();
updateScrollScene();
requestAnimationFrame(render);
