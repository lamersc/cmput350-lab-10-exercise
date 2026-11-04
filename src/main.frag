#version 120 

// (way more precision than a float can actually store...)
#define LOG_2 0.6931471805599453094172321214581765680755001

// start using these antialiasing values once you start (c)
#define AA 2
const int TOTAL_SAMPLES = AA * AA;

uniform vec2 c;
uniform int MAX_ITERS;
uniform vec2 windowSizePixels;
uniform vec2 camCenterWorld;
uniform float camWorldUnitsPerPixel;

uniform vec2 oldCamCenterWorld;
uniform float oldCamWorldUnitsPerPixel;
uniform sampler2D oldFrame;
uniform bool cChanged;

// Use this to get a color from your smoothed Julia set escape times.
vec4 colorTime(float t) {
    return vec4(0.5 + 0.5 * cos(  0.1 * (t) + vec3(0.f, 0.35, 0.7)), 1.f);
}

struct EscapeTime {
    float iters;
    bool isInf;
};

// Escape time of iterating z^2 + c
EscapeTime escapeTimeSmooth(vec2 z) {
    for (int n = 1; n <= MAX_ITERS; n++) {
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        if (length(z) > 4.0) {
            return EscapeTime(float(n) + 1.0 - log(log(length(z))) / LOG_2, false);
        }
    }
    return EscapeTime(0.0, true);
}


vec2 windowToWorld(vec2 windowCoords) {
    return camCenterWorld + (windowCoords - windowSizePixels * 0.5) * camWorldUnitsPerPixel;
}

// For reprojection
vec2 worldToOldWindow(vec2 worldCoords) {
    return (worldCoords - oldCamCenterWorld) / oldCamWorldUnitsPerPixel + windowSizePixels * 0.5;
}

// For SSAA
// Given (dx, dy) in [0, AA)^2, suppose the unit square [0, 1)^2 was cut up into AA equal
// partitions along each dimension. delta((dx, dy)) returns the center of the sub-square
// which is in the dy'th row and dx'th column (both 0-indexed).
vec2 delta(vec2 dxy) {
    return (dxy + 0.5) / float(AA);
}


void main() {
    vec4 sum = vec4(0.0);
    for (int dy = 0; dy < AA; dy++) {
        for (int dx = 0; dx < AA; dx++) {
            vec2 world = windowToWorld(gl_FragCoord.xy - 0.5 + delta(vec2(float(dx), float(dy))));
            EscapeTime et = escapeTimeSmooth(world);
            vec4 col = et.isInf ? vec4(0.0, 0.0, 0.0, 1.0) : colorTime(et.iters);
            vec2 oldWindow = worldToOldWindow(world);
            if (oldWindow.x >= 0.0 && oldWindow.x <= windowSizePixels.x &&
                oldWindow.y >= 0.0 && oldWindow.y <= windowSizePixels.y) {
                float alpha = clamp(et.iters / float(MAX_ITERS), 0.0, 1.0);
                if (cChanged) {
                    alpha = 1.0;
                }
                col = mix(texture2D(oldFrame, oldWindow / windowSizePixels), col, alpha);
            }
            sum += col;
        }
    }
    gl_FragColor = sum / float(TOTAL_SAMPLES);
}
