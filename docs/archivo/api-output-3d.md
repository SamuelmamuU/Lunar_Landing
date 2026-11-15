> **Archivo (solo referencia para la vista 3D, slice F7b).** El contrato vigente es `docs/contrato-api.md`.
> Ojo: en el ejemplo de abajo los `azimuth_deg` (71.45 y 15.32) estan mal escritos; la API real devuelve
> 65.68 (Sol) y 335.85 (Tierra), coherentes con los vectores. Ver `docs/ejemplos/evaluate-im2-1dia.json`.

## 1. Lo que ahora devuelve la API                                                                                                                                              
                                                                                                                                                                                  
  Tanto en POST /api/mission (at_landing) como en POST /api/evaluate (at_start) y en los reportes de CLI, la respuesta JSON ahora incluye los siguientes bloques listos para      
  Three.js:                                                                                                                                                                       
                                                                                                                                                                                  
    {                                                                                                                                                                             
      "at_landing": {                                                                                                                                                             
        "vectors_3d": {                                                                                                                                                           
          "frame": "MOON_ME",                                                                                                                                                     
          "origin": "center_of_moon",                                                                                                                                             
          "units": "km",                                                                                                                                                          
          "moon_radius_km": 1737.4,                                                                                                                                               
          "positions_km": {                                                                                                                                                       
            "site": [138.130, 77.185, -1735.525],                                                                                                                                 
            "earth": [370935.514, 34935.551, -43723.934],                                                                                                                         
            "sun": [-12316150.677, 147925659.789, -813295.072]                                                                                                                    
          },                                                                                                                                                                      
          "unit_directions": {                                                                                                                                                    
            "site": [0.079261, 0.044290, -0.995870],                                                                                                                              
            "earth": [0.988808, 0.093128, -0.116556],                                                                                                                             
            "sun": [-0.082971, 0.996537, -0.005479],                                                                                                                              
            "site_to_earth": [0.989343, 0.093007, -0.112031],                                                                                                                     
            "site_to_sun": [-0.082972, 0.996537, -0.005467]                                                                                                                       
          }                                                                                                                                                                       
        },                                                                                                                                                                        
        "sun": {                                                                                                                                                                  
          "azimuth_deg": 71.45,                                                                                                                                                   
          "elevation_deg": 2.46,                                                                                                                                                  
          "vector_3d_sky": [0.91041, 0.04300, -0.41147]                                                                                                                           
        },                                                                                                                                                                        
        "earth": {                                                                                                                                                                
          "azimuth_deg": 15.32,                                                                                                                                                   
          "elevation_deg": 11.19,                                                                                                                                                 
          "vector_3d_sky": [-0.40140, 0.19410, -0.89510]                                                                                                                          
        }                                                                                                                                                                         
      },                                                                                                                                                                          
      "horizon": {                                                                                                                                                                
        "terrain": true,                                                                                                                                                          
        "az_step_deg": 1.0,                                                                                                                                                       
        "profile_deg": [-0.498, -0.502, ..., 0.438]                                                                                                                               
      }                                                                                                                                                                           
    }                                                                                                                                                                             
  ──────                                                                                                                                                                          
  ## 2. Cómo usar estos datos en Three.js                                                                                                                                         
                                                                                                                                                                                  
  ### 🌍 VISTA 1: Desde afuera (Luna en el centro, Tierra, Sol y Pin de aterrizaje)                                                                                               
                                                                                                                                                                                  
  Esta vista usa vectors_3d.unit_directions y positions_km. No requiere que el frontend haga ninguna conversión trigonométrica:                                                   
                                                                                                                                                                                  
    import * as THREE from 'three';                                                                                                                                               
                                                                                                                                                                                  
    // 1. Luna en el centro                                                                                                                                                       
    const MOON_RADIUS_3D = 10; // 10 unidades en Three.js                                                                                                                         
    const moonMesh = new THREE.Mesh(                                                                                                                                              
      new THREE.SphereGeometry(MOON_RADIUS_3D, 64, 64),                                                                                                                           
      moonMaterial                                                                                                                                                                
    );                                                                                                                                                                            
    scene.add(moonMesh);                                                                                                                                                          
                                                                                                                                                                                  
    // 2. Pin o módulo en el sitio de aterrizaje (sobre la superficie lunar)                                                                                                      
    const siteDir = new THREE.Vector3(...data.at_landing.vectors_3d.unit_directions.site);                                                                                        
    const siteMesh = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8), pinMaterial);                                                                                               
    siteMesh.position.copy(siteDir.clone().multiplyScalar(MOON_RADIUS_3D));                                                                                                       
    siteMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), siteDir);                                                                                                  
    scene.add(siteMesh);                                                                                                                                                          
                                                                                                                                                                                  
    // 3. Tierra en 3D (a distancia visual cómoda, ej. 35 unidades)                                                                                                               
    const earthDir = new THREE.Vector3(...data.at_landing.vectors_3d.unit_directions.earth);                                                                                      
    const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(3.6, 32, 32), earthMaterial);                                                                                       
    earthMesh.position.copy(earthDir.multiplyScalar(35));                                                                                                                         
    scene.add(earthMesh);                                                                                                                                                         
                                                                                                                                                                                  
    // 4. Luz del Sol (ilumina la Luna exactamente con el ángulo real astronómico)                                                                                                
    const sunDir = new THREE.Vector3(...data.at_landing.vectors_3d.unit_directions.sun);                                                                                          
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);                                                                                                                   
    sunLight.position.copy(sunDir.multiplyScalar(80));                                                                                                                            
    sunLight.target.position.set(0, 0, 0);                                                                                                                                        
    scene.add(sunLight);                                                                                                                                                          
                                                                                                                                                                                  
    // Opcional: Rayo o línea de visión directa desde el sitio de aterrizaje hacia la Tierra                                                                                      
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([                                                                                                               
      siteMesh.position,                                                                                                                                                          
      earthMesh.position                                                                                                                                                          
    ]);                                                                                                                                                                           
    const sightline = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0x00ff88 }));                                                                             
    scene.add(sightline);                                                                                                                                                         
  ──────                                                                                                                                                                          
  ### 🏔️ VISTA 2: Desde el punto de aterrizaje (Primera persona en la superficie)                                                                                                  
                                                                                                                                                                                  
  Esta vista usa vector_3d_sky y horizon.profile_deg.                                                                                                                             
  La convención de ejes ya está adaptada para Three.js:                                                                                                                           
                                                                                                                                                                                  
  • +X: Este                                                                                                                                                                      
  • +Y: Cénit (Arriba en Three.js)                                                                                                                                                
  • -Z: Norte                                                                                                                                                                     
  • +Z: Sur                                                                                                                                                                       
                                                                                                                                                                                  
    // 1. Posición del Sol y la Tierra en la cúpula celeste (radio = 100 unidades)                                                                                                
    const SKY_RADIUS = 100;                                                                                                                                                       
                                                                                                                                                                                  
    const sunVec = new THREE.Vector3(...data.at_landing.sun.vector_3d_sky);                                                                                                       
    const sunSkyMesh = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), sunGlowMaterial);                                                                                      
    sunSkyMesh.position.copy(sunVec.multiplyScalar(SKY_RADIUS));                                                                                                                  
    scene.add(sunSkyMesh);                                                                                                                                                        
                                                                                                                                                                                  
    const earthVec = new THREE.Vector3(...data.at_landing.earth.vector_3d_sky);                                                                                                   
    const earthSkyMesh = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 16), earthMaterial);                                                                                      
    earthSkyMesh.position.copy(earthVec.multiplyScalar(SKY_RADIUS));                                                                                                              
    scene.add(earthSkyMesh);                                                                                                                                                      
                                                                                                                                                                                  
    // 2. Malla 3D de las montañas del horizonte alrededor del observador (360°)                                                                                                  
    const MOUNTAIN_DIST = 80;                                                                                                                                                     
    const mountainPoints: THREE.Vector3[] = [];                                                                                                                                   
    const azStepRad = THREE.MathUtils.degToRad(data.horizon.az_step_deg);                                                                                                         
                                                                                                                                                                                  
    data.horizon.profile_deg.forEach((elevationDeg: number, i: number) => {                                                                                                       
      const azRad = i * azStepRad;                                                                                                                                                
      const elRad = THREE.MathUtils.degToRad(elevationDeg);                                                                                                                       
      const cosEl = Math.cos(elRad);                                                                                                                                              
                                                                                                                                                                                  
      // Misma convención Three.js (X=Este, Y=Arriba, Z=-Norte)                                                                                                                   
      const x = MOUNTAIN_DIST * cosEl * Math.sin(azRad);                                                                                                                          
      const y = MOUNTAIN_DIST * Math.sin(elRad);                                                                                                                                  
      const z = -MOUNTAIN_DIST * cosEl * Math.cos(azRad);                                                                                                                         
                                                                                                                                                                                  
      mountainPoints.push(new THREE.Vector3(x, y, z));                                                                                                                            
    });                                                                                                                                                                           
                                                                                                                                                                                  
    // Cerrar el anillo                                                                                                                                                           
    mountainPoints.push(mountainPoints[0]);                                                                                                                                       
                                                                                                                                                                                  
    const horizonLine = new THREE.Line(                                                                                                                                           
      new THREE.BufferGeometry().setFromPoints(mountainPoints),                                                                                                                   
      new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 2 })                                                                                                              
    );                                                                                                                                                                            
    scene.add(horizonLine);                                                                                                                                                       
                                                                                                                                                                                  
  │ Tip                                                                                                                                                   
  │ Si la elevación del Sol está por debajo de la cresta montañosa (Y_{sol} < Y_{montaña}), en la vista 3D el Sol quedará visualmente detrás del relieve, reproduciendo fielmente 
  │ la condición terrain_interference: true calculada por el backend.