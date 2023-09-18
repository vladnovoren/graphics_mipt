#define MAX_ITERS 100
#define MAX_SDF_STEPS 100
#define MAX_DIST 10.0
#define Scale 1.0
#define EPS 0.001

float Sphere(in vec3 p) { return length(p) - 1.0; }

float VesicaSegment(in vec3 p, in vec3 a, in vec3 b, in float w) {
  vec3 c = (a + b) * 0.5;
  float l = length(b - a);
  vec3 v = (b - a) / l;
  float y = dot(p - c, v);
  vec2 q = vec2(length(p - c - y * v), abs(y));

  float r = 0.5 * l;
  float d = 0.5 * (r * r - w * w) / w;
  vec3 h = (r * q.x < d * (q.y - r)) ? vec3(0.0, r, 0.0) : vec3(-d, 0.0, d + w);

  return length(q - h.xy) - h.z;
}

float Torus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float box(in vec3 pos, in vec3 size) {
  vec3 pt = abs(pos) - size;

  return length(max(pt, 0.0)) + min(max(pt.x, max(pt.y, pt.z)), 0.0);
}

float Displacement(in vec3 p, float intensity) {
  return sin(intensity * p.x) * sin(intensity * p.y) * sin(intensity * p.z);
}

float Displace(float primitive, in vec3 pos) {
  float displacement = Displacement(pos, 1.5);
  return primitive + displacement;
}

vec3 Twist(in vec3 p, float k) {
  float c = cos(k * p.y);
  float s = sin(k * p.y);
  mat2 m = mat2(c, -s, s, c);
  return vec3(m * p.xz, p.y);
}

float SDF(in vec3 p) {
  vec3 q = Twist(p, 5.0);
  return Displace(VesicaSegment(p, vec3(-2, 0, 0), vec3(2, 0, 0), 0.7), p);
}

float SDF(in vec3 p, in mat3 m) {
  vec3 q = m * p;
  return SDF(q);
}

vec3 trace(vec3 from, vec3 dir, out bool hit, in mat3 m) {
  vec3 p = from;
  float totalDist = 0.0;

  hit = false;

  for (int steps = 0; steps < MAX_SDF_STEPS; steps++) {
    float dist = SDF(p, m);

    if (dist < EPS) {
      hit = true;
      break;
    }

    totalDist += dist;

    if (totalDist > MAX_DIST)
      break;

    p += dist * dir;
  }

  return p;
}

vec3 GenerateNormal(vec3 z, float d, in mat3 m) {
  float e = max(d * 0.5, EPS);
  float dx1 = SDF(z + vec3(e, 0, 0), m);
  float dx2 = SDF(z - vec3(e, 0, 0), m);
  float dy1 = SDF(z + vec3(0, e, 0), m);
  float dy2 = SDF(z - vec3(0, e, 0), m);
  float dz1 = SDF(z + vec3(0, 0, e), m);
  float dz2 = SDF(z - vec3(0, 0, e), m);

  return normalize(vec3(dx1 - dx2, dy1 - dy2, dz1 - dz2));
}

mat3 RotateX(float phi) {
  float sin_phi = sin(phi);
  float cos_phi = cos(phi);

  return mat3(vec3(1, 0, 0), vec3(0, cos_phi, -sin_phi),
              vec3(0, sin_phi, cos_phi));
}

mat3 RotateY(float phi) {
  float sin_phi = sin(phi);
  float cos_phi = cos(phi);

  return mat3(vec3(cos_phi, 0, -sin_phi), vec3(0, 1, 0),
              vec3(sin_phi, 0, cos_phi));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec3 eye = vec3(0, 0, -10);
  vec3 light = eye;
  bool hit = false;
  vec3 mouse = vec3(iMouse.xy / iResolution.xy - 0.5, iMouse.z - 0.5);
  mat3 m = RotateX(9.0 * mouse.y) * RotateY(6.0 * mouse.x);
  vec2 scale = 9.0 * iResolution.xy / max(iResolution.x, iResolution.y);
  vec2 uv = scale * (fragCoord / iResolution.xy - vec2(0.5));
  vec3 dir = normalize(vec3(uv, 0) - eye);
  vec4 color = vec4(0, 0, 0, 1);
  vec3 p = trace(eye, dir, hit, m);

  if (hit) {
    vec3 l = normalize(light - p);
    vec3 v = normalize(eye - p);
    vec3 n = GenerateNormal(p, 0.001, m);
    float nl = max(0.0, dot(n, l));
    vec3 h = normalize(l + v);
    float hn = max(0.0, dot(h, n));
    float sp = pow(hn, 150.0);
    color = 0.5 * vec4(nl) + 0.5 * sp * vec4(0, 1, 0, 1);
  }

  fragColor = color;
}