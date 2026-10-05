const canvas = document.getElementById('trajectory-canvas');
const context = canvas.getContext('2d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollStage = document.querySelector('.space-hero');
const trajectoryHeading = document.querySelector('.trajectory-heading');
const modelDetails = document.querySelector('.model-details');
const parameterPanel = document.querySelector('.parameter-panel');
const modelMeta = document.querySelector('.model-meta');
const planeFocusTrigger = document.querySelector('.plane-focus-trigger');
const planeFocusBack = document.querySelector('.plane-focus-back');
const planeFocusCopy = document.querySelector('.plane-focus-copy');

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
let planeSceneRotation = 0;
let planeSunStartAngle = 0;
let planeEarthStartAngle = 0;
let planeFocusReady = false;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
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

function projectPoint(theta, phase, centerX, centerY, scale) {
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

  return {
    x: centerX + x,
    y: centerY + y * 0.34 - z * 0.78,
  };
}

function projectSun(theta, centerX, centerY, scale) {
  const radius = scale * 0.36;
  const drift = scale * 0.09;
  const x = radius * Math.cos(theta);
  const y = radius * Math.sin(theta);
  const z = drift * ((theta - Math.PI) / Math.PI);
  return { x: centerX + x, y: centerY + y * 0.34 - z * 0.78 };
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

function drawPath(centerX, centerY, scale, headTheta) {
  const segments = 1300;
  const orbitSpan = Math.PI * 2;
  const tailTheta = headTheta - orbitSpan;
  context.lineWidth = Math.max(0.7, scale / 900);
  context.strokeStyle = 'rgba(121, 174, 247, 0.48)';
  context.beginPath();

  for (let index = 0; index <= segments; index += 1) {
    const theta = tailTheta + (index / segments) * orbitSpan;
    const phase = theta * 28;
    const point = projectPoint(theta, phase, centerX, centerY, scale);
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  context.stroke();

  context.lineWidth = 0.8;
  context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  context.beginPath();
  for (let index = 0; index <= 260; index += 1) {
    const theta = tailTheta + (index / 260) * orbitSpan;
    const point = projectSun(theta, centerX, centerY, scale);
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  context.stroke();
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

function drawOrbitalPlane(radius, rotation, fill, stroke) {
  context.save();
  context.rotate(rotation);
  context.beginPath();
  context.ellipse(0, 0, radius, radius * 0.31, 0, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = 1.2;
  context.strokeStyle = stroke;
  context.stroke();
  context.restore();
}

function drawPlaneFocus(
  centerX,
  centerY,
  radius,
  sunPlaneAngle,
  earthPlaneAngle,
  opacity,
  colorProgress,
  annotationProgress,
) {
  const color = (target, alpha) => {
    const channels = target.map((channel) => Math.round(255 + (channel - 255) * colorProgress));
    return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
  };
  const sunPlaneStroke = color([244, 181, 77], 0.9);
  const sunPlaneFill = color([244, 181, 77], 0.11);
  const earthPlaneStroke = color([121, 174, 247], 0.9);
  const earthPlaneFill = color([121, 174, 247], 0.11);

  context.save();
  context.globalAlpha = opacity;
  context.translate(centerX, centerY);

  drawOrbitalPlane(
    radius,
    sunPlaneAngle,
    sunPlaneFill,
    sunPlaneStroke,
  );
  drawOrbitalPlane(
    radius * 0.72,
    earthPlaneAngle,
    earthPlaneFill,
    earthPlaneStroke,
  );

  context.save();
  context.globalAlpha = annotationProgress;
  context.setLineDash([6, 6]);
  context.lineWidth = 1;
  context.strokeStyle = 'rgba(255,255,255,.68)';
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(radius * 0.62 * Math.cos(sunPlaneAngle), radius * 0.62 * Math.sin(sunPlaneAngle));
  context.moveTo(0, 0);
  context.lineTo(radius * 0.62 * Math.cos(earthPlaneAngle), radius * 0.62 * Math.sin(earthPlaneAngle));
  context.stroke();
  context.beginPath();
  context.arc(0, 0, radius * 0.39, earthPlaneAngle, sunPlaneAngle);
  context.stroke();
  context.restore();

  context.globalAlpha = opacity * annotationProgress;
  context.fillStyle = 'rgba(255,255,255,.88)';
  context.font = '700 12px "Space Mono", monospace';
  context.textAlign = 'left';
  context.fillText('60.3°', radius * 0.31, -radius * 0.19);

  context.fillStyle = sunPlaneStroke;
  context.font = '600 10px "DM Sans", sans-serif';
  context.textAlign = 'left';
  context.fillText('GALACTIC PLANE · SUN ORBIT', radius * 0.48, radius * 0.2);
  context.fillStyle = earthPlaneStroke;
  context.fillText('ECLIPTIC PLANE · EARTH ORBIT', -radius * 0.58, -radius * 0.53);
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

function render(time) {
  context.clearRect(0, 0, width, height);
  drawStars(time);

  const frameDuration = Math.min(50, Math.max(0, time - lastRenderTime));
  lastRenderTime = time;
  if (reducedMotion) {
    planeFocusProgress = planeFocusTarget;
  } else if (planeFocusProgress !== planeFocusTarget) {
    const direction = Math.sign(planeFocusTarget - planeFocusProgress);
    const transitionDuration = planeFocusTarget === 1 ? 1800 : 650;
    planeFocusProgress = clamp(planeFocusProgress + direction * frameDuration / transitionDuration);
    if (Math.abs(planeFocusTarget - planeFocusProgress) < 0.002) {
      planeFocusProgress = planeFocusTarget;
    }
  }
  if (!reducedMotion && planeFocusTarget === 0 && planeFocusProgress === 0) {
    orbitTheta += frameDuration * 0.000025;
  }

  const scale = Math.min(width, height) * (width < 700 ? 0.92 : 1.15);
  const centerX = width * (width <= 760 ? 0.5 : 0.5 + sceneProgress * 0.23);
  const centerY = height * 0.57;
  const theta = orbitTheta;
  const phase = theta * 28;
  const headDrift = scale * 0.09 * ((theta - Math.PI) / Math.PI);
  const projectionCenterY = centerY + headDrift * 0.78;
  const galacticCenter = { x: centerX, y: centerY };
  const sun = projectSun(theta, centerX, projectionCenterY, scale);
  const earth = projectPoint(theta, phase, centerX, projectionCenterY, scale);

  const flashProgress = clamp(planeFocusProgress / 0.16);
  const transformProgress = clamp((planeFocusProgress - 0.16) / 0.58);
  const transformEase = transformProgress * transformProgress * (3 - 2 * transformProgress);
  const colorProgressRaw = clamp((planeFocusProgress - 0.74) / 0.26);
  const colorProgress = colorProgressRaw * colorProgressRaw * (3 - 2 * colorProgressRaw);
  const annotationProgress = clamp((planeFocusProgress - 0.64) / 0.28);
  const sceneFade = clamp((transformProgress - 0.7) / 0.3);
  const diagramCenterX = width * (width <= 760 ? 0.5 : 0.64);
  const diagramCenterY = height * (width <= 760 ? 0.36 : 0.39);
  const zoom = 1 + transformEase * 2.8;
  const zoomAnchorX = sun.x + (diagramCenterX - sun.x) * transformEase;
  const zoomAnchorY = sun.y + (diagramCenterY - sun.y) * transformEase;
  const sceneRotation = planeSceneRotation * transformEase;
  const earthOffsetX = earth.x - sun.x;
  const earthOffsetY = earth.y - sun.y;
  const rotatedEarthOffsetX = earthOffsetX * Math.cos(sceneRotation) - earthOffsetY * Math.sin(sceneRotation);
  const rotatedEarthOffsetY = earthOffsetX * Math.sin(sceneRotation) + earthOffsetY * Math.cos(sceneRotation);
  const zoomedEarthX = zoomAnchorX + rotatedEarthOffsetX * zoom;
  const zoomedEarthY = zoomAnchorY + rotatedEarthOffsetY * zoom;

  context.save();
  context.globalAlpha = 1 - sceneFade;
  context.translate(zoomAnchorX, zoomAnchorY);
  context.scale(zoom, zoom);
  context.rotate(sceneRotation);
  context.translate(-sun.x, -sun.y);
  drawPath(centerX, projectionCenterY, scale, theta);
  drawSagittariusA(galacticCenter, scale, time);
  drawLabel(galacticCenter, 'Sagittarius A*', 42, -34);
  context.restore();

  const localPlaneRadius = Math.max(28, scale * 0.043);
  const diagramRadius = Math.min(scale * 0.25, 205);
  const planeRadius = localPlaneRadius + (diagramRadius - localPlaneRadius) * transformEase;
  const targetEarthPlaneAngle = -60.3 * Math.PI / 180;
  const sunPlaneAngle = planeSunStartAngle + sceneRotation;
  const rotatedEarthPlaneAngle = planeEarthStartAngle + sceneRotation;
  const earthPlaneAngle = rotatedEarthPlaneAngle
    + (targetEarthPlaneAngle - rotatedEarthPlaneAngle) * transformEase;

  if (planeFocusProgress > 0) {
    drawPlaneFocus(
      zoomAnchorX,
      zoomAnchorY,
      planeRadius,
      sunPlaneAngle,
      earthPlaneAngle,
      flashProgress,
      colorProgress,
      annotationProgress,
    );
  }

  const targetEarthDistance = planeRadius * 0.54;
  const targetEarthX = zoomAnchorX + targetEarthDistance * Math.cos(earthPlaneAngle);
  const targetEarthY = zoomAnchorY + targetEarthDistance * Math.sin(earthPlaneAngle);
  const sharedEarthX = zoomedEarthX + (targetEarthX - zoomedEarthX) * transformEase;
  const sharedEarthY = zoomedEarthY + (targetEarthY - zoomedEarthY) * transformEase;
  const sunRadius = Math.max(5, scale * 0.008) + (11 - Math.max(5, scale * 0.008)) * transformEase;
  const earthRadius = Math.max(2.5, scale * 0.0038) + (5 - Math.max(2.5, scale * 0.0038)) * transformEase;

  const sharedSun = { x: zoomAnchorX, y: zoomAnchorY };
  const sharedEarth = { x: sharedEarthX, y: sharedEarthY };
  drawBody(sharedSun, sunRadius, '#f4b54d', 'rgba(244,181,77,.85)');
  drawBody(sharedEarth, earthRadius, '#b5dcff', 'rgba(181,220,255,.9)');
  drawLabel(sharedSun, 'Sun', -34, -24);
  drawLabel(sharedEarth, 'Earth', 32, 24);

  const readyNow = planeFocusTarget === 1 && planeFocusProgress >= 0.995;
  if (readyNow !== planeFocusReady) {
    planeFocusReady = readyNow;
    document.body.classList.toggle('plane-focus-ready', readyNow);
    planeFocusCopy.setAttribute('aria-hidden', String(!readyNow));
    if (readyNow) planeFocusBack.focus({ preventScroll: true });
  }

  if (!reducedMotion) requestAnimationFrame(render);
}

function updateScrollScene() {
  const bounds = scrollStage.getBoundingClientRect();
  const scrollRange = Math.max(1, bounds.height - window.innerHeight);
  const progress = clamp(-bounds.top / scrollRange);
  const titleFade = clamp(progress / 0.34);
  const dataReveal = reducedMotion ? (progress > 0.18 ? 1 : 0) : clamp((progress - 0.18) / 0.48);
  const compactView = window.innerWidth <= 760;
  sceneProgress = dataReveal;

  trajectoryHeading.style.opacity = String(1 - titleFade);
  trajectoryHeading.style.transform = `translate3d(0, ${-220 * progress}px, 0)`;

  const contentWidth = modelDetails.parentElement.getBoundingClientRect().width;
  const detailsWidth = modelDetails.getBoundingClientRect().width;
  const horizontalShift = compactView ? 0 : (1 - dataReveal) * Math.max(0, (contentWidth - detailsWidth) / 2);
  const verticalShift = compactView ? -145 * progress : -125 * progress;
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
    const tangentX = -0.36 * Math.sin(orbitTheta);
    const tangentY = 0.36 * 0.34 * Math.cos(orbitTheta) - (0.09 * 0.78 / Math.PI);
    planeSunStartAngle = Math.atan2(tangentY, tangentX);
    planeEarthStartAngle = Math.atan2(0.34 * Math.sin(orbitTheta), Math.cos(orbitTheta));
    planeSceneRotation = -planeSunStartAngle;
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

planeFocusTrigger.addEventListener('click', () => setPlaneFocus(true));
planeFocusBack.addEventListener('click', () => setPlaneFocus(false));
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && planeFocusTarget === 1) setPlaneFocus(false);
});

window.addEventListener('resize', () => {
  resizeCanvas();
  requestScrollUpdate();
});
window.addEventListener('scroll', requestScrollUpdate, { passive: true });
resizeCanvas();
updateScrollScene();
requestAnimationFrame(render);
