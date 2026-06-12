// $1 Unistroke Recognizer (Wobbrock, Wilson, Li 2007)
// Pipeline: resample to N points, rotate to indicative angle, scale to a
// square, translate to origin, then distance at best angle via golden
// section search against each template.

const NUM_POINTS = 64;
const SQUARE_SIZE = 250;
const ANGLE_RANGE = (45 * Math.PI) / 180;
const ANGLE_PRECISION = (2 * Math.PI) / 180;
const PHI = 0.5 * (-1 + Math.sqrt(5));
const HALF_DIAGONAL = 0.5 * Math.sqrt(2 * SQUARE_SIZE * SQUARE_SIZE);

function pathLength(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return d;
}

export function resample(points, n = NUM_POINTS) {
  const interval = pathLength(points) / (n - 1);
  if (interval === 0) return points.map((p) => ({ x: p.x, y: p.y }));
  let D = 0;
  const src = points.map((p) => ({ x: p.x, y: p.y }));
  const out = [{ x: src[0].x, y: src[0].y }];
  for (let i = 1; i < src.length; i++) {
    const d = Math.hypot(src[i].x - src[i - 1].x, src[i].y - src[i - 1].y);
    if (D + d >= interval) {
      const t = (interval - D) / d;
      const q = {
        x: src[i - 1].x + t * (src[i].x - src[i - 1].x),
        y: src[i - 1].y + t * (src[i].y - src[i - 1].y),
      };
      out.push(q);
      src.splice(i, 0, q); // q becomes the next start point
      D = 0;
    } else {
      D += d;
    }
  }
  // Rounding can leave us one short of n
  while (out.length < n) out.push({ x: src[src.length - 1].x, y: src[src.length - 1].y });
  return out;
}

function centroid(points) {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

export function indicativeAngle(points) {
  const c = centroid(points);
  return Math.atan2(c.y - points[0].y, c.x - points[0].x);
}

export function rotateBy(points, radians) {
  const c = centroid(points);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return points.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

export function scaleToSquare(points, size = SQUARE_SIZE) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  return points.map((p) => ({
    x: ((p.x - minX) / width) * size,
    y: ((p.y - minY) / height) * size,
  }));
}

export function translateToOrigin(points) {
  const c = centroid(points);
  return points.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
}

export function normalize(points) {
  let pts = resample(points, NUM_POINTS);
  pts = rotateBy(pts, -indicativeAngle(pts));
  pts = scaleToSquare(pts);
  pts = translateToOrigin(pts);
  return pts;
}

function pathDistance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  }
  return d / a.length;
}

function distanceAtAngle(points, template, radians) {
  return pathDistance(rotateBy(points, radians), template);
}

export function distanceAtBestAngle(
  points,
  template,
  fromAngle = -ANGLE_RANGE,
  toAngle = ANGLE_RANGE,
  precision = ANGLE_PRECISION
) {
  let a = fromAngle;
  let b = toAngle;
  let x1 = PHI * a + (1 - PHI) * b;
  let f1 = distanceAtAngle(points, template, x1);
  let x2 = (1 - PHI) * a + PHI * b;
  let f2 = distanceAtAngle(points, template, x2);
  while (Math.abs(b - a) > precision) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = PHI * a + (1 - PHI) * b;
      f1 = distanceAtAngle(points, template, x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = (1 - PHI) * a + PHI * b;
      f2 = distanceAtAngle(points, template, x2);
    }
  }
  return Math.min(f1, f2);
}

export class Recognizer {
  constructor() {
    this.templates = []; // { name, points } with points already normalized
  }

  addTemplate(name, rawPoints) {
    this.templates.push({ name, points: normalize(rawPoints) });
  }

  removeTemplates(name) {
    this.templates = this.templates.filter((t) => t.name !== name);
  }

  // Returns { name, score, timeMs } or null when there are no templates
  // or the stroke is too short. Score is 1 at a perfect match, 0 at the
  // worst usable match.
  recognize(rawPoints) {
    const t0 = performance.now();
    if (this.templates.length === 0 || rawPoints.length < 2) return null;
    const candidate = normalize(rawPoints);
    let best = Infinity;
    let bestTemplate = null;
    for (const template of this.templates) {
      const d = distanceAtBestAngle(candidate, template.points);
      if (d < best) {
        best = d;
        bestTemplate = template;
      }
    }
    return {
      name: bestTemplate.name,
      score: Math.max(0, 1 - best / HALF_DIAGONAL),
      timeMs: performance.now() - t0,
    };
  }
}
