// =========================
// SCENE
// =========================
const scene = new THREE.Scene();

let solarBeam = null;
let auroraTimer = null;
let auroraActive = false;
let sunWaveLocked = false;



// =========================
// CAMERA
// =========================
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 3.2;

// =========================
// RENDERER
// =========================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);

// Physically correct rendering
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

document.getElementById("earth-wrapper").appendChild(renderer.domElement);

// =========================
// TEXTURES
// =========================
const loader = new THREE.TextureLoader();

const earthMap = loader.load("earth_day.jpg");
earthMap.colorSpace = THREE.SRGBColorSpace;

const earthNormal = loader.load("earth_normal.jpg");
const earthSpecular = loader.load("earth_specular.jpg");

const cloudMap = loader.load("earth_clouds.png");
cloudMap.colorSpace = THREE.SRGBColorSpace;

// =========================
// EARTH
// =========================
const earthMaterial = new THREE.MeshStandardMaterial({
  map: earthMap,
  normalMap: earthNormal,
  roughnessMap: earthSpecular,

  roughness: 1.0,
  metalness: 0.0
});

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(1, 128, 128),
  earthMaterial
);
scene.add(earth);

// =========================
// CLOUDS (FIXED — NO JPEG LOOK)
// =========================
const cloudMaterial = new THREE.MeshStandardMaterial({
  map: cloudMap,
  transparent: true,
  opacity: 0.9,

  depthWrite: false,   // 🔑 critical
  roughness: 1,
  metalness: 0,
  emissive: new THREE.Color(0x222222)
});

const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(1.015, 128, 128),
  cloudMaterial
);
clouds.renderOrder = 1;
scene.add(clouds);

// =========================
// ATMOSPHERE (REALISTIC)
// =========================

const atmosphereMaterial = new THREE.ShaderMaterial({
  transparent: true,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  uniforms: {
    glowColor: { value: new THREE.Color(0x4da6ff) },
    lightDirection: { value: new THREE.Vector3(1, 0, 0) },
    intensity: { value: 0.6 },
    power: { value: 2.5 }
  },

  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,

  fragmentShader: `
  uniform vec3 glowColor;
  uniform vec3 lightDirection;
  uniform float intensity;
  uniform float power;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float rim = 1.0 - dot(vNormal, viewDir);

    // soften edge
    float softRim = smoothstep(0.0, 1.0, pow(rim, power));

    // light side only
    float light = max(dot(vNormal, normalize(lightDirection)), 0.0);

    float alpha = softRim * light * intensity;

    gl_FragColor = vec4(glowColor, alpha);
  }
`
});




const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.03, 128, 128),
  atmosphereMaterial
);

scene.add(atmosphere);

const textureLoader = new THREE.TextureLoader();

const sunTexture = textureLoader.load('textures/sun_surface.jpg');
sunTexture.wrapS = sunTexture.wrapT = THREE.RepeatWrapping;

const sunMaterial = new THREE.MeshStandardMaterial({
  map: sunTexture,
  emissive: new THREE.Color(0xff5500),
  emissiveIntensity: 1.2,
  roughness: 0.4,
  metalness: 0.0
});

const light = new THREE.PointLight(0xffffff, 2);
light.position.set(2.8, 0.8, 1);
scene.add(light);


const sunCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.35, 64, 64),
  sunMaterial
);

sunCore.position.set(2.8, 0.8, -1);
scene.add(sunCore);

const glowMaterial = new THREE.MeshBasicMaterial({
  color: 0xff3300,
  transparent: true,
  opacity: 0.1
});

const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.35, 64, 64),
  glowMaterial
);

sunCore.add(sunGlow);

const coreGeom = new THREE.CylinderGeometry(0.02, 0.02, 5, 32, 1, true);
const coreMat = new THREE.ShaderMaterial({
  transparent: true,
  blending: THREE.AdditiveBlending,
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color(0xffaa33) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 color;
    varying vec2 vUv;

    void main() {
      float flow = sin(vUv.y * 40.0 - time * 8.0);
      float alpha = smoothstep(0.0, 0.15, vUv.x) *
                    smoothstep(1.0, 0.85, vUv.x);

      gl_FragColor = vec4(color + flow * 0.15, alpha);
    }
  `
});
const haloGeom = new THREE.CylinderGeometry(0.06, 0.06, 5, 32, 1, true);

const haloMat = new THREE.MeshBasicMaterial({
  color: 0xff5500,
  transparent: true,
  opacity: 0.15,
  blending: THREE.AdditiveBlending
});

const sunRadius = 0.35;

const beamMat = new THREE.ShaderMaterial({
  transparent: true,
  blending: THREE.AdditiveBlending,
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color(0xffaa33) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 color;
    varying vec2 vUv;

    void main() {
      float wave = sin(vUv.y * 40.0 - time * 8.0) * 0.15;
      float alpha = smoothstep(0.0, 0.2, vUv.x) *
                    smoothstep(1.0, 0.8, vUv.x);
      gl_FragColor = vec4(color + wave, alpha);
    }
  `
});







function fireSolarBeam() {

  const sunPos = sunCore.getWorldPosition(new THREE.Vector3());
  const earthPos = earth.getWorldPosition(new THREE.Vector3());

  // direction : Sun → Earth
  const beamDir = new THREE.Vector3()
    .subVectors(earthPos, sunPos)
    .normalize();

  const beamLength = sunPos.distanceTo(earthPos);

  // 🔑 Geometry ที่ "ฐานอยู่ที่ 0"
  const beamGeom = new THREE.BoxGeometry(0.06, 0.06, beamLength);
  beamGeom.translate(0, 0, beamLength / 2); // <── สำคัญมาก

  solarBeam = new THREE.Mesh(beamGeom, beamMat);

  // หมุนจาก +Z ไปยังทิศ Earth
  solarBeam.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    beamDir
  );

  // วางที่ผิวดวงอาทิตย์
  const beamStart = sunPos.clone().add(
    beamDir.clone().multiplyScalar(sunRadius + 0.01)
  );
  solarBeam.position.copy(beamStart);

  // เริ่มจากสั้น → ยาว
  solarBeam.scale.z = 0.01;

  scene.add(solarBeam);

  // Grow forward only
  let grow = setInterval(() => {
    if (!solarBeam) return clearInterval(grow);

    solarBeam.scale.z += 0.08;
    if (solarBeam.scale.z >= 1) {
      solarBeam.scale.z = 1;
      clearInterval(grow);
    }
  }, 16);
}






// ===== AURORA =====
const auroraMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    time: { value: 0 },
    intensity: { value: 0 },
    color: { value: new THREE.Color(0x66ffcc) }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
  uniform float time;
  uniform float intensity;

  varying vec3 vNormal;
  varying vec3 vPosition;

  vec3 auroraColor(float t) {
    return vec3(
      0.3 + 0.3 * sin(t * 1.5),
      0.7 + 0.3 * sin(t * 2.0),
      0.6 + 0.4 * sin(t * 1.2)
    );
  }

  void main() {
    float latitude = abs(vNormal.y);
    float band = smoothstep(0.55, 0.9, latitude);

    float wave = sin(vPosition.y * 14.0 + time * 4.0) * 0.5 + 0.5;
    float flicker = sin(time * 8.0 + vPosition.x * 6.0) * 0.25;

    float alpha = band * wave * intensity;
    vec3 color = auroraColor(time + vPosition.x);

    float finalAlpha = alpha * intensity;
    gl_FragColor = vec4(color, finalAlpha);

  }
`

});

const aurora = new THREE.Mesh(
  new THREE.SphereGeometry(1.06, 128, 128),
  auroraMaterial
);
scene.add(aurora);




// =========================
// LIGHTING
// =========================

// Soft global light
scene.add(new THREE.AmbientLight(0x050505));

// Sun
const sunLight = new THREE.DirectionalLight(0xffffff, 4.0);
sunLight.position.set(10, 4, 6);
scene.add(sunLight);

// Sky bounce
const hemiLight = new THREE.HemisphereLight(
  0x88ccee,
  0x02030a,
  0.35
);
scene.add(hemiLight);

// =========================
// ANIMATION LOOP
// =========================
let sunPulse = 0;
let sunWaveActive = false;


function animate() {
  requestAnimationFrame(animate);

  if (solarBeam) {
    solarBeam.material.uniforms.time.value += 0.03;
  }




  earth.rotation.y += 0.0008;
  clouds.rotation.y += 0.0011;
  sunTexture.offset.x += 0.0005;
  sunTexture.offset.y += 0.0003;

  sunCore.rotation.y += 0.002;


  auroraMaterial.uniforms.time.value += 0.015;
  sunCore.material.opacity =
  0.6 + Math.sin(performance.now() * 0.01) * 0.3;
  sunPulse *= 0.94;
  sunPulse = THREE.MathUtils.clamp(sunPulse, 0, 2.0);

  // Earth lighting = FIXED (ไม่ flash)
  sunLight.intensity = 4.0;

  // Atmosphere stays stable
  atmosphereMaterial.uniforms.intensity.value = 0.6;

  // Sun visual pulse only





  renderer.render(scene, camera);
}

animate();

// =========================
// RESPONSIVE
// =========================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


// =========================
// ESP32 LIVE DATA (WebSocket)
// =========================

// const socket = new WebSocket("ws://192.168.4.1:81"); 
// // 🔁 เปลี่ยน IP ให้ตรงกับ ESP32 ของคุณ

// socket.onopen = () => {
//   console.log("ESP32 connected");
// };

// socket.onmessage = (event) => {
//   const data = JSON.parse(event.data);

//   // 1. Magnetic Field Strength (µT)
//   document.getElementById("b_strength").textContent =
//     data.field_strength.toFixed(2) + " µT";

//   // 2. Current Direction (text)
//   document.getElementById("current_dir").textContent =
//     data.current_direction;

//   // 3. Magnetic Field Direction (vector)
//   const d = data.field_direction;
//   document.getElementById("b_dir").textContent =
//     `(${d[0].toFixed(2)}, ${d[1].toFixed(2)}, ${d[2].toFixed(2)})`;

//   // 🔥 optional: ผูกกับเอฟเฟกต์
//   auroraMaterial.uniforms.intensity.value =
//     THREE.MathUtils.clamp(data.field_strength / 60, 0.1, 1.0);
// };

// socket.onerror = (err) => {
//   console.error("WebSocket error", err);
// };


let magneticStrength = 0;


setInterval(() => {
  magneticStrength = 25 + Math.random() * 40;

  document.getElementById("b_strength").textContent =
    magneticStrength.toFixed(2) + " µT";

  updateGraph(magneticStrength);
}, 500);


const currentDirection = new THREE.Vector3(0, 1, 0); // หมุนรอบแกน Y
document.getElementById("current_dir").textContent =
  "ไหลรอบแกนโลก (West → East)";

  const magneticFieldDirection = new THREE.Vector3(
  0.2,  // เอียงเล็กน้อย
  1,
  0
).normalize();

document.getElementById("b_dir").textContent =
  `(${magneticFieldDirection.x.toFixed(2)}, 
    ${magneticFieldDirection.y.toFixed(2)}, 
    ${magneticFieldDirection.z.toFixed(2)})`;


function triggerAurora(duration = 5000) {
  if (auroraActive) return;

  auroraActive = true;
  auroraMaterial.uniforms.intensity.value = 0;

  // Fade IN
  let inInterval = setInterval(() => {
    auroraMaterial.uniforms.intensity.value += 0.04;
    if (auroraMaterial.uniforms.intensity.value >= 1.0) {
      auroraMaterial.uniforms.intensity.value = 1.0;
      clearInterval(inInterval);
    }
  }, 40);

  // Auto Fade OUT after duration
  auroraTimer = setTimeout(() => {
    let outInterval = setInterval(() => {
      auroraMaterial.uniforms.intensity.value -= 0.04;
      if (auroraMaterial.uniforms.intensity.value <= 0) {
        auroraMaterial.uniforms.intensity.value = 0;
        auroraActive = false;
        clearInterval(outInterval);
      }
    }, 40);
  }, duration);
}


sunWave.onclick = () => {

  // 🚫 Block spam
  if (sunWaveLocked) return;
  sunWaveLocked = true;

  // Optional: visual feedback
  sunWave.classList.add("disabled");

  // 1. Sun charge
  sunPulse = 3.5;

  // 2. Fire solar beam
  setTimeout(() => {
    fireSolarBeam();
  }, 600);

  // 3. Emergency alert
  setTimeout(() => {
    document.getElementById("emergency-overlay").classList.add("active");
  }, 900);

  // 4. Aurora outbreak
  setTimeout(() => {
    triggerAurora(5000);
  }, 1400);

  // 5. Cleanup + unlock
  setTimeout(() => {

    if (solarBeam) {
      let shrink = setInterval(() => {
        solarBeam.scale.x -= 0.05;

        if (solarBeam.scale.x <= 0.01) {
          clearInterval(shrink);
          scene.remove(solarBeam);
          solarBeam = null;
        }
      }, 16);
    }

    document.getElementById("emergency-overlay").classList.remove("active");

    // 🔓 UNLOCK (allow next use)
    sunWaveLocked = false;
    sunWave.classList.remove("disabled");

  }, 4200);
};





let chart = null;
let ctx = null;
let magHistory = [];
let smoothMag = 0;


function updateGraph(rawValue) {
  if (!ctx || !document.body.classList.contains("live-mode")) return;

  // SMOOTHING (เหมือน sin wave)
  smoothMag += (rawValue - smoothMag) * 0.15;
  
  magHistory.push(smoothMag);
  if (magHistory.length > 80) magHistory.shift();

  drawSmoothGraph();
}

function drawSmoothGraph() {
  ctx.clearRect(0, 0, chart.width, chart.height);

  ctx.strokeStyle = "#00eaff";
  ctx.lineWidth = 2;
  ctx.beginPath();

  const step = chart.width / (magHistory.length - 1);

  magHistory.forEach((v, i) => {
    const x = i * step;
    const y = chart.height - (v / 80) * chart.height;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      const prevX = (i - 1) * step;
      const prevY =
        chart.height - (magHistory[i - 1] / 80) * chart.height;

      const cx = (prevX + x) / 2;
      const cy = (prevY + y) / 2;

      ctx.quadraticCurveTo(prevX, prevY, cx, cy);
    }
  });

  ctx.stroke();
}





updateGraph(magneticStrength);


const theoryBtn = document.getElementById('theoryBtn');
const backBtn = document.getElementById('backBtn');

theoryBtn.onclick = () => {
  document.body.classList.add('theory-mode');
};

backBtn.onclick = () => {
  document.body.classList.remove('theory-mode');
};

const livePanel = document.getElementById("live-data");
let liveExpanded = false;

livePanel.onclick = () => {
  liveExpanded = !liveExpanded;

  if (liveExpanded) {
    document.body.classList.add("live-mode");
    document.body.classList.remove("theory-mode");

    // CREATE GRAPH
    const wrapper = document.getElementById("chart-wrapper");
    wrapper.innerHTML = `<canvas id="magChart" width="400" height="160"></canvas>`;

    chart = document.getElementById("magChart");
    ctx = chart.getContext("2d");
    magHistory = [];

  } else {
    document.body.classList.remove("live-mode");

    // DESTROY GRAPH
    const wrapper = document.getElementById("chart-wrapper");
    wrapper.innerHTML = "";

    chart = null;
    ctx = null;
    magHistory = [];
  }
};



